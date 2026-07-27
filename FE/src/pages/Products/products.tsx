import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertTriangle,
  Archive,
  Boxes,
  PackagePlus,
  PackageSearch,
  RefreshCw,
  Sandwich,
  Wallet,
} from 'lucide-react';

import PageMeta from '../../components/common/PageMeta';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/ui/card/SectionCard';
import StatCard from '../../components/ui/card/StatCard';
import SearchInput from '../../components/ui/input/SearchInput';
import EmptyState from '../../components/ui/empty/EmptyState';
import Button from '../../components/ui/button/Button';
import { SkeletonStatCards } from '../../components/ui/skeleton/Skeleton';
import { Modal } from '../../components/ui/modal';
import Label from '../../components/form/Label';
import Input from '../../components/form/input/InputField';
import Select from '../../components/form/Select';
import FileInput from '../../components/form/input/FileInput';
import ProductTable from '../../components/ProductTable/ProductTable';
import CreateComboMealModal from '../../components/modals/CreateComboMealModal';

import api from '../../lib/axios';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import {
  buildStockMap,
  categoryLabel,
  fetchCategories,
  fetchInventories,
  fetchProducts,
  productName,
  RawCategory,
  RawInventory,
  RawProduct,
} from '../../lib/apiResources';
import { formatCurrency, formatNumber } from '../../lib/format';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];

const swalZIndex = () => {
  const container = document.querySelector('.swal2-container') as HTMLElement | null;
  if (container) container.style.zIndex = '200000';
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Unexpected file reader result'));
    };
    reader.readAsDataURL(file);
  });
}

export default function Products() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [comboModalOpen, setComboModalOpen] = useState(false);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);
  const [archivedProducts, setArchivedProducts] = useState<RawProduct[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add-product form
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [isStockable, setIsStockable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const productsQuery = useCachedQuery<RawProduct[]>(CacheKeys.products, fetchProducts, {
    refreshEvents: ['products:refresh'],
  });
  const inventoriesQuery = useCachedQuery<RawInventory[]>(CacheKeys.inventories, fetchInventories, {
    refreshEvents: ['products:refresh'],
  });
  const categoriesQuery = useCachedQuery<RawCategory[]>(CacheKeys.categories, fetchCategories);

  const categoryOptions = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((category) => ({
        value: String(category.id),
        label: category.category_name || category.name || `#${category.id}`,
      })),
    [categoriesQuery.data]
  );

  /** Headline inventory numbers for the KPI strip. */
  const stats = useMemo(() => {
    const products = (productsQuery.data ?? []).filter((product) => product.status !== 'archived');
    const stockMap = buildStockMap(inventoriesQuery.data ?? []);

    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let stockValue = 0;
    let combos = 0;

    for (const product of products) {
      if (product.is_bundle) {
        combos += 1;
        continue;
      }
      const untracked = product.is_stockable === false || product.is_stockable === 0;
      if (untracked) {
        inStock += 1;
        continue;
      }
      const quantity = Number(stockMap[Number(product.id)] ?? 0);
      stockValue += quantity * Number(product.price ?? 0);
      if (quantity <= 0) outOfStock += 1;
      else if (quantity <= 10) lowStock += 1;
      else inStock += 1;
    }

    return { total: products.length, inStock, lowStock, outOfStock, stockValue, combos };
  }, [productsQuery.data, inventoriesQuery.data]);

  const showSkeleton = useShowSkeleton(productsQuery.isInitialLoading);

  const notifyProductsChanged = () => window.dispatchEvent(new CustomEvent('products:refresh'));

  const openArchivedModal = async () => {
    setArchivedModalOpen(true);
    setArchivedLoading(true);
    try {
      const response = await api.get('/products/archived');
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setArchivedProducts(data);
    } catch (error) {
      console.error('Failed to load archived products:', error);
      setArchivedProducts([]);
    } finally {
      setArchivedLoading(false);
    }
  };

  const resetAddForm = () => {
    setNewName('');
    setNewPrice('');
    setNewCategory('');
    setNewImage(null);
    setIsStockable(true);
    setImageError(null);
    setSaveError(null);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      const name = file.name.toLowerCase();
      const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
      const looksLikeImage = String(file.type || '').startsWith('image/');

      if (!looksLikeImage && !hasAllowedExtension) {
        setImageError('The file must be an image (jpeg, jpg, png, gif, webp).');
        setNewImage(null);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError('Image is too large — maximum allowed size is 25 MB.');
        setNewImage(null);
        return;
      }
    }
    setImageError(null);
    setNewImage(file);
  };

  const submitProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (imageError) {
      setSaveError(imageError);
      return;
    }

    // Duplicate names confuse the POS grid, so block them up front.
    const duplicate = (productsQuery.data ?? []).some(
      (product) => productName(product).toLowerCase() === newName.trim().toLowerCase()
    );
    if (duplicate) {
      await Swal.fire({
        title: 'Product already exists',
        text: `A product named "${newName}" already exists. Please use a different name.`,
        icon: 'error',
        confirmButtonColor: '#ef4444',
        willOpen: swalZIndex,
      });
      return;
    }

    setSaving(true);
    setSaveError(null);

    const announceSuccess = async () => {
      resetAddForm();
      setAddModalOpen(false);
      notifyProductsChanged();
      await Swal.fire({
        title: 'Product added',
        text: `${newName || 'Product'} was added successfully.`,
        icon: 'success',
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
        willOpen: swalZIndex,
      });
    };

    try {
      try {
        await api.get('/sanctum/csrf-cookie');
      } catch {
        // Not every deployment uses Sanctum cookies.
      }

      const form = new FormData();
      form.append('product_name', newName);
      form.append('price', newPrice);
      form.append('category_id', newCategory);
      // New products start with no stock so they read as "Out of Stock".
      form.append('status', 'out_of_stock');
      form.append('is_stockable', isStockable ? '1' : '0');
      if (newImage) form.append('image', newImage);

      await api.post('/products', form);
      await announceSuccess();
    } catch (error: any) {
      const response = error?.response;

      // Retry the image as base64 when PHP could not write the upload.
      if (response?.status === 422 && newImage) {
        let data: any = response.data ?? {};
        if (typeof data === 'string') {
          const start = data.indexOf('{');
          data = start === -1 ? {} : JSON.parse(data.substring(start) || '{}');
        }
        const imageMessage = String(
          Array.isArray(data?.errors?.image) ? data.errors.image.join('; ') : data?.errors?.image ?? ''
        ).toLowerCase();
        const serverMessage = String(data?.message ?? '').toLowerCase();
        const needsFallback =
          imageMessage.includes('failed to upload') ||
          imageMessage.includes('temporary') ||
          serverMessage.includes('failed to upload');

        if (needsFallback) {
          try {
            await api.post('/products', {
              product_name: newName,
              price: newPrice,
              category_id: newCategory,
              status: 'out_of_stock',
              is_stockable: isStockable,
              image_base64: await fileToDataUrl(newImage),
            });
            await announceSuccess();
            return;
          } catch (fallbackError) {
            console.warn('Base64 fallback failed:', fallbackError);
          }
        }
      }

      if (response?.status === 422) {
        const data = response.data;
        if (data?.errors?.image) {
          setImageError(
            Array.isArray(data.errors.image) ? data.errors.image.join('; ') : String(data.errors.image)
          );
        }
        const messages = data?.errors
          ? Object.values(data.errors).flat().join('; ')
          : data?.message;
        setSaveError(messages || error.message || 'Failed to save product');
      } else {
        setSaveError(response?.data?.message || error.message || 'Failed to save product');
      }
    } finally {
      setSaving(false);
    }
  };

  const restoreProduct = async (product: RawProduct) => {
    try {
      await api.patch(`/products/${product.id}/unarchive`);
      notifyProductsChanged();
      setArchivedProducts((current) => current.filter((item) => item.id !== product.id));
      await Swal.fire({
        title: 'Restored',
        text: `"${productName(product)}" has been restored.`,
        icon: 'success',
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
        willOpen: swalZIndex,
      });
    } catch (error: any) {
      await Swal.fire({
        title: 'Error',
        text: error?.response?.data?.message || 'Failed to restore product',
        icon: 'error',
        willOpen: swalZIndex,
      });
    }
  };

  return (
    <ProductsErrorBoundary>
      <PageMeta title="Stock management" />

      <PageHeader
        eyebrow="Inventory"
        title="Stock management"
        description="Track stock levels, adjust inventory, record damages and manage your catalog."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Stock management' }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                productsQuery.refresh();
                inventoriesQuery.refresh();
              }}
              loading={productsQuery.isRefreshing || inventoriesQuery.isRefreshing}
              startIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openArchivedModal}
              startIcon={<Archive className="h-4 w-4" />}
            >
              Archived
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComboModalOpen(true)}
              startIcon={<Sandwich className="h-4 w-4" />}
            >
              Combo meal
            </Button>
            <Button
              size="sm"
              onClick={() => setAddModalOpen(true)}
              startIcon={<PackagePlus className="h-4 w-4" />}
            >
              Add product
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {showSkeleton ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active products"
              tone="brand"
              icon={<Boxes className="h-5 w-5" />}
              value={formatNumber(stats.total)}
              hint={`${formatNumber(stats.combos)} combo meal${stats.combos === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Low stock"
              tone="warning"
              icon={<AlertTriangle className="h-5 w-5" />}
              value={formatNumber(stats.lowStock)}
              hint="10 units or fewer on hand"
            />
            <StatCard
              label="Out of stock"
              tone="danger"
              icon={<PackageSearch className="h-5 w-5" />}
              value={formatNumber(stats.outOfStock)}
              hint="Needs restocking"
            />
            <StatCard
              label="Inventory value"
              tone="success"
              icon={<Wallet className="h-5 w-5" />}
              value={formatCurrency(stats.stockValue)}
              hint={`${formatNumber(stats.inStock)} items healthy`}
            />
          </div>
        )}

        <SectionCard
          title="Product list"
          description="Search the catalog, then add stock, edit details or record damage."
          toolbar={
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search products by name, category or status…"
              className="w-full sm:max-w-md"
            />
          }
        >
          <ProductTable searchQuery={searchQuery} />
        </SectionCard>
      </div>

      {/* Add product */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} className="m-4 max-w-[700px]">
        <div className="relative w-full rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10">
          <div className="pr-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add new product</h2>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              Create the product now, then add stock from the product list.
            </p>
          </div>

          <form className="mt-6 flex flex-col" onSubmit={submitProduct}>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              <div>
                <Label>Product name</Label>
                <Input
                  type="text"
                  placeholder="Enter product name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </div>

              <div>
                <Label>Category</Label>
                <Select
                  options={categoryOptions}
                  placeholder="Select a category"
                  onChange={setNewCategory}
                  className="dark:bg-dark-900"
                  defaultValue={newCategory}
                />
              </div>

              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newPrice}
                  onChange={(event) => setNewPrice(event.target.value)}
                />
              </div>

              <div>
                <Label>Image</Label>
                <FileInput onChange={handleImageChange} />
                {imageError && <p className="mt-1 text-xs text-red-500">{imageError}</p>}
              </div>

              <div className="lg:col-span-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <input
                    type="checkbox"
                    checked={isStockable}
                    onChange={(event) => setIsStockable(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Requires inventory tracking
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Uncheck for unlimited items such as rice.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {saveError && <p className="mt-4 text-sm text-red-500">{saveError}</p>}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button size="sm" variant="outline" onClick={() => setAddModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={saving}>
                Save product
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Archived products */}
      <Modal
        isOpen={archivedModalOpen}
        onClose={() => setArchivedModalOpen(false)}
        className="m-4 max-w-4xl"
      >
        <div className="relative w-full rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10">
          <div className="pr-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Archived products</h2>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              Restore a product to make it sellable again.
            </p>
          </div>

          <div className="mt-6 max-h-[60vh] overflow-y-auto">
            {archivedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-14 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700/60"
                  />
                ))}
              </div>
            ) : archivedProducts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<Archive className="h-6 w-6" />}
                title="Nothing archived"
                description="Archived products will be listed here."
              />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {archivedProducts.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {productName(product)}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {categoryLabel(product)} · {formatCurrency(product.price)}
                      </p>
                    </div>
                    <Button size="xs" variant="success" onClick={() => restoreProduct(product)}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      <CreateComboMealModal
        isOpen={comboModalOpen}
        onClose={() => setComboModalOpen(false)}
        onSuccess={notifyProductsChanged}
      />
    </ProductsErrorBoundary>
  );
}

/** Keeps a render error on this page from blanking the whole admin shell. */
class ProductsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Products page error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-500/30 dark:bg-red-500/10">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-300">
            Something went wrong rendering Stock management
          </h2>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-red-600 dark:text-red-400">
            {String(this.state.error.stack || this.state.error.message)}
          </pre>
        </div>
      );
    }
    return this.props.children as React.ReactNode;
  }
}

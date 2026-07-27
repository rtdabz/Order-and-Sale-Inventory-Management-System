import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import Swal from 'sweetalert2';
import { ImageOff, PackageSearch } from 'lucide-react';

import DataTable from '../ui/table/DataTable';
import StatusPill, { StatusTone } from '../ui/badge/StatusPill';
import TableButton from '../ui/button/TableButton';
import { SkeletonTable } from '../ui/skeleton/Skeleton';
import AddStockModal from '../modals/AddStockModal';
import EditProductModal from '../modals/EditProductModal';
import DamageModal from '../modals/DamageModal';
import { PlusIcon, PencilIcon, ArchiveIcon } from '../../icons';

import api from '../../lib/axios';
import { useProductNotification } from '../../context/ProductNotificationContext';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../context/AppDataContext';
import { CacheKeys } from '../../lib/dataCache';
import {
  buildStockMap,
  categoryLabel,
  fetchCategories,
  fetchInventories,
  fetchProducts,
  productImage,
  productName,
  RawCategory,
  RawInventory,
  RawProduct,
} from '../../lib/apiResources';
import { formatCurrency } from '../../lib/format';

type StockRow = RawProduct & {
  id: number;
  displayName: string;
  displayCategory: string;
  image: string | null;
  /** Null when the product is not inventory-tracked. */
  stock: number | null;
  statusLabel: string;
  statusTone: StatusTone;
};

/** Layer SweetAlert above the app modals. */
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

/** Some PHP setups prefix JSON with warnings; recover the JSON body. */
function normalizeErrorPayload(data: any): any {
  if (typeof data !== 'string') return data ?? {};
  const start = data.indexOf('{');
  if (start === -1) return {};
  try {
    return JSON.parse(data.substring(start));
  } catch {
    return {};
  }
}

export default function ProductTable({ searchQuery = '' }: { searchQuery?: string }) {
  const { highlightedProductId, setHighlightedProductId } = useProductNotification();

  const productsQuery = useCachedQuery<RawProduct[]>(CacheKeys.products, fetchProducts, {
    refreshEvents: ['products:refresh'],
  });
  const inventoriesQuery = useCachedQuery<RawInventory[]>(CacheKeys.inventories, fetchInventories, {
    refreshEvents: ['products:refresh'],
  });
  const categoriesQuery = useCachedQuery<RawCategory[]>(CacheKeys.categories, fetchCategories);

  const allProducts = productsQuery.data ?? [];
  const inventories = inventoriesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const [imageVersion, setImageVersion] = useState(() => Date.now());
  const [failedImageIds, setFailedImageIds] = useState<Set<number>>(new Set());

  // Add stock modal
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<RawProduct | null>(null);
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<RawProduct | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editCategoryId, setEditCategoryId] = useState<number | ''>('');
  const [editStock, setEditStock] = useState<number | ''>('');
  const [editIsStockable, setEditIsStockable] = useState(true);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editImageError, setEditImageError] = useState<string | null>(null);
  const [originalEditName, setOriginalEditName] = useState('');
  const [originalEditPrice, setOriginalEditPrice] = useState<number | ''>('');
  const [originalEditCategoryId, setOriginalEditCategoryId] = useState<number | ''>('');

  // Damage modal
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [damageCost, setDamageCost] = useState<number | ''>('');
  const [damageReason, setDamageReason] = useState('');
  const [damageAction, setDamageAction] = useState('write_off');
  const [damageSaving, setDamageSaving] = useState(false);
  const [damageError, setDamageError] = useState<string | null>(null);

  const stockMap = useMemo(() => buildStockMap(inventories), [inventories]);

  /** Refresh every consumer of product/stock data. */
  const notifyProductsChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent('products:refresh'));
    setImageVersion(Date.now());
  }, []);

  // Retry broken images shortly after they fail.
  useEffect(() => {
    if (failedImageIds.size === 0) return;
    const timer = setTimeout(() => setFailedImageIds(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [failedImageIds]);

  /** Bundles are unsellable when any ingredient has been archived. */
  const hasArchivedIngredient = useCallback(
    (product: RawProduct): boolean => {
      if (!product.is_bundle || !Array.isArray(product.bundle_items)) return false;
      return product.bundle_items.some((item: any) => {
        if (item.status === 'archived') return true;
        if (item.bundled_product?.status === 'archived') return true;
        const name = String(item.product_name ?? item.bundled_product?.product_name ?? '')
          .toLowerCase()
          .trim();
        if (!name) return false;
        const match = allProducts.find((candidate) => productName(candidate).toLowerCase().trim() === name);
        return match?.status === 'archived';
      });
    },
    [allProducts]
  );

  const rows = useMemo<StockRow[]>(() => {
    return allProducts
      .filter((product) => product.status !== 'archived')
      .map((product) => {
        const untracked = product.is_stockable === false || product.is_stockable === 0;
        const isBundle = Boolean(product.is_bundle);
        const stock = untracked || isBundle ? null : Number(stockMap[Number(product.id)] ?? 0);

        let statusLabel = 'Out of Stock';
        let statusTone: StatusTone = 'danger';

        if (isBundle && hasArchivedIngredient(product)) {
          statusLabel = 'Unavailable';
          statusTone = 'danger';
        } else if (untracked) {
          statusLabel = 'In Stock';
          statusTone = 'success';
        } else if (isBundle) {
          const bundleStock = Number(product.calculated_stock ?? 0);
          statusLabel = bundleStock > 10 ? 'In Stock' : bundleStock > 0 ? 'Low Stock' : 'Out of Stock';
          statusTone = bundleStock > 10 ? 'success' : bundleStock > 0 ? 'warning' : 'danger';
        } else {
          const quantity = Number(stock ?? 0);
          statusLabel = quantity > 10 ? 'In Stock' : quantity > 0 ? 'Low Stock' : 'Out of Stock';
          statusTone = quantity > 10 ? 'success' : quantity > 0 ? 'warning' : 'danger';
        }

        return {
          ...product,
          id: Number(product.id),
          displayName: productName(product),
          displayCategory: categoryLabel(product),
          image: productImage(product),
          stock,
          statusLabel,
          statusTone,
        };
      });
  }, [allProducts, stockMap, hasArchivedIngredient]);

  // ---------------------------------------------------------------- add stock

  const openAddStockModal = (product: RawProduct) => {
    setStockProduct(product);
    setStockQuantity(0);
    setStockError(null);
    setStockModalOpen(true);
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
    setStockProduct(null);
    setStockQuantity('');
    setStockError(null);
    setStockSaving(false);
  };

  const submitStock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stockProduct) return;
    const quantity = Number(stockQuantity);
    if (Number.isNaN(quantity) || quantity < 0) {
      setStockError('Quantity must be a non-negative number');
      return;
    }

    setStockSaving(true);
    setStockError(null);
    try {
      await api.post('/inventories', { product_id: stockProduct.id, quantity });
      notifyProductsChanged();
      await Swal.fire({
        title: 'Stock updated',
        text: `Added ${quantity} unit(s) to ${productName(stockProduct)}`,
        icon: 'success',
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
        willOpen: swalZIndex,
      });
      closeStockModal();
    } catch (error: any) {
      setStockError(error?.response?.data?.message || error.message || 'Failed to add stock');
    } finally {
      setStockSaving(false);
    }
  };

  // --------------------------------------------------------------------- edit

  const openEditModal = (product: RawProduct) => {
    const price = typeof product.price === 'number' ? product.price : Number(product.price) || '';
    const categoryId = (product.category as any)?.id ?? product.category_id ?? '';

    setEditProduct(product);
    setEditName(productName(product));
    setOriginalEditName(productName(product));
    setEditPrice(price);
    setOriginalEditPrice(price);
    setEditCategoryId(categoryId as number | '');
    setOriginalEditCategoryId(categoryId as number | '');
    // The stock field in this modal means "reduce by", so it starts at zero.
    setEditStock(0);
    setEditIsStockable(product.is_stockable !== false && product.is_stockable !== 0);
    setEditImageFile(null);
    setEditError(null);
    setEditImageError(null);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditProduct(null);
    setEditName('');
    setEditPrice('');
    setEditCategoryId('');
    setEditError(null);
    setEditImageError(null);
    setEditImageFile(null);
    setEditSaving(false);
  };

  /** Current on-hand total for a product, from the inventory rows. */
  const currentStockOf = (productId: number) =>
    inventories.reduce((total, inventory) => {
      const id = inventory.product_id ?? inventory.product?.id ?? inventory.productId ?? null;
      if (id === null || Number(id) !== Number(productId)) return total;
      return total + (Number(inventory.quantity ?? inventory.qty ?? inventory.amount ?? 0) || 0);
    }, 0);

  /**
   * Draw down `amount` units across the product's inventory rows, oldest first.
   * Returns the resulting total so callers can derive the product status.
   */
  const reduceInventory = async (productId: number, amount: number) => {
    const current = currentStockOf(productId);
    if (amount > current) throw new Error('Cannot decrease stock: reduction exceeds current stock');

    const rowsForProduct = inventories
      .filter((inventory) => {
        const id = inventory.product_id ?? inventory.product?.id ?? inventory.productId ?? null;
        return id !== null && Number(id) === Number(productId);
      })
      .sort((a, b) => (a.id || 0) - (b.id || 0));

    if (rowsForProduct.length === 0) {
      throw new Error('Cannot decrease stock: no inventory records to adjust');
    }

    const finalTotal = current - amount;
    const status = finalTotal > 10 ? 'in_stock' : finalTotal > 0 ? 'low_stock' : 'out_of_stock';

    let remaining = amount;
    for (const inventory of rowsForProduct) {
      if (remaining <= 0) break;
      const quantity = Number(inventory.quantity ?? inventory.qty ?? inventory.amount ?? 0) || 0;
      if (quantity <= 0) continue;
      const take = Math.min(quantity, remaining);
      await api.put(`/inventories/${inventory.id}`, {
        product_id: productId,
        quantity: quantity - take,
        status,
      });
      remaining -= take;
    }

    if (remaining > 0) throw new Error('Failed to fully reduce stock (unexpected)');
    return { finalTotal, status };
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editProduct) return;
    const id = Number(editProduct.id);

    if (!editName.trim()) {
      setEditError('Product name is required');
      return;
    }
    if (editPrice === '' || Number.isNaN(Number(editPrice))) {
      setEditError('Valid price is required');
      return;
    }
    if (editCategoryId === '' || editCategoryId === null) {
      setEditError('Category is required');
      return;
    }

    const duplicate = rows.some(
      (row) => row.id !== id && row.displayName.toLowerCase() === editName.trim().toLowerCase()
    );
    if (duplicate) {
      await Swal.fire({
        title: 'Product already exists',
        text: `A product named "${editName}" already exists. Please use a different name.`,
        icon: 'error',
        confirmButtonColor: '#ef4444',
        willOpen: swalZIndex,
      });
      return;
    }

    if (editImageFile && editImageFile.size > 25 * 1024 * 1024) {
      setEditError('Image is too large — maximum allowed size is 25 MB.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    setEditImageError(null);

    try {
      const reduceBy = editStock === '' ? 0 : Number(editStock);
      if (Number.isNaN(reduceBy) || reduceBy < 0) {
        throw new Error('Reduction amount must be a non-negative number');
      }

      let status: string;
      if (reduceBy > 0) {
        status = (await reduceInventory(id, reduceBy)).status;
      } else {
        const finalTotal = currentStockOf(id);
        status = finalTotal > 10 ? 'in_stock' : finalTotal > 0 ? 'low_stock' : 'out_of_stock';
      }

      const form = new FormData();
      form.append('product_name', String(editName));
      form.append('price', String(editPrice));
      form.append('category_id', String(editCategoryId));
      form.append('status', status);
      form.append('_method', 'PUT');
      if (editImageFile) form.append('image', editImageFile);

      try {
        await api.post(`/products/${id}`, form);
      } catch (error: any) {
        // Retry the image as base64 when the server could not write the upload.
        const response = error?.response;
        if (response?.status === 422 && editImageFile) {
          const data = normalizeErrorPayload(response.data);
          const imageError = String(
            Array.isArray(data?.errors?.image) ? data.errors.image.join('; ') : data?.errors?.image ?? ''
          ).toLowerCase();
          const serverMessage = String(data?.message ?? '').toLowerCase();
          const needsFallback =
            imageError.includes('failed to upload') ||
            imageError.includes('temporary') ||
            serverMessage.includes('failed to upload');

          if (needsFallback) {
            await api.post(`/products/${id}`, {
              product_name: String(editName),
              price: String(editPrice),
              category_id: String(editCategoryId),
              status,
              image_base64: await fileToDataUrl(editImageFile),
              _method: 'PUT',
            });
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      notifyProductsChanged();
      closeEditModal();
      await Swal.fire({
        title: 'Product updated',
        text: `${editName || 'Product'} was updated successfully.`,
        icon: 'success',
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
        willOpen: swalZIndex,
      });
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 422) {
        const data = normalizeErrorPayload(response.data);
        if (data?.errors?.image) {
          setEditImageError(
            Array.isArray(data.errors.image) ? data.errors.image.join('; ') : String(data.errors.image)
          );
          const others = { ...data.errors };
          delete others.image;
          const message = Object.values(others).flat().join('; ');
          if (message) setEditError(message);
        } else if (data?.errors) {
          setEditError(Object.values(data.errors).flat().join('; '));
        } else {
          setEditError(String(data?.message ?? 'Validation failed'));
        }
      } else {
        setEditError(response?.data?.message || error.message || String(error));
      }
    } finally {
      setEditSaving(false);
    }
  };

  // ------------------------------------------------------------------- damage

  const submitDamage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editProduct) return;

    const quantity = editStock === '' ? 0 : Number(editStock);
    setDamageError(null);

    if (quantity <= 0) {
      setDamageError('Quantity must be greater than 0');
      return;
    }
    if (!damageReason.trim()) {
      setDamageError('Damage reason is required');
      return;
    }

    setDamageSaving(true);
    try {
      await reduceInventory(Number(editProduct.id), quantity);

      const costPerUnit =
        damageCost !== '' ? Number(damageCost) : Number(editPrice) || 0;

      await api.post('/damages', {
        product_id: editProduct.id,
        quantity,
        cost_per_unit: costPerUnit,
        reason: damageReason,
        action_taken: damageAction,
      });

      await Swal.fire({
        title: 'Damage recorded',
        text: `${quantity} unit(s) recorded as damaged — total cost ${formatCurrency(
          costPerUnit * quantity
        )}`,
        icon: 'success',
        confirmButtonColor: '#465FFF',
        didOpen: () => {
          const container = document.querySelector('.swal2-container') as HTMLElement | null;
          if (container) container.style.zIndex = '300000';
        },
      });

      setDamageModalOpen(false);
      setDamageReason('');
      setDamageCost('');
      setDamageAction('write_off');
      closeEditModal();
      notifyProductsChanged();
    } catch (error: any) {
      setDamageError(error?.response?.data?.message || error?.message || 'Failed to record damage');
    } finally {
      setDamageSaving(false);
    }
  };

  // ------------------------------------------------------------------ archive

  const archiveProduct = async (product: StockRow) => {
    try {
      const result = await Swal.fire({
        title: 'Archive product?',
        text: `Archive "${product.displayName}"? You can restore it later.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Archive',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
        willOpen: swalZIndex,
      });
      if (!result.isConfirmed) return;

      await api.patch(`/products/${product.id}/archive`);
      notifyProductsChanged();

      await Swal.fire({
        title: 'Archived',
        text: `"${product.displayName}" has been archived.`,
        icon: 'success',
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true,
        willOpen: swalZIndex,
      });
    } catch (error: any) {
      await Swal.fire({
        title: 'Error',
        text: error?.response?.data?.message || error.message || 'Failed to archive product',
        icon: 'error',
        willOpen: swalZIndex,
      });
    }
  };

  // ------------------------------------------------------------------ columns

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Product',
        cell: ({ row }) => {
          const product = row.original;
          const source =
            product.image && !failedImageIds.has(product.id)
              ? `${product.image}${product.image.includes('?') ? '&' : '?'}v=${imageVersion}`
              : null;

          return (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                {source ? (
                  <img
                    key={`product-${product.id}-${imageVersion}`}
                    src={source}
                    alt={product.displayName}
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).onerror = null;
                      setFailedImageIds((current) => new Set(Array.from(current).concat([product.id])));
                    }}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-600">
                    <ImageOff className="h-4 w-4" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                  {product.displayName}
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {product.displayCategory}
                  {product.is_bundle ? ' · Combo' : ''}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'stock',
        header: 'Stock',
        cell: ({ row }) => {
          const { stock, is_bundle, calculated_stock } = row.original;
          if (is_bundle) {
            return (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {Number(calculated_stock ?? 0)}
              </span>
            );
          }
          if (stock === null) return <span className="text-sm text-gray-400">Untracked</span>;
          return (
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{stock}</span>
          );
        },
        meta: { align: 'center' },
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(row.original.price)}
          </span>
        ),
        meta: { align: 'right' },
      },
      {
        id: 'value',
        header: 'Stock value',
        cell: ({ row }) => {
          const { stock, price } = row.original;
          if (stock === null) return <span className="text-sm text-gray-400">—</span>;
          return (
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {formatCurrency(Number(price ?? 0) * stock)}
            </span>
          );
        },
        meta: { align: 'right', hideBelowMd: true },
      },
      {
        accessorKey: 'statusLabel',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={row.original.statusTone} dot>
            {row.original.statusLabel}
          </StatusPill>
        ),
        meta: { align: 'center' },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const product = row.original;
          const untracked = product.is_stockable === false || product.is_stockable === 0;
          const hasStock = Number(product.stock ?? 0) > 0;

          return (
            <div className="flex justify-end gap-1">
              <TableButton
                tooltip={untracked ? 'Non-stockable item' : 'Add stock'}
                ariaLabel="Add stock"
                onClick={() => openAddStockModal(product)}
                bgClass={
                  untracked
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-brand-500 hover:bg-brand-600'
                }
                disabled={untracked}
              >
                <PlusIcon className="h-4 w-4" />
              </TableButton>
              <TableButton
                tooltip="Edit product"
                ariaLabel="Edit product"
                onClick={() => openEditModal(product)}
                bgClass="bg-amber-500 hover:bg-amber-600"
              >
                <PencilIcon className="h-4 w-4" />
              </TableButton>
              {!product.is_bundle && (
                <TableButton
                  tooltip={hasStock ? 'Clear stock before archiving' : 'Archive product'}
                  ariaLabel="Archive product"
                  onClick={() => archiveProduct(product)}
                  bgClass={hasStock ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}
                  disabled={hasStock}
                >
                  <ArchiveIcon className="h-4 w-4" />
                </TableButton>
              )}
            </div>
          );
        },
        meta: { align: 'right' },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [failedImageIds, imageVersion, rows]
  );

  // --------------------------------------------------- notification highlight

  const highlightTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!highlightedProductId) return;
    const target = document.querySelector(`[data-product-id="${highlightedProductId}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    highlightTimer.current = window.setTimeout(() => setHighlightedProductId(null), 2500);
    return () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, [highlightedProductId, setHighlightedProductId]);

  const showSkeleton = useShowSkeleton(productsQuery.isInitialLoading);
  if (showSkeleton) return <SkeletonTable rows={6} columns={6} />;

  return (
    <>
      <DataTable<StockRow>
        data={rows}
        columns={columns}
        error={productsQuery.error}
        globalFilter={searchQuery}
        globalFilterFn={(row, needle) =>
          `${row.displayName} ${row.displayCategory} ${row.statusLabel}`
            .toLowerCase()
            .includes(needle.trim().toLowerCase())
        }
        initialSorting={[{ id: 'displayName', desc: false }]}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        itemLabel="products"
        minWidth={860}
        rowClassName={(row) =>
          highlightedProductId === row.id ? 'bg-amber-50 dark:bg-amber-500/10' : undefined
        }
        rowAttributes={(row) => ({ 'data-product-id': row.id })}
        emptyIcon={<PackageSearch className="h-7 w-7" />}
        emptyTitle={searchQuery ? 'No products match your search' : 'No products yet'}
        emptyDescription={
          searchQuery
            ? 'Try a different name or category.'
            : 'Add your first product to start tracking stock.'
        }
      />

      <AddStockModal
        isOpen={stockModalOpen}
        onClose={closeStockModal}
        product={stockProduct}
        quantity={stockQuantity}
        setQuantity={setStockQuantity}
        onSubmit={submitStock}
        saving={stockSaving}
        error={stockError}
      />

      <EditProductModal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        name={editName}
        setName={setEditName}
        price={editPrice}
        setPrice={setEditPrice}
        categoryId={editCategoryId}
        setCategoryId={setEditCategoryId}
        categories={categories}
        stock={editStock}
        setStock={setEditStock}
        isStockable={editIsStockable}
        imageFile={editImageFile}
        imageError={editImageError}
        setImageFile={setEditImageFile}
        onSubmit={submitEdit}
        saving={editSaving}
        error={editError}
        originalName={originalEditName}
        originalPrice={originalEditPrice}
        originalCategoryId={originalEditCategoryId}
        originalImageFile={null}
        onRecordDamage={() => {
          setEditModalOpen(false);
          setDamageModalOpen(true);
        }}
      />

      <DamageModal
        isOpen={damageModalOpen}
        onClose={() => setDamageModalOpen(false)}
        productName={editProduct ? productName(editProduct) : ''}
        productPrice={editPrice}
        quantity={editStock === '' ? 0 : Number(editStock)}
        reason={damageReason}
        setReason={setDamageReason}
        action={damageAction}
        setAction={setDamageAction}
        damageCost={damageCost}
        setDamageCost={setDamageCost}
        onSubmit={submitDamage}
        saving={damageSaving}
        error={damageError}
      />
    </>
  );
}

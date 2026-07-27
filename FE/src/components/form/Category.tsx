import { useState, useMemo } from "react";
import { FolderPlus, Layers, RefreshCw, Sparkles, Tag } from "lucide-react";
import PageMeta from "../common/PageMeta";
import PageHeader from "../common/PageHeader";
import ComponentCard from "../common/ComponentCard";
import StatCard from "../ui/card/StatCard";
import Button from "../ui/button/Button";
import Label from "./Label";
import Input from "./input/InputField";
import CategoryTable from "../tables/BasicTables/CategoryTable";
import { useCachedQuery } from "../../hooks/useCachedQuery";
import { useShowSkeleton } from "../../context/AppDataContext";
import { CacheKeys } from "../../lib/dataCache";
import { fetchCategories, fetchProducts, RawCategory, RawProduct } from "../../lib/apiResources";
import api from "../../lib/axios";
import Swal from 'sweetalert2';

export default function Category() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const categoriesQuery = useCachedQuery<RawCategory[]>(
    CacheKeys.categories,
    fetchCategories,
    { refreshEvents: ['categories:refresh'] }
  );

  const productsQuery = useCachedQuery<RawProduct[]>(
    CacheKeys.products,
    fetchProducts,
    { refreshEvents: ['products:refresh'] }
  );

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const showSkeleton = useShowSkeleton(categoriesQuery.isInitialLoading || productsQuery.isInitialLoading);

  // Compute category statistics for the redesigned header cards
  const stats = useMemo(() => {
    if (showSkeleton) return { total: 0, active: 0, topCategory: "—" };

    const total = categories.length;

    // Count how many categories have at least one product
    const active = categories.filter((cat) => {
      const catId = cat.id;
      const catName = cat.category_name || cat.name || "";
      return products.some(
        (p) =>
          (p.category_id && String(p.category_id) === String(catId)) ||
          (p.category_name && p.category_name.toLowerCase() === catName.toLowerCase())
      );
    }).length;

    // Find the category with the most products
    const productCounts: Record<string, number> = {};
    products.forEach((p) => {
      const catName = p.category_name || "Uncategorized";
      productCounts[catName] = (productCounts[catName] || 0) + 1;
    });

    let topCategory = "—";
    let maxCount = 0;
    Object.entries(productCounts).forEach(([catName, count]) => {
      if (count > maxCount && catName !== "Uncategorized") {
        maxCount = count;
        topCategory = catName;
      }
    });

    if (maxCount > 0) {
      topCategory = `${topCategory} (${maxCount} items)`;
    }

    return { total, active, topCategory };
  }, [categories, products, showSkeleton]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    
    // Check for duplicate category name
    const duplicateName = categories.some((cat) => {
      const catName = cat.category_name || cat.name || '';
      return catName.toLowerCase() === name.trim().toLowerCase();
    });
    
    if (duplicateName) {
      try {
        await Swal.fire({
          title: 'Category Already Exists',
          text: `A category named "${name.trim()}" already exists. Please use a different name.`,
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#ef4444',
          allowOutsideClick: true,
          willOpen: () => {
            const container = document.querySelector('.swal2-container') as HTMLElement | null;
            if (container) container.style.zIndex = '200000';
          }
        });
      } catch (e) {
        // ignore
      }
      return;
    }
    
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/categories", { category: name.trim() });
      const addedName = name.trim();
      setName("");
      
      // refresh categories query and notify other tables
      categoriesQuery.refresh();
      window.dispatchEvent(new CustomEvent("categories:refresh"));
      
      try {
        await Swal.fire({
          title: 'Category added',
          text: `${addedName} was added successfully.`,
          icon: 'success',
          showConfirmButton: false,
          timer: 1300,
          timerProgressBar: true,
          allowOutsideClick: true,
          willOpen: () => {
            const container = document.querySelector('.swal2-container') as HTMLElement | null;
            if (container) container.style.zIndex = '200000';
          }
        });
      } catch (e) {
        // ignore toast errors
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to add category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([categoriesQuery.refresh(), productsQuery.refresh()]);
    window.dispatchEvent(new CustomEvent("categories:refresh"));
  };

  return (
    <>
      <PageMeta title="Categories" />

      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Organize your product catalog into groups for POS filtering and reporting."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={categoriesQuery.isRefreshing || productsQuery.isRefreshing}
            startIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Top: Premium KPI Statistics Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Categories"
            tone="brand"
            icon={<Layers className="h-5 w-5" />}
            value={showSkeleton ? "..." : stats.total}
            hint="All groups in system"
          />
          <StatCard
            label="Active Categories"
            tone="success"
            icon={<Sparkles className="h-5 w-5" />}
            value={showSkeleton ? "..." : stats.active}
            hint="With active products"
          />
          <StatCard
            label="Top Category"
            tone="violet"
            icon={<Tag className="h-5 w-5" />}
            value={showSkeleton ? "..." : stats.topCategory}
            hint="Most catalog items"
          />
        </div>

        {/* Bottom split: form and categories list */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left form card */}
          <div className="lg:col-span-4">
            <ComponentCard 
              title="Add New Category" 
              desc="Enter a name to create a new product group."
            >
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="categoryName">Category Name</Label>
                  <div className="relative mt-1">
                    <Input
                      type="text"
                      id="categoryName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rice Meals, Drinks"
                      className="pr-10"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <Tag className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                  <Button
                    type="submit"
                    className="w-full justify-center"
                    loading={submitting}
                    disabled={!name.trim()}
                    startIcon={<FolderPlus className="h-4 w-4" />}
                  >
                    Add Category
                  </Button>
                </div>
              </form>
            </ComponentCard>
          </div>

          {/* Right list/table card */}
          <div className="lg:col-span-8">
            <ComponentCard 
              title="Manage Categories"
              desc="View, edit, and audit categories in the system."
            >
              <CategoryTable />
            </ComponentCard>
          </div>
        </div>
      </div>
    </>
  );
}

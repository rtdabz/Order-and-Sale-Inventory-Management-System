import { useState, useMemo } from "react";
import EditCategoryModal from "../../modals/EditCategoryModal";
import Swal from 'sweetalert2';
import TableButton from '../../ui/button/TableButton';
import { PencilIcon } from '../../../icons';
import { ColumnDef } from '@tanstack/react-table';
import DataTable from '../../ui/table/DataTable';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { useShowSkeleton } from '../../../context/AppDataContext';
import { CacheKeys } from '../../../lib/dataCache';
import { fetchCategories } from '../../../lib/apiResources';
import api from '../../../lib/axios';

type Category = {
  id?: number | string;
  category_name?: string;
  name?: string;
  category?: string;
  created_at?: string;
  products_count?: number;
};

export default function CategoryTable() {
  const { data, isInitialLoading, refresh } = useCachedQuery<Category[]>(
    CacheKeys.categories,
    fetchCategories as () => Promise<Category[]>,
    { refreshEvents: ['categories:refresh'] }
  );

  const categories = data ?? [];
  const showSkeleton = useShowSkeleton(isInitialLoading);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (c: Category) => {
    setEditingId(c.id !== undefined && c.id !== null ? Number(c.id) : null);
    setEditingName(c.category_name || c.name || c.category || '');
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditingName('');
    setSavingEdit(false);
    setError(null);
  };

  const submitEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingId) return;
    if (!editingName.trim()) return setError('Category name cannot be empty');
    
    const duplicateCategory = categories.find((cat) => {
      const catName = cat.category_name || cat.name || cat.category || '';
      const catId = cat.id !== undefined && cat.id !== null ? Number(cat.id) : null;
      return catId !== editingId && catName.toLowerCase() === editingName.trim().toLowerCase();
    });
    
    if (duplicateCategory) {
      try {
        await Swal.fire({
          title: 'Category Already Exists',
          text: `A category named "${editingName.trim()}" already exists. Please use a different name.`,
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
    
    setSavingEdit(true);
    try {
      await api.put(`/categories/${editingId}`, { category: editingName.trim() });
      refresh();
      window.dispatchEvent(new CustomEvent('categories:refresh'));
      try {
        await Swal.fire({
          title: 'Category updated',
          text: `${editingName} was updated successfully.`,
          icon: 'success',
          showConfirmButton: false,
          timer: 1200,
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

      closeEdit();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to update category');
    } finally {
      setSavingEdit(false);
    }
  };

  const columns = useMemo<ColumnDef<Category>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => row.original.id,
      meta: { align: 'left' },
    },
    {
      accessorKey: 'category_name',
      header: 'Category Name',
      cell: ({ row }) => row.original.category_name || row.original.name || row.original.category || '—',
      meta: { align: 'left' },
    },
    {
      accessorKey: 'products_count',
      header: 'Total Products',
      cell: ({ row }) => row.original.products_count ?? 0,
      meta: { align: 'center' },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : '—',
      meta: { align: 'center' },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex justify-center">
          <TableButton
            tooltip="Edit"
            ariaLabel="Edit"
            onClick={() => openEdit(row.original)}
            bgClass="bg-yellow-400 hover:bg-yellow-500"
          >
            <PencilIcon className="w-4 h-4 text-gray-800" />
          </TableButton>
        </div>
      ),
      meta: { align: 'center' },
    },
  ], [categories]);

  return (
    <div className="relative">
      <DataTable<Category>
        data={categories}
        columns={columns}
        loading={showSkeleton}
        itemLabel="categories"
        minWidth={500}
        emptyTitle="No categories found"
        emptyDescription="Add a new category on the left to start grouping products."
      />

      <EditCategoryModal
        isOpen={editingId !== null}
        onClose={closeEdit}
        name={editingName}
        setName={setEditingName}
        onSubmit={submitEdit}
        saving={savingEdit}
        error={error}
      />
    </div>
  );
}

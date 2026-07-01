'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Tag, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  X, 
  Loader2,
  Search 
} from 'lucide-react';
import { TableSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';
import { useConfirm } from '@/components/ModalProvider';
import { useDebounce } from '@/hooks/useDebounce';

interface CategoryData {
  _id: string;
  name: string;
  value: string;
  createdAt: string;
}

export default function CategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { confirm } = useConfirm();

  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  // Form States
  const [catName, setCatName] = useState('');
  const [catValue, setCatValue] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Edit Modal States
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');

  const isSuperadmin = session?.user?.role === 'superadmin';
  const hasAccess = isSuperadmin || !!session?.user?.permissions?.manageCategories;

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredCategories = debouncedSearch
    ? categories.filter(cat => {
        const q = debouncedSearch.toLowerCase();
        return (
          cat.name.toLowerCase().includes(q) ||
          cat.value.toLowerCase().includes(q)
        );
      })
    : categories;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login/admin');
      return;
    }

    if (status === 'authenticated' && !hasAccess) {
      router.push('/dashboard');
      return;
    }

    if (hasAccess) {
      fetchCategories();
    }
  }, [status, hasAccess, router]);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Auto-slugify category value from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCatName(val);
    setCatValue(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
  };

  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditName(val);
    setEditValue(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'));
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName, value: catValue }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('Category created successfully!');
        setCatName('');
        setCatValue('');
        fetchCategories();
      } else {
        throw new Error(data.error || 'Failed to create category');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCategory = (cat: CategoryData) => {
    setEditingCatId(cat._id);
    setEditName(cat.name);
    setEditValue(cat.value);
    setIsEditModalOpen(true);
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatId) return;

    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCatId, name: editName, value: editValue }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('Category updated successfully!');
        setIsEditModalOpen(false);
        setEditingCatId(null);
        fetchCategories();
      } else {
        throw new Error(data.error || 'Failed to update category');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const isConfirmed = await confirm(
      'Delete Category',
      `Are you sure you want to delete category "${name}"? Existing events using this category will still function, but you won't be able to filter by it easily.`
    );
    if (!isConfirmed) {
      return;
    }

    setActionId(id);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('Category deleted successfully!');
        fetchCategories();
      } else {
        throw new Error(data.error || 'Failed to delete category');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setActionId(null);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TableSkeleton rows={5} cols={3} />
          </div>
          <div className="h-64 bg-neutral-900/30 border border-neutral-900 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-50 flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary-500" /> Manage Event Categories
        </h1>
        <p className="text-neutral-400 text-sm mt-1">Configure the dynamic event categories available on the platform</p>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="bg-success-bg border border-success-border text-success-text p-4 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-error-bg border border-error-border text-error-text p-4 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories List */}
        <div className="lg:col-span-2 bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6 pb-4 border-b border-neutral-900 justify-between items-center">
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <h2 className="text-lg font-bold text-neutral-50">Category List</h2>
              <span className="badge badge-primary">{filteredCategories.length} categories</span>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari kategori..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-850 rounded-xl text-neutral-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-neutral-900 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-950/50 border-b border-neutral-900 text-neutral-400 text-xs uppercase font-medium">
                  <th className="px-6 py-4">Display Name</th>
                  <th className="px-6 py-4">Slug / Value</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((cat) => (
                    <tr key={cat._id} className="hover:bg-neutral-900/10 text-neutral-300">
                      <td className="px-6 py-4 font-semibold text-neutral-50">{cat.name}</td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-neutral-950 border border-neutral-900 px-2 py-1 rounded text-primary-400 font-mono">
                          {cat.value}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-xs text-neutral-500">
                        {new Date(cat.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEditCategory(cat)}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 rounded-lg transition"
                            title="Edit Category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat._id, cat.name)}
                            disabled={actionId === cat._id}
                            className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-lg transition disabled:opacity-50"
                            title="Delete Category"
                          >
                            {actionId === cat._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-neutral-500 text-sm">
                      No categories found in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Category Form */}
        <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-6 h-fit">
          <div className="mb-6 border-b border-neutral-900 pb-4">
            <h2 className="text-xl font-bold text-neutral-50 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-400" /> Add Category
            </h2>
          </div>

          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Display Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
                placeholder="e.g. Birthday Party"
                value={catName}
                onChange={handleNameChange}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Slug / Value
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200 font-mono text-primary-400"
                placeholder="e.g. birthday-party"
                value={catValue}
                onChange={(e) => setCatValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full mt-4 rounded-xl py-3 shadow-lg shadow-primary-500/25 text-sm font-semibold flex items-center justify-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Category
            </button>
          </form>
        </div>
      </div>

      {/* Edit Category Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingCatId(null);
              }}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-neutral-50 mb-6 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary-400" /> Edit Category
            </h3>

            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200"
                  value={editName}
                  onChange={handleEditNameChange}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Slug / Value
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-900 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition duration-200 font-mono text-primary-400"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-secondary flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCatId(null);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

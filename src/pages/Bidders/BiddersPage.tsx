import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';

export function BiddersPage() {
  const { canEdit, isAdmin } = useAuth();
  const [bidders, setBidders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bidder_id: '',
    company_name: '',
    company_director: '',
    phone_number: '',
    tax_identification_number: '',
    address: '',
    status: 'active',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBidders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bidders', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
        },
      });
      if (res.data.success) {
        setBidders(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch bidders error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBidders();
  }, [pagination.page, searchTerm]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({
      bidder_id: `BDR-00${bidders.length + 1}`,
      company_name: '',
      company_director: '',
      phone_number: '',
      tax_identification_number: '',
      address: '',
      status: 'active',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    setModalMode('edit');
    setEditingId(row.bidder_id);
    setFormData({
      bidder_id: row.bidder_id,
      company_name: row.company_name,
      company_director: row.company_director || '',
      phone_number: row.phone_number || '',
      tax_identification_number: row.tax_identification_number || '',
      address: row.address || '',
      status: row.status || 'active',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.company_name.trim()) {
      setFormError('សូមបញ្ចូលឈ្មោះក្រុមហ៊ុន');
      return;
    }

    try {
      if (modalMode === 'create') {
        const res = await api.post('/bidders', formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchBidders();
        }
      } else {
        const res = await api.put(`/bidders/${editingId}`, formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchBidders();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់លុបក្រុមហ៊ុន "${row.company_name}" នេះមែនទេ?`)) return;
    try {
      const res = await api.delete(`/bidders/${row.bidder_id}`);
      if (res.data.success) {
        fetchBidders();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'មិនអាចលុបក្រុមហ៊ុនបានទេ');
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'no',
      header: 'ល.រ',
      className: 'w-12 text-center text-slate-400 font-mono',
      render: (_, idx) => (pagination.page - 1) * pagination.limit + idx + 1,
    },
    {
      key: 'bidder_id',
      header: 'លេខកូដក្រុមហ៊ុន',
      className: 'font-mono font-bold text-blue-600 w-28',
    },
    {
      key: 'company_name',
      header: 'ឈ្មោះក្រុមហ៊ុន',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800">{row.company_name}</div>
          {row.address && <div className="text-[11px] text-slate-400 truncate max-w-xs">{row.address}</div>}
        </div>
      ),
    },
    {
      key: 'company_director',
      header: 'នាយក / តំណាងក្រុមហ៊ុន',
      className: 'text-slate-700',
    },
    {
      key: 'phone_number',
      header: 'លេខទូរស័ព្ទ',
      className: 'font-mono text-slate-600',
    },
    {
      key: 'tax_identification_number',
      header: 'លេខអត្តសញ្ញាណកម្មសារពើពន្ធ (TIN)',
      className: 'font-mono text-slate-700 font-medium',
    },
    {
      key: 'status',
      header: 'ស្ថានភាព',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="ក្រុមហ៊ុនដាក់សំណើដេញថ្លៃ (Bidders)"
        subtitle="បញ្ជីក្រុមហ៊ុនឯកជន នាយកក្រុមហ៊ុន លេខសារពើពន្ធ និងព័ត៌មានទំនាក់ទំនង"
        columns={columns}
        data={bidders}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមឈ្មោះក្រុមហ៊ុន, នាយក, ឬលេខ TIN..."
        onRefresh={fetchBidders}
        onAdd={handleOpenCreate}
        addLabel="ចុះបញ្ជីក្រុមហ៊ុនថ្មី"
        canAdd={canEdit}
        canEdit={canEdit}
        canDelete={isAdmin}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Bidders"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'ចុះបញ្ជីក្រុមហ៊ុនដេញថ្លៃថ្មី' : 'កែប្រែព័ត៌មានក្រុមហ៊ុន'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                លេខកូដក្រុមហ៊ុន (Bidder ID)
              </label>
              <input
                type="text"
                disabled={modalMode === 'edit'}
                value={formData.bidder_id}
                onChange={(e) => setFormData({ ...formData, bidder_id: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ស្ថានភាពក្រុមហ៊ុន
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              >
                <option value="active">សកម្ម (Active)</option>
                <option value="inactive">អសកម្ម (Inactive)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ឈ្មោះក្រុមហ៊ុន <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="ឧ. ក្រុមហ៊ុន អង្គរ ខនស្ត្រាក់សិន ឯ.ក..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                នាយក / តំណាងក្រុមហ៊ុន
              </label>
              <input
                type="text"
                value={formData.company_director}
                onChange={(e) => setFormData({ ...formData, company_director: e.target.value })}
                placeholder="ឧ. លោក ជា សុខេង"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">លេខទូរស័ព្ទ</label>
              <input
                type="text"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="ឧ. 012 889 977"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              លេខអត្តសញ្ញាណកម្មសារពើពន្ធ (TIN)
            </label>
            <input
              type="text"
              value={formData.tax_identification_number}
              onChange={(e) => setFormData({ ...formData, tax_identification_number: e.target.value })}
              placeholder="ឧ. K002-901827361"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">អាសយដ្ឋានក្រុមហ៊ុន</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="រាជធានីភ្នំពេញ ឬខេត្ត..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="pt-4 border-t flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              {modalMode === 'create' ? 'រក្សាទុក' : 'កែប្រែ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

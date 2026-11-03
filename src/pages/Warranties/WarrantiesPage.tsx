import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatDate } from '../../utils/formatters.js';

export function WarrantiesPage() {
  const { canEdit, isAdmin } = useAuth();
  const [warranties, setWarranties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    project_id: '',
    existing_handover_date: '',
    handover_date: new Date().toISOString().substring(0, 10),
    warranty_period_days: '365',
    expired_years: '2026',
    expired_date: '',
    status: 'កំពុងធានា',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchWarranties = async () => {
    setLoading(true);
    try {
      const res = await api.get('/warranties', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          status: statusFilter,
        },
      });
      if (res.data.success) {
        setWarranties(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch warranties error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarranties();
  }, [pagination.page, searchTerm, statusFilter]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({
      project_id: '',
      existing_handover_date: '',
      handover_date: new Date().toISOString().substring(0, 10),
      warranty_period_days: '365',
      expired_years: '2026',
      expired_date: '',
      status: 'កំពុងធានា',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    setModalMode('edit');
    setEditingId(row.warranty_id);
    setFormData({
      project_id: row.project_id,
      existing_handover_date: row.existing_handover_date || '',
      handover_date: row.handover_date || '',
      warranty_period_days: String(row.warranty_period_days || '365'),
      expired_years: String(row.expired_years || '2026'),
      expired_date: row.expired_date || '',
      status: row.status || 'កំពុងធានា',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.project_id.trim()) {
      setFormError('សូមបញ្ចូលលេខគម្រោង (Project ID is required)');
      return;
    }

    try {
      if (modalMode === 'create') {
        const res = await api.post('/warranties', formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchWarranties();
        }
      } else {
        const res = await api.put(`/warranties/${editingId}`, formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchWarranties();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់លុបកំណត់ត្រាធានាលេខ "${row.warranty_id}" មែនទេ?`)) return;
    try {
      const res = await api.delete(`/warranties/${row.warranty_id}`);
      if (res.data.success) {
        fetchWarranties();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'មិនអាចលុបបានទេ');
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
      key: 'project_id',
      header: 'លេខគម្រោង',
      className: 'font-mono font-bold text-blue-600 w-28',
    },
    {
      key: 'project_title',
      header: 'ឈ្មោះគម្រោង',
      className: 'font-medium text-slate-800',
    },
    {
      key: 'handover_date',
      header: 'កាលបរិច្ឆេទប្រគល់-ទទួល',
      render: (row) => <span className="font-mono text-slate-600">{formatDate(row.handover_date)}</span>,
    },
    {
      key: 'warranty_period_days',
      header: 'រយៈពេលធានា',
      className: 'text-center font-mono',
      render: (row) => `${row.warranty_period_days || 0} ថ្ងៃ`,
    },
    {
      key: 'expired_date',
      header: 'កាលបរិច្ឆេទផុតកំណត់',
      render: (row) => <span className="font-mono text-slate-700 font-medium">{formatDate(row.expired_date)}</span>,
    },
    {
      key: 'calculated_remaining_days',
      header: 'ថ្ងៃនៅសល់',
      className: 'text-center font-mono',
      render: (row) =>
        row.calculated_remaining_days > 0 ? (
          <span className="text-emerald-700 font-semibold">{row.calculated_remaining_days} ថ្ងៃ</span>
        ) : (
          <span className="text-rose-600 font-bold">ផុត {row.calculated_expired_days} ថ្ងៃ</span>
        ),
    },
    {
      key: 'status',
      header: 'ស្ថានភាពការធានា',
      render: (row) => <StatusBadge status={row.calculated_status || row.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="ការធានាគម្រោង (Warranties)"
        subtitle="តាមដានកាលបរិច្ឆេទផុតកំណត់ រយៈពេលនៅសល់ និងការធានាគុណភាពសំណង់/បរិក្ខារ"
        columns={columns}
        data={warranties}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមលេខ ឬឈ្មោះគម្រោង..."
        onRefresh={fetchWarranties}
        onAdd={handleOpenCreate}
        addLabel="កត់ត្រាការធានាថ្មី"
        canAdd={canEdit}
        canEdit={canEdit}
        canDelete={isAdmin}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Warranties"
        filters={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
          >
            <option value="">គ្រប់ស្ថានភាព</option>
            <option value="កំពុងធានា">កំពុងធានា</option>
            <option value="ជិតផុតកំណត់">ជិតផុតកំណត់</option>
            <option value="ផុតកំណត់">ផុតកំណត់</option>
          </select>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'កត់ត្រាការធានាថ្មី' : 'កែប្រែការធានា'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              លេខគម្រោង (Project ID) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={modalMode === 'edit'}
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              placeholder="ឧ. PRJ-001"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទប្រគល់-ទទួល</label>
              <input
                type="date"
                value={formData.handover_date}
                onChange={(e) => setFormData({ ...formData, handover_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">រយៈពេលធានា (ថ្ងៃ)</label>
              <input
                type="number"
                value={formData.warranty_period_days}
                onChange={(e) => setFormData({ ...formData, warranty_period_days: e.target.value })}
                placeholder="ឧ. 365"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទផុតកំណត់</label>
              <input
                type="date"
                value={formData.expired_date}
                onChange={(e) => setFormData({ ...formData, expired_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ស្ថានភាព</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="កំពុងធានា">កំពុងធានា</option>
                <option value="ជិតផុតកំណត់">ជិតផុតកំណត់</option>
                <option value="ផុតកំណត់">ផុតកំណត់</option>
              </select>
            </div>
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

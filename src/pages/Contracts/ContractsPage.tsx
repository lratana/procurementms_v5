import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatUSD, formatDate } from '../../utils/formatters.js';

export function ContractsPage() {
  const { canEdit, isAdmin } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    project_id: '',
    contract_submit_mef: '',
    contract_amount: '',
    approval_date: '',
    end_date: '',
    contract_validity: '180',
    expiry_days: '0',
    status: 'កំពុងអនុវត្ត',
    handover: 'មិនទាន់ប្រគល់',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contracts', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          status: statusFilter,
        },
      });
      if (res.data.success) {
        setContracts(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch contracts error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [pagination.page, searchTerm, statusFilter]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({
      project_id: '',
      contract_submit_mef: '',
      contract_amount: '',
      approval_date: new Date().toISOString().substring(0, 10),
      end_date: '',
      contract_validity: '180',
      expiry_days: '0',
      status: 'កំពុងអនុវត្ត',
      handover: 'មិនទាន់ប្រគល់',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    setModalMode('edit');
    setEditingId(row.contract_id);
    setFormData({
      project_id: row.project_id,
      contract_submit_mef: row.contract_submit_mef || '',
      contract_amount: String(row.contract_amount || ''),
      approval_date: row.approval_date || '',
      end_date: row.end_date || '',
      contract_validity: String(row.contract_validity || '180'),
      expiry_days: String(row.expiry_days || '0'),
      status: row.status || 'កំពុងអនុវត្ត',
      handover: row.handover || 'មិនទាន់ប្រគល់',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.project_id.trim()) {
      setFormError('សូមជ្រើសរើសលេខគម្រោង (Project ID is required)');
      return;
    }

    try {
      if (modalMode === 'create') {
        const res = await api.post('/contracts', formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchContracts();
        }
      } else {
        const res = await api.put(`/contracts/${editingId}`, formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchContracts();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់លុបកិច្ចសន្យាលេខ "${row.contract_id}" នេះមែនទេ?`)) return;
    try {
      const res = await api.delete(`/contracts/${row.contract_id}`);
      if (res.data.success) {
        fetchContracts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'មិនអាចលុបកិច្ចសន្យាបានទេ');
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
      key: 'contract_amount',
      header: 'ទឹកប្រាក់កិច្ចសន្យា',
      className: 'text-right font-mono font-bold text-slate-900',
      render: (row) => formatUSD(row.contract_amount),
    },
    {
      key: 'approval_date',
      header: 'កាលបរិច្ឆេទអនុម័ត',
      render: (row) => <span className="font-mono text-slate-500">{formatDate(row.approval_date)}</span>,
    },
    {
      key: 'end_date',
      header: 'កាលបរិច្ឆេទបញ្ចប់',
      render: (row) => <span className="font-mono text-slate-700 font-medium">{formatDate(row.end_date)}</span>,
    },
    {
      key: 'contract_validity',
      header: 'សុពលភាព',
      className: 'text-center font-mono',
      render: (row) => `${row.contract_validity || 0} ថ្ងៃ`,
    },
    {
      key: 'calculated_remaining_days',
      header: 'ថ្ងៃនៅសល់',
      className: 'text-center font-mono font-semibold',
      render: (row) =>
        row.calculated_remaining_days > 0 ? (
          <span className="text-emerald-700">{row.calculated_remaining_days} ថ្ងៃ</span>
        ) : (
          <span className="text-rose-600 font-bold">ហួស {row.calculated_expired_days} ថ្ងៃ</span>
        ),
    },
    {
      key: 'status',
      header: 'ស្ថានភាព',
      render: (row) => <StatusBadge status={row.calculated_status || row.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="កិច្ចសន្យាលទ្ធកម្ម (Procurement Contracts)"
        subtitle="គ្រប់គ្រងទំហំទឹកប្រាក់កិច្ចសន្យា កាលបរិច្ឆេទអនុវត្ត និងការរាប់ថយក្រោយនៃសុពលភាព"
        columns={columns}
        data={contracts}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមលេខ ឬឈ្មោះគម្រោង..."
        onRefresh={fetchContracts}
        onAdd={handleOpenCreate}
        addLabel="បង្កើតកិច្ចសន្យាថ្មី"
        canAdd={canEdit}
        canEdit={canEdit}
        canDelete={isAdmin}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Contracts"
        filters={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
          >
            <option value="">គ្រប់ស្ថានភាព</option>
            <option value="កំពុងអនុវត្ត">កំពុងអនុវត្ត</option>
            <option value="បានបញ្ចប់">បានបញ្ចប់</option>
            <option value="ផុតកំណត់">ផុតកំណត់</option>
          </select>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'បង្កើតកិច្ចសន្យាថ្មី' : 'កែប្រែកិច្ចសន្យា'}
        maxWidth="lg"
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ទឹកប្រាក់កិច្ចសន្យា ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.contract_amount}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                placeholder="ឧ. 7450.00"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទដាក់ MEF</label>
              <input
                type="date"
                value={formData.contract_submit_mef}
                onChange={(e) => setFormData({ ...formData, contract_submit_mef: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទអនុម័តកិច្ចសន្យា</label>
              <input
                type="date"
                value={formData.approval_date}
                onChange={(e) => setFormData({ ...formData, approval_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទបញ្ចប់កិច្ចសន្យា</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">សុពលភាព (ថ្ងៃ)</label>
              <input
                type="number"
                value={formData.contract_validity}
                onChange={(e) => setFormData({ ...formData, contract_validity: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ស្ថានភាពកិច្ចសន្យា</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="កំពុងអនុវត្ត">កំពុងអនុវត្ត</option>
                <option value="បានបញ្ចប់">បានបញ្ចប់</option>
                <option value="ផុតកំណត់">ផុតកំណត់</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ដំណាក់កាលប្រគល់</label>
              <input
                type="text"
                value={formData.handover}
                onChange={(e) => setFormData({ ...formData, handover: e.target.value })}
                placeholder="ឧ. ដំណាក់កាលទី៣ ឬ ប្រគល់រួចរាល់"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
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

import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatUSD, formatDate } from '../../utils/formatters.js';

export function ProjectRequestsPage() {
  const { canEdit, isAdmin } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    project_id: '',
    request_date: new Date().toISOString().substring(0, 10),
    fiscal_year: '2024',
    request_amount: '',
    approval_date: '',
    approved_amount: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/project-requests', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          fiscal_year: fiscalYear,
        },
      });
      if (res.data.success) {
        setRequests(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [pagination.page, searchTerm, fiscalYear]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({
      project_id: '',
      request_date: new Date().toISOString().substring(0, 10),
      fiscal_year: '2024',
      request_amount: '',
      approval_date: '',
      approved_amount: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    setModalMode('edit');
    setEditingId(row.request_id);
    setFormData({
      project_id: row.project_id,
      request_date: row.request_date || '',
      fiscal_year: String(row.fiscal_year || '2024'),
      request_amount: String(row.request_amount || ''),
      approval_date: row.approval_date || '',
      approved_amount: String(row.approved_amount || ''),
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
        const res = await api.post('/project-requests', formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchRequests();
        }
      } else {
        const res = await api.put(`/project-requests/${editingId}`, formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchRequests();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់លុបសំណើគម្រោង "${row.project_id}" នេះមែនទេ?`)) return;
    try {
      const res = await api.delete(`/project-requests/${row.request_id}`);
      if (res.data.success) {
        fetchRequests();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'មិនអាចលុបសំណើគម្រោងបានទេ');
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
      key: 'request_date',
      header: 'កាលបរិច្ឆេទសំណើ',
      render: (row) => <span className="font-mono text-slate-500">{formatDate(row.request_date)}</span>,
    },
    {
      key: 'fiscal_year',
      header: 'ឆ្នាំថវិកា',
      className: 'text-center font-mono',
    },
    {
      key: 'request_amount',
      header: 'ទឹកប្រាក់ស្នើសុំ',
      className: 'text-right font-mono font-semibold text-slate-800',
      render: (row) => formatUSD(row.request_amount),
    },
    {
      key: 'approval_date',
      header: 'កាលបរិច្ឆេទអនុម័ត',
      render: (row) => <span className="font-mono text-slate-500">{formatDate(row.approval_date)}</span>,
    },
    {
      key: 'approved_amount',
      header: 'ទឹកប្រាក់អនុម័ត',
      className: 'text-right font-mono font-bold text-emerald-700',
      render: (row) => formatUSD(row.approved_amount),
    },
    {
      key: 'difference',
      header: 'គម្លាតទឹកប្រាក់ (Difference)',
      className: 'text-right font-mono font-semibold text-blue-700',
      render: (row) => formatUSD(row.difference),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="សំណើគម្រោង (Project Requests)"
        subtitle="តាមដានការស្នើសុំកញ្ចប់ថវិកា ការអនុម័ត និងគម្លាតទឹកប្រាក់លទ្ធកម្ម"
        columns={columns}
        data={requests}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមលេខ ឬឈ្មោះគម្រោង..."
        onRefresh={fetchRequests}
        onAdd={handleOpenCreate}
        addLabel="បង្កើតសំណើថ្មី"
        canAdd={canEdit}
        canEdit={canEdit}
        canDelete={isAdmin}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Requests"
        filters={
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
          >
            <option value="">គ្រប់ឆ្នាំថវិកា</option>
            <option value="2026">២០២៦</option>
            <option value="2025">២០២៥</option>
            <option value="2024">២០២៤</option>
            <option value="2023">២០២៣</option>
          </select>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'បង្កើតសំណើគម្រោងថ្មី' : 'កែប្រែសំណើគម្រោង'}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">ឆ្នាំថវិកា</label>
              <input
                type="number"
                value={formData.fiscal_year}
                onChange={(e) => setFormData({ ...formData, fiscal_year: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទសំណើ</label>
              <input
                type="date"
                value={formData.request_date}
                onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ទឹកប្រាក់ស្នើសុំ ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.request_amount}
                onChange={(e) => setFormData({ ...formData, request_amount: e.target.value })}
                placeholder="ឧ. 7575.33"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទអនុម័ត</label>
              <input
                type="date"
                value={formData.approval_date}
                onChange={(e) => setFormData({ ...formData, approval_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ទឹកប្រាក់អនុម័ត ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.approved_amount}
                onChange={(e) => setFormData({ ...formData, approved_amount: e.target.value })}
                placeholder="ឧ. 7500.00"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
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

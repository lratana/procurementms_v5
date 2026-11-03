import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatDate } from '../../utils/formatters.js';

export function BiddingPage() {
  const { canEdit, isAdmin } = useAuth();
  const [biddings, setBiddings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    project_id: '',
    prepare_bid: '',
    moh_approval: '',
    mef_submit: '',
    mef_approval: '',
    advertise_date: '',
    bid_opening: '',
    validity_days: '90',
    expiry_days: '30',
    valid_until: '',
    status: 'កំពុងមានសុពលភាព',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBiddings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bidding', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          status: statusFilter,
        },
      });
      if (res.data.success) {
        setBiddings(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch biddings error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBiddings();
  }, [pagination.page, searchTerm, statusFilter]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({
      project_id: '',
      prepare_bid: new Date().toISOString().substring(0, 10),
      moh_approval: '',
      mef_submit: '',
      mef_approval: '',
      advertise_date: '',
      bid_opening: '',
      validity_days: '90',
      expiry_days: '30',
      valid_until: '',
      status: 'កំពុងមានសុពលភាព',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    setModalMode('edit');
    setEditingId(row.bid_process_id);
    setFormData({
      project_id: row.project_id,
      prepare_bid: row.prepare_bid || '',
      moh_approval: row.moh_approval || '',
      mef_submit: row.mef_submit || '',
      mef_approval: row.mef_approval || '',
      advertise_date: row.advertise_date || '',
      bid_opening: row.bid_opening || '',
      validity_days: String(row.validity_days || '90'),
      expiry_days: String(row.expiry_days || '30'),
      valid_until: row.valid_until || '',
      status: row.status || 'កំពុងមានសុពលភាព',
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
        const res = await api.post('/bidding', formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchBiddings();
        }
      } else {
        const res = await api.put(`/bidding/${editingId}`, formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchBiddings();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់លុបដំណើរការដេញថ្លៃគម្រោង "${row.project_id}" នេះមែនទេ?`)) return;
    try {
      const res = await api.delete(`/bidding/${row.bid_process_id}`);
      if (res.data.success) {
        fetchBiddings();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'មិនអាចលុបដំណើរការដេញថ្លៃបានទេ');
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
      key: 'moh_approval',
      header: 'MOH អនុម័ត',
      render: (row) => <span className="font-mono text-slate-500">{formatDate(row.moh_approval)}</span>,
    },
    {
      key: 'mef_approval',
      header: 'MEF អនុម័ត',
      render: (row) => <span className="font-mono text-slate-500">{formatDate(row.mef_approval)}</span>,
    },
    {
      key: 'bid_opening',
      header: 'បើកសំណើ',
      render: (row) => <span className="font-mono text-slate-700 font-medium">{formatDate(row.bid_opening)}</span>,
    },
    {
      key: 'validity_days',
      header: 'សុពលភាព',
      className: 'text-center font-mono',
      render: (row) => `${row.validity_days || 0} ថ្ងៃ`,
    },
    {
      key: 'valid_until',
      header: 'ផុតកំណត់នៅ',
      render: (row) => <span className="font-mono text-slate-700">{formatDate(row.valid_until)}</span>,
    },
    {
      key: 'status',
      header: 'ស្ថានភាព',
      render: (row) => <StatusBadge status={row.calculated_status || row.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Visual Stepper Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          ដំណាក់កាលនៃដំណើរការដេញថ្លៃ (Bidding Workflow Stepper)
        </div>
        <div className="flex flex-wrap items-center justify-between text-xs font-semibold text-slate-600 gap-2">
          <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
            <span>១. រៀបចំឯកសារ</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
            <span>២. MOH អនុម័ត</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
            <span>៣. MEF ដាក់សំណើ</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
            <span>៤. MEF អនុម័ត</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200">
            <span>៥. ផ្សព្វផ្សាយ</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 font-bold">
            <span>៦. បើកសំណើដេញថ្លៃ</span>
          </div>
        </div>
      </div>

      <DataTable
        title="ដំណើរការដេញថ្លៃ (Bidding Process)"
        subtitle="តាមដានកាលបរិច្ឆេទ ដំណាក់កាលអនុម័ត និងសុពលភាពនៃការដេញថ្លៃ"
        columns={columns}
        data={biddings}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមលេខ ឬឈ្មោះគម្រោង..."
        onRefresh={fetchBiddings}
        onAdd={handleOpenCreate}
        addLabel="បង្កើតការដេញថ្លៃ"
        canAdd={canEdit}
        canEdit={canEdit}
        canDelete={isAdmin}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Bidding"
        filters={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
          >
            <option value="">គ្រប់ស្ថានភាព</option>
            <option value="កំពុងមានសុពលភាព">កំពុងមានសុពលភាព</option>
            <option value="ផុតកំណត់">ផុតកំណត់</option>
          </select>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'បង្កើតដំណើរការដេញថ្លៃថ្មី' : 'កែប្រែដំណើរការដេញថ្លៃ'}
        maxWidth="xl"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទរៀបចំឯកសារ</label>
              <input
                type="date"
                value={formData.prepare_bid}
                onChange={(e) => setFormData({ ...formData, prepare_bid: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទ MOH អនុម័ត</label>
              <input
                type="date"
                value={formData.moh_approval}
                onChange={(e) => setFormData({ ...formData, moh_approval: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទដាក់ជូន MEF</label>
              <input
                type="date"
                value={formData.mef_submit}
                onChange={(e) => setFormData({ ...formData, mef_submit: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទ MEF អនុម័ត</label>
              <input
                type="date"
                value={formData.mef_approval}
                onChange={(e) => setFormData({ ...formData, mef_approval: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទផ្សព្វផ្សាយ</label>
              <input
                type="date"
                value={formData.advertise_date}
                onChange={(e) => setFormData({ ...formData, advertise_date: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">កាលបរិច្ឆេទបើកសំណើដេញថ្លៃ</label>
              <input
                type="date"
                value={formData.bid_opening}
                onChange={(e) => setFormData({ ...formData, bid_opening: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ចំនួនថ្ងៃសុពលភាព</label>
              <input
                type="number"
                value={formData.validity_days}
                onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">សុពលភាពរហូតដល់</label>
              <input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
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
                <option value="កំពុងមានសុពលភាព">កំពុងមានសុពលភាព</option>
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

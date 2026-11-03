import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatUSD } from '../../utils/formatters.js';

export function HandoversPage() {
  const { canEdit, isAdmin } = useAuth();
  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    handover_id: '',
    project_id: '',
    contract_amount: '',
    handover_amount: '',
    stage_1: '',
    stage_2: '',
    stage_3: '',
    stage_4: '',
    progress_percent: '0',
    handover_status: 'កំពុងដំណើរការ',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchHandovers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/handovers', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          status: statusFilter,
        },
      });
      if (res.data.success) {
        setHandovers(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch handovers error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHandovers();
  }, [pagination.page, searchTerm, statusFilter]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({
      handover_id: `HND-00${handovers.length + 1}`,
      project_id: '',
      contract_amount: '',
      handover_amount: '',
      stage_1: '0',
      stage_2: '0',
      stage_3: '0',
      stage_4: '0',
      progress_percent: '0',
      handover_status: 'កំពុងដំណើរការ',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: any) => {
    setModalMode('edit');
    setEditingId(row.handover_id);
    setFormData({
      handover_id: row.handover_id,
      project_id: row.project_id,
      contract_amount: String(row.contract_amount || ''),
      handover_amount: String(row.handover_amount || ''),
      stage_1: String(row.stage_1 || '0'),
      stage_2: String(row.stage_2 || '0'),
      stage_3: String(row.stage_3 || '0'),
      stage_4: String(row.stage_4 || '0'),
      progress_percent: String(row.progress_percent || '0'),
      handover_status: row.handover_status || 'កំពុងដំណើរការ',
      notes: row.notes || '',
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
        const res = await api.post('/handovers', formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchHandovers();
        }
      } else {
        const res = await api.put(`/handovers/${editingId}`, formData);
        if (res.data.success) {
          setIsModalOpen(false);
          fetchHandovers();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់លុបកំណត់ត្រាប្រគល់-ទទួលលេខ "${row.handover_id}" មែនទេ?`)) return;
    try {
      const res = await api.delete(`/handovers/${row.handover_id}`);
      if (res.data.success) {
        fetchHandovers();
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
      key: 'handover_id',
      header: 'លេខកូដ',
      className: 'font-mono font-bold text-blue-600 w-24',
    },
    {
      key: 'project_id',
      header: 'លេខគម្រោង',
      className: 'font-mono font-semibold text-slate-800 w-28',
    },
    {
      key: 'project_title',
      header: 'ឈ្មោះគម្រោង',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row.project_title}</div>
          {row.notes && <div className="text-[11px] text-slate-400 truncate max-w-sm">{row.notes}</div>}
        </div>
      ),
    },
    {
      key: 'contract_amount',
      header: 'ទឹកប្រាក់កិច្ចសន្យា',
      className: 'text-right font-mono font-semibold text-slate-700',
      render: (row) => formatUSD(row.contract_amount),
    },
    {
      key: 'handover_amount',
      header: 'ទឹកប្រាក់ប្រគល់-ទទួល',
      className: 'text-right font-mono font-bold text-blue-700',
      render: (row) => formatUSD(row.handover_amount),
    },
    {
      key: 'progress_percent',
      header: 'វឌ្ឍនភាពការងារ',
      className: 'w-36',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="font-semibold">{row.progress_percent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                row.progress_percent >= 100
                  ? 'bg-emerald-500'
                  : row.progress_percent > 0
                  ? 'bg-blue-600'
                  : 'bg-slate-300'
              }`}
              style={{ width: `${row.progress_percent}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'handover_status',
      header: 'ស្ថានភាព',
      render: (row) => <StatusBadge status={row.handover_status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="ការប្រគល់-ទទួល (Handovers)"
        subtitle="តាមដានការអនុវត្តដំណាក់កាលទី១ ដល់ទី៤ វឌ្ឍនភាពភាគរយ និងកំណត់ត្រាពិនិត្យ"
        columns={columns}
        data={handovers}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមលេខកូដ ឬគម្រោង..."
        onRefresh={fetchHandovers}
        onAdd={handleOpenCreate}
        addLabel="កត់ត្រាការប្រគល់-ទទួល"
        canAdd={canEdit}
        canEdit={canEdit}
        canDelete={isAdmin}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Handovers"
        filters={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
          >
            <option value="">គ្រប់ស្ថានភាព</option>
            <option value="ប្រគល់រួចរាល់">ប្រគល់រួចរាល់</option>
            <option value="កំពុងដំណើរការ">កំពុងដំណើរការ</option>
            <option value="មិនទាន់ប្រគល់">មិនទាន់ប្រគល់</option>
          </select>
        }
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'កត់ត្រាការប្រគល់-ទទួលថ្មី' : 'កែប្រែកំណត់ត្រាប្រគល់-ទទួល'}
        maxWidth="xl"
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
                លេខកូដ (Handover ID)
              </label>
              <input
                type="text"
                disabled={modalMode === 'edit'}
                value={formData.handover_id}
                onChange={(e) => setFormData({ ...formData, handover_id: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
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
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ទឹកប្រាក់កិច្ចសន្យា ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.contract_amount}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ទឹកប្រាក់ប្រគល់-ទទួល ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.handover_amount}
                onChange={(e) => setFormData({ ...formData, handover_amount: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            <div className="text-xs font-bold text-slate-700 mb-2">
              ទំហំទឹកប្រាក់តាម ៤ ដំណាក់កាល (Stage 1 to Stage 4)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">ដំណាក់កាលទី ១ ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stage_1}
                  onChange={(e) => setFormData({ ...formData, stage_1: e.target.value })}
                  className="w-full text-xs font-mono px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">ដំណាក់កាលទី ២ ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stage_2}
                  onChange={(e) => setFormData({ ...formData, stage_2: e.target.value })}
                  className="w-full text-xs font-mono px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">ដំណាក់កាលទី ៣ ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stage_3}
                  onChange={(e) => setFormData({ ...formData, stage_3: e.target.value })}
                  className="w-full text-xs font-mono px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">ដំណាក់កាលទី ៤ ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stage_4}
                  onChange={(e) => setFormData({ ...formData, stage_4: e.target.value })}
                  className="w-full text-xs font-mono px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">វឌ្ឍនភាព (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.progress_percent}
                onChange={(e) => setFormData({ ...formData, progress_percent: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ស្ថានភាពប្រគល់-ទទួល</label>
              <select
                value={formData.handover_status}
                onChange={(e) => setFormData({ ...formData, handover_status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="កំពុងដំណើរការ">កំពុងដំណើរការ</option>
                <option value="ប្រគល់រួចរាល់">ប្រគល់រួចរាល់</option>
                <option value="មិនទាន់ប្រគល់">មិនទាន់ប្រគល់</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">កំណត់ចំណាំ (Notes)</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
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

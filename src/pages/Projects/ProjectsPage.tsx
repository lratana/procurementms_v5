import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatUSD, formatDate } from '../../utils/formatters.js';

const PROCUREMENT_TYPE_OPTIONS = [
  'សំណង់ (Civil Works)',
  'ទំនិញ (Goods)',
  'សេវាកម្ម (Services)',
  'សេវាកម្មទីប្រឹក្សា (Consultant Services)',
] as const;

const PROCUREMENT_METHOD_OPTIONS = [
  'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ',
  'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក',
  'ការដេញថ្លៃមានកម្រិត',
  'ការពិគ្រោះថ្លៃ',
  'ការស្ទង់តម្លៃ',
  'លទ្ធកម្មដោយឡែក',
] as const;

function normalizeProcurementType(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if ((PROCUREMENT_TYPE_OPTIONS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (trimmed.includes('សំណង់') || lower.includes('civil')) {
    return 'សំណង់ (Civil Works)';
  }
  if (trimmed.includes('ទំនិញ') || lower.includes('goods')) {
    return 'ទំនិញ (Goods)';
  }
  if (
    trimmed.includes('ទីប្រឹក្សា') ||
    trimmed.includes('ពិគ្រោះ') ||
    lower.includes('consultant')
  ) {
    return 'សេវាកម្មទីប្រឹក្សា (Consultant Services)';
  }
  if (trimmed.includes('សេវាកម្ម') || lower.includes('service')) {
    return 'សេវាកម្ម (Services)';
  }
  return trimmed;
}

function normalizeProcurementMethod(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if ((PROCUREMENT_METHOD_OPTIONS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (
    trimmed.includes('អន្តរជាតិ') ||
    lower.includes('icb') ||
    lower.includes('international')
  ) {
    return 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ';
  }
  if (
    trimmed.includes('ក្នុងស្រុក') ||
    lower.includes('ncb') ||
    lower.includes('national')
  ) {
    return 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក';
  }
  if (
    trimmed.includes('មានកម្រិត') ||
    lower.includes('limited') ||
    lower.includes('qcbs') ||
    trimmed.includes('គុណភាព')
  ) {
    return 'ការដេញថ្លៃមានកម្រិត';
  }
  if (
    trimmed.includes('ពិគ្រោះថ្លៃ') ||
    lower.includes('quotation') ||
    lower.includes('rfq') ||
    trimmed.includes('ប្រកួតប្រជែងតម្លៃ') ||
    lower.includes('shopping')
  ) {
    return 'ការពិគ្រោះថ្លៃ';
  }
  if (trimmed.includes('ស្ទង់តម្លៃ') || lower.includes('survey')) {
    return 'ការស្ទង់តម្លៃ';
  }
  if (
    trimmed.includes('ដោយឡែក') ||
    trimmed.includes('ដោយផ្ទាល់') ||
    lower.includes('direct')
  ) {
    return 'លទ្ធកម្មដោយឡែក';
  }
  return trimmed;
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const { canEdit, isAdmin } = useAuth();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [procurementType, setProcurementType] = useState('');
  const [procurementMethod, setProcurementMethod] = useState('');
  const [budgetType, setBudgetType] = useState('');

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    project_id: '',
    title: '',
    description: '',
    fiscal_year: '2024',
    procurement_type: '',
    budget_type: 'មូលធន',
    procurement_method: '',
    plan_date: new Date().toISOString().substring(0, 10),
    plan_amount: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    procurement_type?: string;
    procurement_method?: string;
  }>({});

  // =========================
  // Fetch Projects
  // =========================
  const fetchProjects = async () => {
    setLoading(true);

    try {
      const res = await api.get('/projects', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          fiscal_year: fiscalYear,
          procurement_type: procurementType,
          procurement_method: procurementMethod,
          budget_type: budgetType,
        },
      });

      if (res.data.success) {
        setProjects(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [
    pagination.page,
    searchTerm,
    fiscalYear,
    procurementType,
    procurementMethod,
    budgetType,
  ]);

  // =========================
  // Create
  // =========================
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);

    setFormData({
      project_id: `PRJ-00${projects.length + 1}`,
      title: '',
      description: '',
      fiscal_year: '2024',
      procurement_type: '',
      budget_type: 'មូលធន',
      procurement_method: '',
      plan_date: new Date().toISOString().substring(0, 10),
      plan_amount: '',
    });

    setFormError(null);
    setFieldErrors({});
    setIsModalOpen(true);
  };

  // =========================
  // Edit
  // =========================
  const handleOpenEdit = (row: any) => {
    setModalMode('edit');
    setEditingId(row.project_id);

    setFormData({
      project_id: row.project_id,
      title: row.title,
      description: row.description || '',
      fiscal_year: String(row.fiscal_year || '2024'),
      procurement_type: normalizeProcurementType(row.procurement_type),
      budget_type: row.budget_type || 'មូលធន',
      procurement_method: normalizeProcurementMethod(row.procurement_method),
      plan_date: row.plan_date || '',
      plan_amount: String(row.plan_amount || ''),
    });

    setFormError(null);
    setFieldErrors({});
    setIsModalOpen(true);
  };

  // =========================
  // Submit
  // =========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nextFieldErrors: {
      procurement_type?: string;
      procurement_method?: string;
    } = {};

    if (!formData.procurement_type || !formData.procurement_type.trim()) {
      nextFieldErrors.procurement_type = 'សូមជ្រើសរើសប្រភេទលទ្ធកម្ម';
    }

    if (!formData.procurement_method || !formData.procurement_method.trim()) {
      nextFieldErrors.procurement_method = 'សូមជ្រើសរើសវិធីសាស្ត្រលទ្ធកម្ម';
    }

    setFieldErrors(nextFieldErrors);

    if (!formData.project_id.trim()) {
      setFormError('សូមបញ្ចូលលេខសម្គាល់គម្រោង (Project ID is required)');
      return;
    }

    if (!formData.title.trim()) {
      setFormError('សូមបញ្ចូលចំណងជើងគម្រោង (Project Title is required)');
      return;
    }

    if (nextFieldErrors.procurement_type || nextFieldErrors.procurement_method) {
      return;
    }

    if (!formData.budget_type) {
      setFormError('សូមជ្រើសរើសប្រភេទថវិកា');
      return;
    }

    try {
      if (modalMode === 'create') {
        const res = await api.post('/projects', formData);

        if (res.data.success) {
          setIsModalOpen(false);
          fetchProjects();
        }
      } else {
        const res = await api.put(`/projects/${editingId}`, formData);

        if (res.data.success) {
          setIsModalOpen(false);
          fetchProjects();
        }
      }
    } catch (err: any) {
      setFormError(
        err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច'
      );
    }
  };

  // =========================
  // Delete
  // =========================
  const handleDelete = async (row: any) => {
    if (
      !window.confirm(
        `តើលោកអ្នកពិតជាចង់លុបគម្រោង "${row.project_id}" មែនទេ?`
      )
    ) {
      return;
    }

    try {
      const res = await api.delete(`/projects/${row.project_id}`);

      if (res.data.success) {
        fetchProjects();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'មិនអាចលុបគម្រោងបានទេ');
    }
  };

  // =========================
  // Table Columns
  // =========================
  const columns: Column<any>[] = [
    {
      key: 'no',
      header: 'ល.រ',
      className: 'w-12 text-center text-slate-400 font-mono',
      render: (_, idx) =>
        (pagination.page - 1) * pagination.limit + idx + 1,
    },

    {
      key: 'project_id',
      header: 'លេខគម្រោង',
      className: 'font-mono font-bold text-blue-600 w-28',
    },

    {
      key: 'title',
      header: 'ចំណងជើងគម្រោង',
      render: (row) => (
        <div>
          <button
            onClick={() => navigate(`/projects/${row.project_id}`)}
            className="font-semibold text-slate-800 hover:text-blue-600 text-left transition-colors"
          >
            {row.title}
          </button>

          {row.description && (
            <p className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
              {row.description}
            </p>
          )}
        </div>
      ),
    },

    {
      key: 'fiscal_year',
      header: 'ឆ្នាំថវិកា',
      className: 'text-center font-mono',
    },

    {
      key: 'procurement_type',
      header: 'ប្រភេទលទ្ធកម្ម',
      render: (row) => (
        <span
          className="text-slate-600 font-medium"
          style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
        >
          {normalizeProcurementType(row.procurement_type) || row.procurement_type || '-'}
        </span>
      ),
    },

    // =========================
    // Budget Type
    // =========================
    {
      key: 'budget_type',
      header: 'ប្រភេទថវិកា',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.budget_type === 'ចរន្ត'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {row.budget_type || '-'}
        </span>
      ),
    },

    {
      key: 'procurement_method',
      header: 'វិធីសាស្ត្រលទ្ធកម្ម',
      render: (row) => (
        <span
          className="text-slate-600"
          style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
        >
          {normalizeProcurementMethod(row.procurement_method) || row.procurement_method || '-'}
        </span>
      ),
    },

    {
      key: 'plan_date',
      header: 'កាលបរិច្ឆេទផែនការ',
      render: (row) => (
        <span className="text-slate-500 font-mono">
          {formatDate(row.plan_date)}
        </span>
      ),
    },

    {
      key: 'plan_amount',
      header: 'ទឹកប្រាក់ផែនការ',
      className: 'text-right font-mono font-semibold text-slate-800',
      render: (row) => formatUSD(row.plan_amount),
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
        title="បញ្ជីគម្រោងលទ្ធកម្ម (Procurement Projects)"
        subtitle="គ្រប់គ្រងព័ត៌មានគម្រោង ផែនការលទ្ធកម្ម និងការតាមដានស្ថានភាព"
        columns={columns}
        data={projects}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមលេខ ឬចំណងជើងគម្រោង..."
        onRefresh={fetchProjects}
        onAdd={handleOpenCreate}
        addLabel="បង្កើតគម្រោងថ្មី"
        canAdd={canEdit}
        canEdit={canEdit}
        canDelete={isAdmin}
        onView={(row) => navigate(`/projects/${row.project_id}`)}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) =>
          setPagination((prev) => ({
            ...prev,
            page: p,
          }))
        }
        exportFileName="Cambodian_Procurement_Projects"
        filters={
          <>
            {/* Fiscal Year */}
            <select
              value={fiscalYear}
              onChange={(e) => {
                setFiscalYear(e.target.value);
                setPagination((prev) => ({
                  ...prev,
                  page: 1,
                }));
              }}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">គ្រប់ឆ្នាំថវិកា (All Years)</option>
              <option value="2026">២០២៦ (2026)</option>
              <option value="2025">២០២៥ (2025)</option>
              <option value="2024">២០២៤ (2024)</option>
              <option value="2023">២០២៣ (2023)</option>
            </select>

            {/* Procurement Type */}
            <select
              value={procurementType}
              onChange={(e) => {
                setProcurementType(e.target.value);
                setPagination((prev) => ({
                  ...prev,
                  page: 1,
                }));
              }}
              style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">គ្រប់ប្រភេទ (All Types)</option>
              {PROCUREMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {/* Procurement Method */}
            <select
              value={procurementMethod}
              onChange={(e) => {
                setProcurementMethod(e.target.value);
                setPagination((prev) => ({
                  ...prev,
                  page: 1,
                }));
              }}
              style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">
                គ្រប់វិធីសាស្ត្រ (All Methods)
              </option>
              {PROCUREMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {/* Budget Type */}
            <select
              value={budgetType}
              onChange={(e) => {
                setBudgetType(e.target.value);
                setPagination((prev) => ({
                  ...prev,
                  page: 1,
                }));
              }}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">
                គ្រប់ប្រភេទថវិកា
              </option>
              <option value="ចរន្ត">
                ចរន្ត
              </option>
              <option value="មូលធន">
                មូលធន
              </option>
            </select>
          </>
        }
      />

      {/* Create / Edit Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === 'create'
            ? 'បង្កើតគម្រោងលទ្ធកម្មថ្មី'
            : 'កែប្រែទិន្នន័យគម្រោង'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {formError}
            </div>
          )}

          {/* Project ID + Fiscal Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                លេខសម្គាល់គម្រោង{' '}
                <span className="text-rose-500">*</span>
              </label>

              <input
                type="text"
                required
                disabled={modalMode === 'edit'}
                value={formData.project_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    project_id: e.target.value,
                  })
                }
                placeholder="ឧ. PRJ-001"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ឆ្នាំថវិកា (Fiscal Year)
              </label>

              <input
                type="number"
                value={formData.fiscal_year}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fiscal_year: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ចំណងជើងគម្រោង{' '}
              <span className="text-rose-500">*</span>
            </label>

            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  title: e.target.value,
                })
              }
              placeholder="ឧ. សាងសង់អគារមណ្ឌលសុខភាព..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ពិពណ៌នាលម្អិត (Description)
            </label>

            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  description: e.target.value,
                })
              }
              placeholder="ពិពណ៌នាអំពីទីតាំង វិសាលភាព ឬគោលបំណងនៃគម្រោង..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Procurement Type + Budget Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="block text-xs font-semibold text-slate-700 mb-1"
                style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
              >
                ប្រភេទលទ្ធកម្ម{' '}
                <span className="text-rose-500">*</span>
              </label>

              <select
                value={formData.procurement_type}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    procurement_type: val,
                  });
                  if (val) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      procurement_type: undefined,
                    }));
                  }
                }}
                style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
                className={`w-full text-xs px-3 py-2 border rounded-lg bg-slate-50 hover:border-slate-300 focus:bg-white focus:outline-hidden transition-colors ${
                  fieldErrors.procurement_type
                    ? 'border-rose-400 focus:border-rose-500'
                    : 'border-slate-200 focus:border-blue-500'
                }`}
              >
                <option value="">ជ្រើសរើសប្រភេទលទ្ធកម្ម</option>
                {PROCUREMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {fieldErrors.procurement_type && (
                <p
                  className="mt-1 text-[11px] font-medium text-rose-600"
                  style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
                >
                  {fieldErrors.procurement_type}
                </p>
              )}
            </div>

            {/* Budget Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ប្រភេទថវិកា{' '}
                <span className="text-rose-500">*</span>
              </label>

              <select
                value={formData.budget_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    budget_type: e.target.value,
                  })
                }
                required
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
              >
                <option value="">
                  -- ជ្រើសរើសប្រភេទថវិកា --
                </option>

                <option value="ចរន្ត">
                  ចរន្ត
                </option>

                <option value="មូលធន">
                  មូលធន
                </option>
              </select>
            </div>
          </div>

          {/* Procurement Method */}
          <div>
            <label
              className="block text-xs font-semibold text-slate-700 mb-1"
              style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
            >
              វិធីសាស្ត្រលទ្ធកម្ម{' '}
              <span className="text-rose-500">*</span>
            </label>

            <select
              value={formData.procurement_method}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  procurement_method: val,
                });
                if (val) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    procurement_method: undefined,
                  }));
                }
              }}
              style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
              className={`w-full text-xs px-3 py-2 border rounded-lg bg-slate-50 hover:border-slate-300 focus:bg-white focus:outline-hidden transition-colors ${
                fieldErrors.procurement_method
                  ? 'border-rose-400 focus:border-rose-500'
                  : 'border-slate-200 focus:border-blue-500'
              }`}
            >
              <option value="">ជ្រើសរើសវិធីសាស្ត្រលទ្ធកម្ម</option>
              {PROCUREMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            {fieldErrors.procurement_method && (
              <p
                className="mt-1 text-[11px] font-medium text-rose-600"
                style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif' }}
              >
                {fieldErrors.procurement_method}
              </p>
            )}
          </div>

          {/* Plan Date + Plan Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                កាលបរិច្ឆេទផែនការ
              </label>

              <input
                type="date"
                value={formData.plan_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    plan_date: e.target.value,
                  })
                }
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ទឹកប្រាក់ផែនការ (៛)
              </label>

              <input
                type="number"
                step="0.01"
                value={formData.plan_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    plan_amount: e.target.value,
                  })
                }
                placeholder="ឧ. 7575.33"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              បោះបង់
            </button>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs shadow-blue-500/20 transition-all"
            >
              {modalMode === 'create' ? 'រក្សាទុក' : 'កែប្រែ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
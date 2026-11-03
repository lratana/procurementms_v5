import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Tag,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Gavel,
  FileCheck2,
  Truck,
  ShieldCheck,
  History,
  Building2,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { formatCurrency, formatUSD, formatDate, formatDateTime } from '../../utils/formatters.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'info' | 'request' | 'bidding' | 'bidders' | 'contract' | 'handover' | 'warranty' | 'audit'
  >('info');

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      try {
        const res = await api.get(`/projects/${id}`);
        if (res.data.success) {
          setProject(res.data.data);
        }
      } catch (err) {
        console.error('Fetch project detail failed:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
        កំពុងទាញយកព័ត៌មានលម្អិតនៃគម្រោង...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center text-slate-500">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        រកមិនឃើញព័ត៌មានគម្រោងលេខ {id} ទេ
        <div className="mt-4">
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xs"
          >
            ត្រឡប់ទៅបញ្ជីគម្រោង
          </button>
        </div>
      </div>
    );
  }

  // Calculate current stage in lifecycle
  const hasRequest = !!project.request;
  const hasBidding = !!project.bidding;
  const hasContract = !!project.contract;
  const hasHandover = !!project.handover;
  const isCompleted = project.handover?.progress_percent === 100;
  const hasWarranty = !!project.warranty;

  const steps = [
    { key: 'plan', label: 'ផែនការ (PLAN)', done: true },
    { key: 'request', label: 'សំណើ (REQUEST)', done: hasRequest },
    { key: 'bidding', label: 'ដេញថ្លៃ (BIDDING)', done: hasBidding },
    { key: 'contract', label: 'កិច្ចសន្យា (CONTRACT)', done: hasContract },
    { key: 'handover', label: 'ប្រគល់-ទទួល (HANDOVER)', done: hasHandover },
    { key: 'warranty', label: 'ការធានា (WARRANTY)', done: hasWarranty },
    { key: 'completed', label: 'បានបញ្ចប់ (COMPLETED)', done: isCompleted },
  ];

  const tabs = [
    { key: 'info', label: 'ព័ត៌មានគម្រោង', icon: FileText },
    { key: 'request', label: 'សំណើគម្រោង', icon: FileSpreadsheet, badge: hasRequest },
    { key: 'bidding', label: 'ការដេញថ្លៃ', icon: Gavel, badge: hasBidding },
    { key: 'contract', label: 'កិច្ចសន្យា', icon: FileCheck2, badge: hasContract },
    { key: 'handover', label: 'ប្រគល់-ទទួល', icon: Truck, badge: hasHandover },
    { key: 'warranty', label: 'ការធានា', icon: ShieldCheck, badge: hasWarranty },
    { key: 'audit', label: 'ប្រវត្តិសកម្មភាព', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Back button & Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ត្រឡប់ទៅបញ្ជីគម្រោង</span>
        </button>
      </div>

      {/* Project Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1.5">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded-md border border-blue-200">
                {project.project_id}
              </span>
              <StatusBadge
                status={
                  isCompleted
                    ? 'បានបញ្ចប់'
                    : project.contract?.status || project.bidding?.status || 'រៀបចំផែនការ'
                }
              />
            </div>
            <h1 className="text-xl font-bold text-slate-900 leading-snug">{project.title}</h1>
            {project.description && (
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">{project.description}</p>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center space-x-6 text-left shrink-0">
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-semibold">ឆ្នាំថវិកា</div>
              <div className="text-base font-bold text-slate-800 font-mono">{project.fiscal_year}</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-semibold">ទឹកប្រាក់ផែនការ</div>
              <div className="text-lg font-bold text-blue-600 font-mono">
                {formatUSD(project.plan_amount)}
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Lifecycle Stepper */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">
            វដ្តជីវិតនៃលទ្ធកម្ម (Procurement Lifecycle)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {steps.map((st, i) => (
              <div
                key={st.key}
                className={`flex flex-col items-center p-2 rounded-lg text-center border transition-all ${
                  st.done
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full mb-1">
                  {st.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                  )}
                </div>
                <span className="text-[10px] font-bold tracking-tight">{st.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 flex space-x-2 overflow-x-auto shadow-2xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6 shadow-2xs">
        {/* TAB 1: INFO */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">ព័ត៌មានលម្អិតគម្រោង</h3>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-slate-500">លេខសម្គាល់គម្រោង:</span>
                <span className="font-mono font-bold text-slate-800">{project.project_id}</span>

                <span className="text-slate-500">ចំណងជើង:</span>
                <span className="font-semibold text-slate-800">{project.title}</span>

                <span className="text-slate-500">ប្រភេទលទ្ធកម្ម:</span>
                <span className="text-slate-800">{project.procurement_type}</span>

                <span className="text-slate-500">ប្រភេទថវិកា:</span>
                <span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      project.budget_type === 'ចរន្ត'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {project.budget_type || '-'}
                  </span>
                </span>

                <span className="text-slate-500">វិធីសាស្ត្រលទ្ធកម្ម:</span>
                <span className="text-slate-800">{project.procurement_method}</span>

                <span className="text-slate-500">ឆ្នាំថវិកា:</span>
                <span className="font-mono text-slate-800">{project.fiscal_year}</span>

                <span className="text-slate-500">កាលបរិច្ឆេទផែនការ:</span>
                <span className="font-mono text-slate-800">{formatDate(project.plan_date)}</span>

                <span className="text-slate-500">ទឹកប្រាក់ផែនការ:</span>
                <span className="font-mono font-bold text-blue-600">{formatUSD(project.plan_amount)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2">ការពិពណ៌នា</h3>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 leading-relaxed min-h-32">
                {project.description || 'មិនមានការពិពណ៌នាបន្ថែមទេ'}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REQUEST */}
        {activeTab === 'request' && (
          <div>
            {!project.request ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                គម្រោងនេះមិនទាន់មានទិន្នន័យសំណើគម្រោងនៅឡើយទេ
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">សំណើគម្រោង</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">កាលបរិច្ឆេទសំណើ:</span>
                      <span className="font-mono font-bold">{formatDate(project.request.request_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ឆ្នាំថវិកា:</span>
                      <span className="font-mono">{project.request.fiscal_year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ទឹកប្រាក់ស្នើសុំ:</span>
                      <span className="font-mono font-bold text-slate-800">{formatUSD(project.request.request_amount)}</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/60 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">កាលបរិច្ឆេទអនុម័ត:</span>
                      <span className="font-mono font-bold">{formatDate(project.request.approval_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ទឹកប្រាក់អនុម័ត:</span>
                      <span className="font-mono font-bold text-emerald-700">{formatUSD(project.request.approved_amount)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-emerald-200">
                      <span className="text-slate-600 font-semibold">គម្លាតទឹកប្រាក់ (Difference):</span>
                      <span className="font-mono font-bold text-blue-700">
                        {formatUSD((Number(project.request.request_amount) || 0) - (Number(project.request.approved_amount) || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BIDDING */}
        {activeTab === 'bidding' && (
          <div>
            {!project.bidding ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                គម្រោងនេះមិនទាន់មានទិន្នន័យដំណើរការដេញថ្លៃនៅឡើយទេ
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-800">ដំណើរការដេញថ្លៃ (Bidding Process)</h3>
                  <StatusBadge status={project.bidding.status} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center my-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase">រៀបចំឯកសារ</div>
                    <div className="font-mono font-semibold mt-1">{formatDate(project.bidding.prepare_bid)}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase">MOH អនុម័ត</div>
                    <div className="font-mono font-semibold mt-1">{formatDate(project.bidding.moh_approval)}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase">MEF ដាក់សំណើ</div>
                    <div className="font-mono font-semibold mt-1">{formatDate(project.bidding.mef_submit)}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase">MEF អនុម័ត</div>
                    <div className="font-mono font-semibold mt-1">{formatDate(project.bidding.mef_approval)}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase">ផ្សព្វផ្សាយ</div>
                    <div className="font-mono font-semibold mt-1">{formatDate(project.bidding.advertise_date)}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase">បើកសំណើ</div>
                    <div className="font-mono font-semibold mt-1">{formatDate(project.bidding.bid_opening)}</div>
                  </div>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500">សុពលភាពដេញថ្លៃ (Validity Days): </span>
                    <span className="font-mono font-bold text-slate-800">{project.bidding.validity_days} ថ្ងៃ</span>
                  </div>
                  <div>
                    <span className="text-slate-500">សុពលភាពរហូតដល់ (Valid Until): </span>
                    <span className="font-mono font-bold text-blue-700">{formatDate(project.bidding.valid_until)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CONTRACT */}
        {activeTab === 'contract' && (
          <div>
            {!project.contract ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                គម្រោងនេះមិនទាន់មានកិច្ចសន្យាត្រូវអនុវត្តនៅឡើយទេ
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-800">កិច្ចសន្យា (Contract Agreement)</h3>
                  <StatusBadge status={project.contract.status} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-slate-500">ទំហំទឹកប្រាក់កិច្ចសន្យា</div>
                    <div className="text-lg font-bold text-slate-900 font-mono mt-1">
                      {formatUSD(project.contract.contract_amount)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-slate-500">កាលបរិច្ឆេទអនុម័តកិច្ចសន្យា</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-1">
                      {formatDate(project.contract.approval_date)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-slate-500">កាលបរិច្ឆេទបញ្ចប់កិច្ចសន្យា</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-1">
                      {formatDate(project.contract.end_date)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: HANDOVER */}
        {activeTab === 'handover' && (
          <div>
            {!project.handover ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                គម្រោងនេះមិនទាន់មានកំណត់ត្រាប្រគល់-ទទួលនៅឡើយទេ
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-800">ការប្រគល់-ទទួល និងវឌ្ឍនភាពការងារ</h3>
                  <StatusBadge status={project.handover.handover_status} />
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between mb-1.5 font-semibold">
                    <span className="text-slate-600">វឌ្ឍនភាពការងារសរុប (Progress)</span>
                    <span className="text-blue-600 font-mono">{project.handover.progress_percent}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${project.handover.progress_percent}%` }}
                    />
                  </div>
                </div>

                {/* 4 Stages Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div className="font-semibold text-slate-700">ដំណាក់កាលទី ១</div>
                    <div className="text-sm font-bold text-blue-600 font-mono mt-1">
                      {formatUSD(project.handover.stage_1)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div className="font-semibold text-slate-700">ដំណាក់កាលទី ២</div>
                    <div className="text-sm font-bold text-blue-600 font-mono mt-1">
                      {formatUSD(project.handover.stage_2)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div className="font-semibold text-slate-700">ដំណាក់កាលទី ៣</div>
                    <div className="text-sm font-bold text-blue-600 font-mono mt-1">
                      {formatUSD(project.handover.stage_3)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div className="font-semibold text-slate-700">ដំណាក់កាលទី ៤</div>
                    <div className="text-sm font-bold text-blue-600 font-mono mt-1">
                      {formatUSD(project.handover.stage_4)}
                    </div>
                  </div>
                </div>

                {project.handover.notes && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="font-semibold text-slate-700">កំណត់ចំណាំការប្រគល់-ទទួល: </span>
                    <span className="text-slate-600">{project.handover.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: WARRANTY */}
        {activeTab === 'warranty' && (
          <div>
            {!project.warranty ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                គម្រោងនេះមិនទាន់មានទិន្នន័យការធានានៅឡើយទេ
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-800">ព័ត៌មានការធានា (Warranty Status)</h3>
                  <StatusBadge status={project.warranty.status} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-slate-500">កាលបរិច្ឆេទប្រគល់-ទទួល</div>
                    <div className="text-sm font-bold text-slate-900 font-mono mt-1">
                      {formatDate(project.warranty.handover_date)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-slate-500">រយៈពេលធានា (Warranty Period)</div>
                    <div className="text-sm font-bold text-slate-900 font-mono mt-1">
                      {project.warranty.warranty_period_days} ថ្ងៃ
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-slate-500">កាលបរិច្ឆេទផុតកំណត់ការធានា</div>
                    <div className="text-sm font-bold text-slate-900 font-mono mt-1">
                      {formatDate(project.warranty.expired_date)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: AUDIT */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 border-b pb-2">ប្រវត្តិសកម្មភាពលើគម្រោងនេះ</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="p-3">កាលបរិច្ឆេទ</th>
                    <th className="p-3">សកម្មភាព</th>
                    <th className="p-3">ផ្នែក</th>
                    <th className="p-3">អាសយដ្ឋាន IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.auditLogs?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        គ្មានកំណត់ត្រាសកម្មភាពទេ
                      </td>
                    </tr>
                  ) : (
                    project.auditLogs?.map((log: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-3 font-mono text-slate-500">{formatDateTime(log.created_at)}</td>
                        <td className="p-3 font-semibold text-slate-700">{log.action}</td>
                        <td className="p-3 text-slate-600">{log.module}</td>
                        <td className="p-3 font-mono text-slate-400">{log.ip_address}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

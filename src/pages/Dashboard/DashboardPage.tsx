import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  FolderKanban,
  FileSpreadsheet,
  Gavel,
  FileCheck2,
  Clock,
  Truck,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import { api } from '../../services/api.js';
import { formatDateTime } from '../../utils/formatters.js';


// =============================================================
// Chart Colors
// =============================================================

const COLORS = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
];


// =============================================================
// Format Cambodian Riel
// =============================================================

const formatRiel = (
  value: number | string | null | undefined
): string => {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return '0 ៛';
  }

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue)} ៛`;
};


// =============================================================
// Dashboard Page
// =============================================================

export function DashboardPage() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  // ===========================================================
  // Fetch Dashboard Data
  // ===========================================================

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      const [sumRes, chartRes, actRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/charts'),
        api.get('/dashboard/recent-activities'),
      ]);

      // Summary
      if (sumRes.data.success) {
        setSummary(sumRes.data.data);
      }

      // Charts
      if (chartRes.data.success) {
        setCharts(chartRes.data.data);
      }

      // Recent activities + alerts
      if (actRes.data.success) {
        setActivities(
          actRes.data.data.recentActivities || []
        );

        setAlerts(
          actRes.data.data.alerts || []
        );
      }
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  };


  // ===========================================================
  // Initial Load
  // ===========================================================

  useEffect(() => {
    fetchDashboardData();
  }, []);


  // ===========================================================
  // KPI Cards
  // ===========================================================

  const kpis = [
    {
      title: 'ចំនួនគម្រោងសរុប',
      value: summary?.total_projects ?? 0,
      icon: FolderKanban,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/projects',
    },

    {
      title: 'ទឹកប្រាក់ផែនការសរុប',
      value: formatRiel(
        summary?.total_plan_amount ?? 0
      ),
      icon: () => (
        <span className="text-xl font-bold leading-none">
          ៛
        </span>
      ),
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      link: '/projects',
    },

    {
      title: 'សំណើគម្រោង',
      value: summary?.total_requests ?? 0,
      icon: FileSpreadsheet,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      link: '/project-requests',
    },

    {
      title: 'ទឹកប្រាក់បានអនុម័តសរុប',
      value: formatRiel(
        summary?.total_approved_amount ?? 0
      ),
      icon: () => (
        <span className="text-xl font-bold leading-none">
          ៛
        </span>
      ),
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      link: '/project-requests',
    },

    {
      title: 'ដំណើរការដេញថ្លៃ',
      value: summary?.total_bidding ?? 0,
      icon: Gavel,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: '/bidding',
    },

    {
      title: 'កិច្ចសន្យា',
      value: summary?.total_contracts ?? 0,
      icon: FileCheck2,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      link: '/contracts',
    },

    {
      title: 'ទឹកប្រាក់កិច្ចសន្យាសរុប',
      value: formatRiel(
        summary?.total_contracts_amount ?? 0
      ),
      icon: () => (
        <span className="text-xl font-bold leading-none">
          ៛
        </span>
      ),
      color: 'bg-cyan-600',
      textColor: 'text-cyan-700',
      bgColor: 'bg-cyan-50',
      link: '/contracts',
    },

    {
      title: 'គម្រោងកំពុងអនុវត្ត',
      value: summary?.active_projects ?? 0,
      icon: Clock,
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      link: '/contracts',
    },

    {
      title: 'ប្រគល់-ទទួល',
      value: summary?.total_handovers ?? 0,
      icon: Truck,
      color: 'bg-teal-500',
      textColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      link: '/handovers',
    },

    {
      title: 'ទឹកប្រាក់ប្រគល់-ទទួលសរុប',
      value: formatRiel(
        summary?.total_handovers_amount ?? 0
      ),
      icon: () => (
        <span className="text-xl font-bold leading-none">
          ៛
        </span>
      ),
      color: 'bg-teal-600',
      textColor: 'text-teal-700',
      bgColor: 'bg-teal-50',
      link: '/handovers',
    },

    {
      title: 'ការធានាកំពុងមានសុពលភាព',
      value: summary?.active_warranties ?? 0,
      icon: ShieldCheck,
      color: 'bg-emerald-600',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      link: '/warranties',
    },

    {
      title: 'ការធានាផុតកំណត់',
      value: summary?.expired_warranties ?? 0,
      icon: ShieldAlert,
      color: 'bg-rose-500',
      textColor: 'text-rose-600',
      bgColor: 'bg-rose-50',
      link: '/warranties',
    },
  ];


  // ===========================================================
  // Render
  // ===========================================================

  return (
    <div className="space-y-6">

      {/* =====================================================
          Page Title & Refresh
      ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ផ្ទាំងគ្រប់គ្រងទិន្នន័យលទ្ធកម្ម
            <span className="text-slate-400 font-medium ml-1">
              (Procurement Dashboard)
            </span>
          </h1>

          <p className="text-xs text-slate-500 mt-0.5">
            ទិដ្ឋភាពទូទៅនៃផែនការ ដំណើរការដេញថ្លៃ
            កិច្ចសន្យា ការប្រគល់-ទទួល និងការធានា
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          type="button"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-all self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              loading ? 'animate-spin' : ''
            }`}
          />

          <span>ទាញយកទិន្នន័យថ្មី</span>
        </button>
      </div>


      {/* =====================================================
          KPI Cards
      ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;

          return (
            <div
              key={idx}
              onClick={() => navigate(kpi.link)}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="min-w-0 pr-3">
                <p className="text-xs font-medium text-slate-500">
                  {kpi.title}
                </p>

                <h3 className="text-xl font-bold text-slate-800 mt-1 break-words">
                  {kpi.value}
                </h3>
              </div>

              <div
                className={`shrink-0 w-12 h-12 rounded-xl ${kpi.bgColor} flex items-center justify-center ${kpi.textColor} group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}

      </div>


      {/* =====================================================
          Alerts / Warnings
      ====================================================== */}

      {alerts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">

          <div className="flex items-center space-x-2 mb-2 text-amber-800 font-bold text-xs uppercase tracking-wider">

            <AlertTriangle className="w-4 h-4 text-amber-600" />

            <span>
              ការជូនដំណឹងត្រូវត្រួតពិនិត្យជាបន្ទាន់
              (Alerts & Warnings)
            </span>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {alerts.map((alt, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded-lg border border-amber-200/80 shadow-2xs text-xs"
              >
                <div className="font-semibold text-slate-800 mb-0.5">
                  {alt.title}
                </div>

                <div className="text-slate-600">
                  {alt.message}
                </div>
              </div>
            ))}

          </div>
        </div>
      )}


      {/* =====================================================
          Visual Charts
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


        {/* ===================================================
            Chart 1 - Projects by Fiscal Year
        ==================================================== */}

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">

          <h3 className="text-sm font-bold text-slate-800 mb-4">
            ចំនួនគម្រោងតាមឆ្នាំថវិកា
            <span className="text-slate-400 font-normal ml-1">
              (Projects by Fiscal Year)
            </span>
          </h3>

          <div className="h-64">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={charts?.byFiscalYear || []}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />

                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />

                <Tooltip
                  formatter={(value: any) => [
                    `${value} គម្រោង`,
                    'ចំនួន',
                  ]}
                  labelFormatter={(lbl) =>
                    `ឆ្នាំ ${lbl}`
                  }
                />

                <Bar
                  dataKey="count"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                />

              </BarChart>
            </ResponsiveContainer>

          </div>
        </div>


        {/* ===================================================
            Chart 2 - Procurement Amount by Year
        ==================================================== */}

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">

          <h3 className="text-sm font-bold text-slate-800 mb-4">
            ទំហំទឹកប្រាក់លទ្ធកម្មតាមឆ្នាំ
            <span className="text-slate-400 font-normal ml-1">
              (Procurement Amount by Year)
            </span>
          </h3>

          <div className="h-64">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={charts?.byFiscalYear || []}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />

                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  tickFormatter={(val) =>
                    `${new Intl.NumberFormat(
                      'en-US'
                    ).format(
                      Number(val) / 1000
                    )} ពាន់៛`
                  }
                  tick={{ fontSize: 12 }}
                />

                <Tooltip
                  formatter={(value: any) => [
                    formatRiel(value),
                    'ទឹកប្រាក់',
                  ]}
                  labelFormatter={(lbl) =>
                    `ឆ្នាំ ${lbl}`
                  }
                />

                <Bar
                  dataKey="totalAmount"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />

              </BarChart>
            </ResponsiveContainer>

          </div>
        </div>


        {/* ===================================================
            Chart 3 - Procurement Type
        ==================================================== */}

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">

          <h3 className="text-sm font-bold text-slate-800 mb-4">
            ប្រភេទលទ្ធកម្ម
            <span className="text-slate-400 font-normal ml-1">
              (Procurement Types)
            </span>
          </h3>

          <div className="h-64">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>

                <Pie
                  data={charts?.byProcurementType || []}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }: any) =>
                    `${name} (${(
                      percent * 100
                    ).toFixed(0)}%)`
                  }
                >

                  {(charts?.byProcurementType || []).map(
                    (_: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          COLORS[
                            index % COLORS.length
                          ]
                        }
                      />
                    )
                  )}

                </Pie>

                <Tooltip />

                <Legend />

              </PieChart>
            </ResponsiveContainer>

          </div>
        </div>


        {/* ===================================================
            Chart 4 - Warranty Status
        ==================================================== */}

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">

          <h3 className="text-sm font-bold text-slate-800 mb-4">
            ស្ថានភាពការធានា
            <span className="text-slate-400 font-normal ml-1">
              (Warranty Status)
            </span>
          </h3>

          <div className="h-64">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>

                <Pie
                  data={charts?.byWarranty || []}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }: any) =>
                    `${name}: ${value}`
                  }
                >

                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />

                </Pie>

                <Tooltip />

                <Legend />

              </PieChart>
            </ResponsiveContainer>

          </div>
        </div>

      </div>


      {/* =====================================================
          Recent Activities
      ====================================================== */}

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">

        <div className="p-4 border-b border-slate-100 flex items-center justify-between">

          <h3 className="text-sm font-bold text-slate-800">
            សកម្មភាពថ្មីៗក្នុងប្រព័ន្ធ
            <span className="text-slate-400 font-normal ml-1">
              (Recent Activities)
            </span>
          </h3>

          <button
            onClick={() => navigate('/audit-logs')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>មើលទាំងអស់</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

        </div>


        <div className="overflow-x-auto">

          <table className="w-full text-left border-collapse text-xs">

            <thead>

              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold">

                <th className="px-4 py-3">
                  កាលបរិច្ឆេទ
                </th>

                <th className="px-4 py-3">
                  អ្នកប្រើប្រាស់
                </th>

                <th className="px-4 py-3">
                  សកម្មភាព
                </th>

                <th className="px-4 py-3">
                  ផ្នែក / ម៉ូឌុល
                </th>

                <th className="px-4 py-3">
                  លេខសម្គាល់
                </th>

              </tr>

            </thead>


            <tbody className="divide-y divide-slate-100">

              {activities.length === 0 ? (

                <tr>

                  <td
                    colSpan={5}
                    className="py-6 text-center text-slate-400"
                  >
                    មិនមានសកម្មភាពថ្មីទេ
                  </td>

                </tr>

              ) : (

                activities.map((act, idx) => (

                  <tr
                    key={idx}
                    className="hover:bg-slate-50/60"
                  >

                    <td className="px-4 py-3 text-slate-500">
                      {formatDateTime(
                        act.created_at
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {act.full_name ||
                        act.username ||
                        '-'}
                    </td>

                    <td className="px-4 py-3">

                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {act.action}
                      </span>

                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {act.module || '-'}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-500">
                      {act.record_id || '-'}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}
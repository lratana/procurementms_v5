import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  RefreshCw,
  FileBarChart,
  Filter,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../services/api.js';
import {
  formatCurrency,
  formatUSD,
  formatDate,
  formatKhmerDate,
} from '../../utils/formatters.js';
import { useAuth } from '../../context/AuthContext.js';

export function ReportsPage() {
  const { user } = useAuth();

  const [reportType, setReportType] = useState('projects');
  const [fiscalYear, setFiscalYear] = useState('2024');
  const [procurementType, setProcurementType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // FETCH REPORT
  // =========================================================
  const fetchReport = async () => {
    setLoading(true);

    try {
      const res = await api.get(`/reports/${reportType}`, {
        params: {
          fiscal_year: fiscalYear,
          procurement_type: procurementType,
          from_date: fromDate,
          to_date: toDate,
        },
      });

      if (res.data.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Fetch report error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, fiscalYear, procurementType, fromDate, toDate]);

  // =========================================================
  // PRINT
  // =========================================================
  const handlePrint = () => {
    window.print();
  };

  // =========================================================
  // PDF VIEW
  // =========================================================
  const handlePDFView = () => {
    window.print();
  };

  // =========================================================
  // EXPORT EXCEL
  // =========================================================
  const handleExportExcel = () => {
    if (!reportData?.data || reportData.data.length === 0) return;

    try {
      const ws = XLSX.utils.json_to_sheet(reportData.data);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, 'Report');

      XLSX.writeFile(
        wb,
        `${reportType}_Report_${new Date()
          .toISOString()
          .substring(0, 10)}.xlsx`
      );
    } catch (err) {
      console.error('Excel export error:', err);
    }
  };

  // =========================================================
  // EXPORT CSV
  // =========================================================
  const handleExportCSV = () => {
    if (!reportData?.data || reportData.data.length === 0) return;

    try {
      const ws = XLSX.utils.json_to_sheet(reportData.data);
      const csv = XLSX.utils.sheet_to_csv(ws);

      const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;',
      });

      const link = document.createElement('a');

      link.href = URL.createObjectURL(blob);
      link.setAttribute(
        'download',
        `${reportType}_Report_${new Date()
          .toISOString()
          .substring(0, 10)}.csv`
      );

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV export error:', err);
    }
  };

  // =========================================================
  // REPORT OPTIONS
  // =========================================================
  const reportOptions = [
    {
      value: 'projects',
      label: '១. របាយការណ៍គម្រោងទូទៅ (Project Report)',
    },
    {
      value: 'procurement-plan',
      label: '២. របាយការណ៍ផែនការលទ្ធកម្ម (Procurement Plan Report)',
    },
    {
      value: 'project-requests',
      label: '៣. របាយការណ៍សំណើគម្រោង (Project Request Report)',
    },
    {
      value: 'bidding',
      label: '៤. របាយការណ៍ការដេញថ្លៃ (Bidding Report)',
    },
    {
      value: 'bidders',
      label: '៥. របាយការណ៍ក្រុមហ៊ុនដេញថ្លៃ (Bidder Report)',
    },
    {
      value: 'contracts',
      label: '៦. របាយការណ៍កិច្ចសន្យា (Contract Report)',
    },
    {
      value: 'handovers',
      label: '៧. របាយការណ៍ប្រគល់-ទទួល (Handover Report)',
    },
    {
      value: 'warranties',
      label: '៨. របាយការណ៍ការធានា (Warranty Report)',
    },
    {
      value: 'user-activity',
      label: '៩. របាយការណ៍សកម្មភាពអ្នកប្រើប្រាស់ (User Activity Report)',
    },
    {
      value: 'audit-logs',
      label: '១០. របាយការណ៍ប្រវត្តិសកម្មភាព (Audit Log Report)',
    },
    {
      value: 'procurement-method',
      label: '១១. របាយការណ៍សរុបស្តីពីការអនុវត្តកិច្ចលទ្ធកម្មតាមវិធីសាស្ត្រលទ្ធកម្ម (Procurement Method Report)',
    },
  ];

  const isProcurementMethodReport = reportType === 'procurement-method';

  const getReportQuarterAndYear = () => {
    const refDate = toDate || fromDate ? new Date(toDate || fromDate) : new Date();
    const validDate = !isNaN(refDate.getTime()) ? refDate : new Date();
    const month = validDate.getMonth(); // 0 - 11
    const quarter = Math.floor(month / 3) + 1;
    const year = fiscalYear || String(validDate.getFullYear());
    return { quarter, year };
  };

  const { quarter: reportQuarter, year: reportYear } = getReportQuarterAndYear();

  // =========================================================
  // RESET FILTER
  // =========================================================
  const handleResetFilter = () => {
    setReportType('projects');
    setFiscalYear('2024');
    setProcurementType('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="space-y-6">

      {/* =====================================================
          CONTROLS HEADER
          Hidden during print
      ====================================================== */}
      <div className="print:hidden bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

          {/* TITLE */}
          <div>
            <div className="flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-blue-700" />

              <h1 className="text-lg font-bold text-slate-900">
                របាយការណ៍ស្ថិតិ និងការនាំចេញទិន្នន័យ
              </h1>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              បង្កើតរបាយការណ៍ផ្លូវការតាមស្តង់ដាររាជរដ្ឋាភិបាល
              ព្រីនជាទម្រង់ក្រដាស ឬនាំចេញជា Excel/CSV
            </p>
          </div>

          {/* =================================================
              ACTION BUTTONS
          ================================================== */}
          <div className="flex items-center flex-wrap gap-2">

            {/* PRINT BUTTON */}
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>បោះពុម្ព (Print)</span>
            </button>

            {/* =================================================
                PDF VIEW DROPDOWN
            ================================================== */}
            <div className="relative group">

              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />

                <span>PDF View</span>

                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* DROPDOWN MENU */}
              <div
                className="
                  absolute right-0 top-full mt-1
                  w-52
                  bg-white
                  border border-slate-200
                  rounded-lg
                  shadow-lg
                  z-50
                  hidden
                  group-hover:block
                "
              >
                {/* PDF VIEW */}
                <button
                  type="button"
                  onClick={handlePDFView}
                  className="
                    w-full
                    flex
                    items-center
                    gap-2
                    px-4
                    py-2.5
                    text-xs
                    text-slate-700
                    hover:bg-slate-50
                    text-left
                  "
                >
                  <FileText className="w-4 h-4 text-red-600" />

                  <span>បើក PDF View</span>
                </button>

                {/* DIVIDER */}
                <div className="border-t border-slate-100" />

                {/* PRINT / SAVE PDF */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="
                    w-full
                    flex
                    items-center
                    gap-2
                    px-4
                    py-2.5
                    text-xs
                    text-slate-700
                    hover:bg-slate-50
                    text-left
                  "
                >
                  <Printer className="w-4 h-4 text-blue-600" />

                  <span>Print / Save as PDF</span>
                </button>
              </div>
            </div>

            {/* EXCEL */}
            <button
              onClick={handleExportExcel}
              type="button"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>នាំចេញ Excel</span>
            </button>

            {/* CSV */}
            <button
              onClick={handleExportCSV}
              type="button"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* =====================================================
            FILTER BAR
        ====================================================== */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

          {/* REPORT TYPE */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              ប្រភេទរបាយការណ៍ (Report Type)
            </label>

            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden"
            >
              {reportOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* FISCAL YEAR */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              ឆ្នាំថវិកា (Fiscal Year)
            </label>

            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden"
            >
              <option value="">គ្រប់ឆ្នាំ</option>
              <option value="2026">២០២៦ (2026)</option>
              <option value="2025">២០២៥ (2025)</option>
              <option value="2024">២០២៤ (2024)</option>
              <option value="2023">២០២៣ (2023)</option>
            </select>
          </div>

          {/* PROCUREMENT TYPE */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              ប្រភេទលទ្ធកម្ម
            </label>

            <select
              value={procurementType}
              onChange={(e) => setProcurementType(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden"
            >
              <option value="">គ្រប់ប្រភេទ</option>
              <option value="សំណង់">សំណង់</option>
              <option value="ទំនិញ">ទំនិញ</option>
              <option value="សេវាកម្ម">សេវាកម្ម</option>
              <option value="សេវាពិគ្រោះ">សេវាពិគ្រោះ</option>
            </select>
          </div>

          {/* FROM DATE */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              ចាប់ពីកាលបរិច្ឆេទ
            </label>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* TO DATE */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              ដល់កាលបរិច្ឆេទ
            </label>

            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full text-xs py-2 px-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* FILTER ACTIONS */}
        <div className="flex items-center justify-end gap-2 pt-2">

          <button
            type="button"
            onClick={handleResetFilter}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            <Filter className="w-3.5 h-3.5" />
            សម្អាតតម្រង
          </button>

          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loading ? 'animate-spin' : ''
              }`}
            />

            ធ្វើបច្ចុប្បន្នភាព
          </button>
        </div>
      </div>

      {/* =====================================================
          OFFICIAL GOVERNMENT PRINTABLE DOCUMENT
      ====================================================== */}
      {isProcurementMethodReport ? (
        <div className="bg-white p-6 sm:p-10 border border-slate-300 text-slate-950 print:border-none print:p-0">
          {/* OFFICIAL CAMBODIAN MINISTRY OF HEALTH HEADER (ANNEX 7.9) */}
          <div className="mb-6 text-slate-950">
            <div className="text-center">
              <div className="text-sm font-bold tracking-wide">
                ព្រះរាជាណាចក្រកម្ពុជា
              </div>
              <div className="text-xs font-bold tracking-wide mt-1">
                ជាតិ សាសនា ព្រះមហាក្សត្រ
              </div>
              <div className="w-20 h-px bg-slate-900 mx-auto my-1.5" />
            </div>

            <div className="flex items-start justify-between mt-2 text-xs">
              <div className="text-left space-y-1">
                <div className="font-bold">ក្រសួងសុខាភិបាល</div>
                <div className="font-bold">គណៈកម្មាធិការលទ្ធកម្ម (គ ល)</div>
              </div>
              <div className="text-right">
                <div className="font-bold">ឧបសម្ព័ន្ធទី ៧.៩</div>
              </div>
            </div>

            <div className="text-center mt-5 space-y-1.5">
              <h1 className="text-base sm:text-lg font-bold text-slate-950">
                របាយការណ៍សរុបស្តីពីការអនុវត្តកិច្ចលទ្ធកម្ម
              </h1>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                តាមវិធីសាស្ត្រលទ្ធកម្ម (លទ្ធកម្មទំនិញ សំណង់ និងសេវាកម្ម)
              </h2>
              <p className="text-xs font-semibold text-slate-900">
                ត្រីមាសទី {reportQuarter} ឆ្នាំ {reportYear}
              </p>
            </div>
          </div>

          {/* OFFICIAL MULTI-LEVEL TABLE (rowSpan & colSpan - 12 Columns) */}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse border border-slate-800 text-[11px] sm:text-xs text-slate-950">
              <thead>
                {/* LEVEL 1 */}
                <tr className="bg-white font-bold text-center text-slate-950">
                  <th
                    rowSpan={3}
                    className="border border-slate-800 px-2 py-2.5 align-middle w-10 text-center"
                  >
                    ល.រ
                  </th>
                  <th
                    rowSpan={3}
                    className="border border-slate-800 px-3 py-2.5 align-middle text-center min-w-[180px]"
                  >
                    វិធីសាស្ត្រលទ្ធកម្ម
                  </th>

                  <th
                    colSpan={2}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    ផែនការ
                  </th>

                  <th
                    colSpan={4}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    ការអនុវត្តជាក់ស្តែង
                  </th>

                  <th
                    colSpan={4}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    ការប្រៀបធៀប
                  </th>
                </tr>

                {/* LEVEL 2 */}
                <tr className="bg-white font-bold text-center text-slate-950">
                  <th
                    colSpan={2}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    ទឹកប្រាក់ផែនការ
                  </th>

                  <th
                    colSpan={2}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    ទឹកប្រាក់ធានាចំណាយ
                  </th>

                  <th
                    rowSpan={2}
                    className="border border-slate-800 px-2 py-2 align-middle text-center w-20"
                  >
                    ចំនួនកិច្ចសន្យា
                  </th>

                  <th
                    rowSpan={2}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    តម្លៃកិច្ចសន្យា
                  </th>

                  <th
                    colSpan={2}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    លម្អៀងធៀបនឹងធានាចំណាយ
                  </th>

                  <th
                    colSpan={2}
                    className="border border-slate-800 px-2 py-2 align-middle text-center"
                  >
                    លម្អៀងធៀបនឹងផែនការ
                  </th>
                </tr>

                {/* LEVEL 3 */}
                <tr className="bg-white font-bold text-center text-slate-950">
                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center">
                    ថវិកាចរន្ត
                  </th>

                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center">
                    ថវិកាមូលធន
                  </th>

                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center">
                    ថវិកាចរន្ត
                  </th>

                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center">
                    ថវិកាមូលធន
                  </th>

                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center">
                    ទឹកប្រាក់
                  </th>

                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center w-20">
                    សមាមាត្រ %
                  </th>

                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center">
                    ទឹកប្រាក់
                  </th>

                  <th className="border border-slate-800 px-2 py-1.5 align-middle text-center w-20">
                    សមាមាត្រ %
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="border border-slate-800 py-8 text-center text-slate-600"
                    >
                      កំពុងទាញយកទិន្នន័យរបាយការណ៍...
                    </td>
                  </tr>
                ) : !reportData?.data || reportData.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="border border-slate-800 py-8 text-center text-slate-600"
                    >
                      គ្មាន
                    </td>
                  </tr>
                ) : (
                  reportData.data.map((row: any, idx: number) => {
                    const isTotalRow =
                      idx === reportData.data.length - 1 ||
                      row.no === 'សរុប';

                    const planCurrent = Number(
                      row.plan_current_amount !== undefined
                        ? row.plan_current_amount
                        : row.plan_current || 0
                    );
                    const planCapital = Number(
                      row.plan_capital_amount !== undefined
                        ? row.plan_capital_amount
                        : row.plan_capital || 0
                    );
                    const commitmentCurrent = Number(
                      row.commitment_current_amount !== undefined
                        ? row.commitment_current_amount
                        : row.commitment_current || 0
                    );
                    const commitmentCapital = Number(
                      row.commitment_capital_amount !== undefined
                        ? row.commitment_capital_amount
                        : row.commitment_capital || 0
                    );
                    const contractCount = Number(row.contract_count || 0);
                    const contractAmount = Number(
                      row.contract_total_amount !== undefined
                        ? row.contract_total_amount
                        : row.contract_amount !== undefined
                        ? row.contract_amount
                        : Number(row.contract_current || 0) +
                          Number(row.contract_capital || 0)
                    );
                    const devCommitmentAmt = Number(
                      row.contract_vs_commitment_amount || 0
                    );
                    const devCommitmentPct = String(
                      row.contract_vs_commitment_percent || '0.00%'
                    );
                    const devPlanAmt = Number(row.contract_vs_plan_amount || 0);
                    const devPlanPct = String(
                      row.contract_vs_plan_percent || '0.00%'
                    );

                    const isEmptyMethodRow =
                      !isTotalRow &&
                      planCurrent === 0 &&
                      planCapital === 0 &&
                      commitmentCurrent === 0 &&
                      commitmentCapital === 0 &&
                      contractCount === 0 &&
                      contractAmount === 0;

                    return (
                      <tr
                        key={idx}
                        className={
                          isTotalRow ? 'font-bold bg-white text-slate-950' : 'bg-white text-slate-900'
                        }
                      >
                        {isTotalRow ? (
                          <td
                            colSpan={2}
                            className="border border-slate-800 px-3 py-2 text-center align-middle font-bold"
                          >
                            {row.procurement_method || 'សរុប'}
                          </td>
                        ) : (
                          <>
                            <td className="border border-slate-800 px-2 py-2 text-center align-middle font-mono">
                              {row.no ?? idx + 1}
                            </td>
                            <td className="border border-slate-800 px-3 py-2 text-left align-middle">
                              {row.procurement_method}
                            </td>
                          </>
                        )}

                        {/* 3. ផែនការ → ទឹកប្រាក់ផែនការ → ថវិកាចរន្ត */}
                        <td className="border border-slate-800 px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {isEmptyMethodRow && planCurrent === 0
                            ? '-'
                            : formatUSD(planCurrent)}
                        </td>

                        {/* 4. ផែនការ → ទឹកប្រាក់ផែនការ → ថវិកាមូលធន */}
                        <td className="border border-slate-800 px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {isEmptyMethodRow && planCapital === 0
                            ? '-'
                            : formatUSD(planCapital)}
                        </td>

                        {/* 5. ការអនុវត្តជាក់ស្តែង → ទឹកប្រាក់ធានាចំណាយ → ថវិកាចរន្ត */}
                        <td className="border border-slate-800 px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {isEmptyMethodRow && commitmentCurrent === 0
                            ? '-'
                            : formatUSD(commitmentCurrent)}
                        </td>

                        {/* 6. ការអនុវត្តជាក់ស្តែង → ទឹកប្រាក់ធានាចំណាយ → ថវិកាមូលធន */}
                        <td className="border border-slate-800 px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {isEmptyMethodRow && commitmentCapital === 0
                            ? '-'
                            : formatUSD(commitmentCapital)}
                        </td>

                        {/* 7. ការអនុវត្តជាក់ស្តែង → ចំនួនកិច្ចសន្យា */}
                        <td className="border border-slate-800 px-2 py-2 text-center align-middle font-mono whitespace-nowrap">
                          {contractCount === 0
                            ? isEmptyMethodRow
                              ? 'គ្មាន'
                              : '0'
                            : contractCount.toLocaleString('en-US')}
                        </td>

                        {/* 8. ការអនុវត្តជាក់ស្តែង → តម្លៃកិច្ចសន្យា */}
                        <td className="border border-slate-800 px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {isEmptyMethodRow && contractAmount === 0
                            ? '-'
                            : formatUSD(contractAmount)}
                        </td>

                        {/* 9. ការប្រៀបធៀប → លម្អៀងធៀបនឹងធានាចំណាយ → ទឹកប្រាក់ */}
                        <td className="border border-slate-800 px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {isEmptyMethodRow && devCommitmentAmt === 0
                            ? '-'
                            : formatUSD(devCommitmentAmt)}
                        </td>

                        {/* 10. ការប្រៀបធៀប → លម្អៀងធៀបនឹងធានាចំណាយ → សមាមាត្រ % */}
                        <td className="border border-slate-800 px-2 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {devCommitmentPct}
                        </td>

                        {/* 11. ការប្រៀបធៀប → លម្អៀងធៀបនឹងផែនការ → ទឹកប្រាក់ */}
                        <td className="border border-slate-800 px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {isEmptyMethodRow && devPlanAmt === 0
                            ? '-'
                            : formatUSD(devPlanAmt)}
                        </td>

                        {/* 12. ការប្រៀបធៀប → លម្អៀងធៀបនឹងផែនការ → សមាមាត្រ % */}
                        <td className="border border-slate-800 px-2 py-2 text-right align-middle font-mono whitespace-nowrap">
                          {devPlanPct}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* OFFICIAL REPORT SIGNATURE FOOTER */}
          <div className="mt-10 pt-4 flex justify-between text-xs text-slate-950">
            <div className="text-center min-w-[200px]">
              <p className="font-bold">បានឃើញ និងពិនិត្យត្រឹមត្រូវ</p>
              <p className="font-bold mt-1">ប្រធានគណៈកម្មាធិការលទ្ធកម្ម</p>
              <div className="h-14" />
              <p className="font-bold text-slate-950">
                ប្រធាននាយកដ្ឋានលទ្ធកម្មសាធារណៈ
              </p>
            </div>

            <div className="text-center min-w-[220px]">
              <p>
                រាជធានីភ្នំពេញ, {formatKhmerDate(new Date().toISOString())}
              </p>
              <p className="font-bold mt-1">អ្នកធ្វើរបាយការណ៍</p>
              <div className="h-14" />
              <p className="font-bold text-slate-950">
                {user?.full_name || 'មន្ត្រីរៀបចំ'}
              </p>
              <p className="text-[11px] text-slate-700">
                {user?.position || 'មន្ត្រីលទ្ធកម្ម'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 sm:p-12 rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0">

          {/* GOVERNMENT LETTERHEAD */}
          <div className="text-center pb-6 border-b-2 border-slate-900 mb-6">

            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
              ព្រះរាជាណាចក្រកម្ពុជា
            </h2>

            <h3 className="text-xs font-semibold text-slate-700 tracking-wider mt-0.5">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </h3>

            <div className="w-16 h-0.5 bg-slate-400 mx-auto my-2" />

            <h4 className="text-xs font-bold text-slate-800">
              {reportData?.metadata?.organization ||
                'ក្រសួងសុខាភិបាល - នាយកដ្ឋានលទ្ធកម្មសាធារណៈ'}
            </h4>

            <h1 className="text-xl font-bold text-blue-900 mt-3">
              {reportData?.title || 'របាយការណ៍'}
            </h1>

            <p className="text-xs text-slate-500 mt-1">
              កាលបរិច្ឆេទរបាយការណ៍:{' '}
              {formatKhmerDate(new Date().toISOString())}

              {fiscalYear
                ? ` • ឆ្នាំថវិកា: ${fiscalYear}`
                : ''}
            </p>
          </div>

          {/* =====================================================
              SUMMARY
          ====================================================== */}
          {reportData?.summary && (
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">

              {Object.entries(reportData.summary).map(
                ([k, val]: [string, any]) => (
                  <div
                    key={k}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="text-[11px] text-slate-500 uppercase">
                      {k.replace(/_/g, ' ')}
                    </div>

                    <div className="text-base font-bold text-slate-800 font-mono mt-0.5">
                      {typeof val === 'number' &&
                      (k.includes('amount') ||
                        k.includes('value') ||
                        k.includes('requested') ||
                        k.includes('approved'))
                        ? formatUSD(val)
                        : val}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* =====================================================
              REPORT DATA TABLE
          ====================================================== */}
          <div className="overflow-x-auto">

            <table className="w-full text-left border-collapse text-xs border border-slate-300">

              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">

                  {reportData?.data &&
                    reportData.data.length > 0 &&
                    Object.keys(reportData.data[0]).map(
                      (colKey) => (
                        <th
                          key={colKey}
                          className="px-3 py-2.5 border border-slate-300 uppercase"
                        >
                          {colKey.replace(/_/g, ' ')}
                        </th>
                      )
                    )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">

                {/* LOADING */}
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-8 text-center text-slate-400"
                    >
                      កំពុងទាញយកទិន្នន័យរបាយការណ៍...
                    </td>
                  </tr>
                ) : !reportData?.data ||
                  reportData.data.length === 0 ? (
                  /* EMPTY */
                  <tr>
                    <td
                      colSpan={10}
                      className="py-8 text-center text-slate-400"
                    >
                      មិនមានទិន្នន័យសម្រាប់លក្ខខណ្ឌនេះទេ
                    </td>
                  </tr>
                ) : (
                  /* DATA */
                  reportData.data.map(
                    (row: any, idx: number) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50"
                      >
                        {Object.entries(row).map(
                          ([k, cell]: [string, any]) => (
                            <td
                              key={k}
                              className="px-3 py-2 border border-slate-200"
                            >
                              {typeof cell === 'number' &&
                              (k.includes('amount') ||
                                k.includes('difference'))
                                ? formatUSD(cell)
                                : String(cell ?? '-')}
                            </td>
                          )
                        )}
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* =====================================================
              OFFICIAL REPORT SIGNATURE FOOTER
          ====================================================== */}
          <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between text-xs text-slate-700">

            <div className="text-left">

              <p className="font-semibold">
                រៀបចំដោយ:
              </p>

              <p className="mt-8 font-bold text-slate-900">
                {user?.full_name || 'មន្ត្រីរៀបចំ'}
              </p>

              <p className="text-[11px] text-slate-500">
                {user?.position || 'មន្ត្រីលទ្ធកម្ម'}
              </p>
            </div>

            <div className="text-right">

              <p className="font-semibold">
                រាជធានីភ្នំពេញ,{' '}
                {formatKhmerDate(
                  new Date().toISOString()
                )}
              </p>

              <p className="font-semibold mt-1">
                បានឃើញ និងឯកភាព
              </p>

              <p className="font-bold text-slate-900 mt-8">
                ប្រធាននាយកដ្ឋានលទ្ធកម្មសាធារណៈ
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PRINT CSS
      ====================================================== */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }

          aside,
          header,
          nav,
          .print\\:hidden {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          table {
            width: 100% !important;
            page-break-inside: auto;
            border-collapse: collapse !important;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
}
import React from 'react';
import { Search, Plus, RefreshCw, Download, ChevronLeft, ChevronRight, Eye, Edit2, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title: string;
  subtitle?: string;
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onRefresh?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  canAdd?: boolean;
  filters?: React.ReactNode;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (newPage: number) => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  exportFileName?: string;
}

export function DataTable<T extends Record<string, any>>({
  title,
  subtitle,
  columns,
  data,
  loading = false,
  searchPlaceholder = 'ស្វែងរក...',
  searchTerm = '',
  onSearchChange,
  onRefresh,
  onAdd,
  addLabel = 'បន្ថែមថ្មី',
  canAdd = false,
  filters,
  pagination,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  exportFileName = 'Procurement_Export',
}: DataTableProps<T>) {
  const handleExportExcel = () => {
    try {
      const exportRows = data.map((item, idx) => {
        const row: Record<string, any> = { 'ល.រ': idx + 1 };
        columns.forEach((col) => {
          if (col.key !== 'actions') {
            row[col.header] = item[col.key];
          }
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, `${exportFileName}_${new Date().toISOString().substring(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const hasRowActions = !!(onView || onEdit || onDelete);

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      {/* Table Header Section */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              type="button"
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              title="ទាញយកឡើងវិញ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">ផ្ទុកឡើងវិញ</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            type="button"
            className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            title="នាំចេញជា Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>នាំចេញ Excel</span>
          </button>

          {canAdd && onAdd && (
            <button
              onClick={onAdd}
              type="button"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{addLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {onSearchChange ? (
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        ) : (
          <div />
        )}

        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
              {hasRowActions && (
                <th className="px-4 py-3.5 text-right w-28">សកម្មភាព</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (hasRowActions ? 1 : 0)} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  កំពុងទាញយកទិន្នន័យ...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasRowActions ? 1 : 0)} className="py-12 text-center text-slate-400">
                  មិនមានទិន្នន័យបង្ហាញទេ (No records found)
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                      {col.render ? col.render(row, idx) : row[col.key] ?? '-'}
                    </td>
                  ))}
                  {hasRowActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(row)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                            title="មើលព័ត៌មានលម្អិត"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit && onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-sm transition-colors"
                            title="កែប្រែ"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-colors"
                            title="លុប"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            បង្ហាញ {data.length} នៃសរុប {pagination.total} កំណត់ត្រា (ទំព័រ {pagination.page} នៃ {pagination.totalPages})
          </div>
          <div className="flex items-center space-x-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange && onPageChange(pagination.page - 1)}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-medium text-slate-700 bg-slate-100 rounded-md">
              {pagination.page}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange && onPageChange(pagination.page + 1)}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Eye, FileCode2, History } from 'lucide-react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { api } from '../../services/api.js';
import { formatDateTime } from '../../utils/formatters.js';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Detail Modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          action: actionFilter,
          module: moduleFilter,
          from_date: fromDate,
          to_date: toDate,
        },
      });
      if (res.data.success) {
        setLogs(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, searchTerm, actionFilter, moduleFilter, fromDate, toDate]);

  const handleOpenDetail = (log: any) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'LOGIN':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'LOGOUT':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'RESET_PASSWORD':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'created_at',
      header: 'កាលបរិច្ឆេទ & ម៉ោង',
      className: 'w-40 font-mono text-slate-600',
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: 'user',
      header: 'អ្នកប្រើប្រាស់',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800">{row.user_full_name}</div>
          <div className="text-[11px] text-slate-400 font-mono">@{row.username}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'សកម្មភាព',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeClass(
            row.action
          )}`}
        >
          {row.action}
        </span>
      ),
    },
    {
      key: 'module',
      header: 'ផ្នែក / ម៉ូឌុល',
      className: 'font-medium text-slate-800',
    },
    {
      key: 'table_name',
      header: 'តារាង',
      className: 'font-mono text-slate-500',
    },
    {
      key: 'record_id',
      header: 'លេខសម្គាល់កត់ត្រា',
      className: 'font-mono font-bold text-slate-700',
      render: (row) => row.record_id || '-',
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      className: 'font-mono text-slate-500',
    },
    {
      key: 'actions',
      header: 'ព័ត៌មានលម្អិត',
      className: 'text-right',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenDetail(row)}
          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-sm"
          title="មើលទិន្នន័យលម្អិត"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="ប្រវត្តិសកម្មភាពក្នុងប្រព័ន្ធ (Audit Logs)"
        subtitle="កំណត់ត្រាស្វ័យប្រវត្តិនូវរាល់ការចូលប្រើប្រាស់ ការបង្កើត ការកែប្រែ និងការលុបទិន្នន័យ"
        columns={columns}
        data={logs}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមសកម្មភាព, អ្នកប្រើ, ម៉ូឌុល..."
        onRefresh={fetchLogs}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Audit_Logs"
        filters={
          <>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">គ្រប់សកម្មភាព</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="RESET_PASSWORD">RESET_PASSWORD</option>
            </select>

            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">គ្រប់ផ្នែក</option>
              <option value="គម្រោង">គម្រោង</option>
              <option value="សំណើគម្រោង">សំណើគម្រោង</option>
              <option value="ការដេញថ្លៃ">ការដេញថ្លៃ</option>
              <option value="ក្រុមហ៊ុនដាក់សំណើ">ក្រុមហ៊ុនដាក់សំណើ</option>
              <option value="កិច្ចសន្យា">កិច្ចសន្យា</option>
              <option value="ប្រគល់-ទទួល">ប្រគល់-ទទួល</option>
              <option value="ការធានា">ការធានា</option>
              <option value="អ្នកប្រើប្រាស់">អ្នកប្រើប្រាស់</option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="ចាប់ពីថ្ងៃ"
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2 focus:outline-hidden"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="ដល់ថ្ងៃ"
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2 focus:outline-hidden"
            />
          </>
        }
      />

      {/* Audit Log Detail Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="ព័ត៌មានលម្អិតនៃកំណត់ត្រាសកម្មភាព"
        maxWidth="2xl"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500">អ្នកប្រើប្រាស់: </span>
                <span className="font-semibold text-slate-800">
                  {selectedLog.user_full_name} (@{selectedLog.username})
                </span>
              </div>
              <div>
                <span className="text-slate-500">កាលបរិច្ឆេទ & ម៉ោង: </span>
                <span className="font-mono text-slate-800">{formatDateTime(selectedLog.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-500">សកម្មភាព: </span>
                <span className="font-bold text-slate-800">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-slate-500">ផ្នែក / តារាង: </span>
                <span className="font-mono text-slate-800">
                  {selectedLog.module} ({selectedLog.table_name})
                </span>
              </div>
              <div>
                <span className="text-slate-500">លេខកូដកត់ត្រា: </span>
                <span className="font-mono font-bold text-blue-600">{selectedLog.record_id || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">អាសយដ្ឋាន IP: </span>
                <span className="font-mono text-slate-800">{selectedLog.ip_address}</span>
              </div>
            </div>

            {/* JSON diff display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                  <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>ទិន្នន័យចាស់ (Old Data)</span>
                </div>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto text-[11px] font-mono max-h-60 border border-slate-800">
                  {selectedLog.old_data
                    ? JSON.stringify(selectedLog.old_data, null, 2)
                    : '// គ្មានទិន្នន័យចាស់ (null)'}
                </pre>
              </div>

              <div>
                <div className="font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                  <FileCode2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>ទិន្នន័យថ្មី (New Data)</span>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg overflow-x-auto text-[11px] font-mono max-h-60 border border-slate-800">
                  {selectedLog.new_data
                    ? JSON.stringify(selectedLog.new_data, null, 2)
                    : '// គ្មានទិន្នន័យថ្មី (null)'}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 rounded-lg text-xs"
              >
                បិទផ្ទាំង
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

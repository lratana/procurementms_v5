import React, { useState, useEffect } from 'react';
import { Laptop, Smartphone, Monitor, ShieldAlert, ShieldCheck } from 'lucide-react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatDateTime } from '../../utils/formatters.js';

export function DevicesPage() {
  const { isAdmin } = useAuth();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/devices', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          status: statusFilter,
        },
      });
      if (res.data.success) {
        setDevices(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch devices error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [pagination.page, searchTerm, statusFilter]);

  const handleToggleStatus = async (dev: any) => {
    const actionText = dev.status === 'active' ? 'ផ្អាកដំណើរការ' : 'បើកដំណើរការ';
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់ ${actionText} ឧបករណ៍ "${dev.device_name}" នេះមែនទេ?`)) return;

    try {
      const res = await api.patch(`/devices/${dev.device_id}/status`, {
        status: dev.status === 'active' ? 'disabled' : 'active',
      });
      if (res.data.success) {
        fetchDevices();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleDelete = async (dev: any) => {
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់លុបឧបករណ៍ "${dev.device_name}" ចេញពីប្រព័ន្ធមែនទេ?`)) return;
    try {
      const res = await api.delete(`/devices/${dev.device_id}`);
      if (res.data.success) {
        fetchDevices();
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
      key: 'device_name',
      header: 'ឈ្មោះឧបករណ៍',
      render: (row) => (
        <div className="flex items-center space-x-2">
          {row.device_type?.includes('Mobile') ? (
            <Smartphone className="w-4 h-4 text-slate-500" />
          ) : (
            <Laptop className="w-4 h-4 text-slate-500" />
          )}
          <div>
            <div className="font-semibold text-slate-800">{row.device_name}</div>
            <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
              {row.device_identifier}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'អ្នកប្រើប្រាស់',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row.user_full_name}</div>
          <div className="text-[11px] text-slate-400 font-mono">@{row.username}</div>
        </div>
      ),
    },
    {
      key: 'operating_system',
      header: 'ប្រព័ន្ធប្រតិបត្តិការ / កម្មវិធីរុករក',
      render: (row) => (
        <div>
          <div className="text-slate-800">{row.operating_system}</div>
          <div className="text-[11px] text-slate-400">{row.browser}</div>
        </div>
      ),
    },
    {
      key: 'ip_address',
      header: 'អាសយដ្ឋាន IP',
      className: 'font-mono text-slate-700',
    },
    {
      key: 'first_login_at',
      header: 'ចូលលើកដំបូង',
      render: (row) => <span className="font-mono text-slate-500">{formatDateTime(row.first_login_at)}</span>,
    },
    {
      key: 'last_login_at',
      header: 'ចូលចុងក្រោយ',
      render: (row) => <span className="font-mono text-slate-700 font-medium">{formatDateTime(row.last_login_at)}</span>,
    },
    {
      key: 'status',
      header: 'ស្ថានភាព',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'សកម្មភាព',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end space-x-1">
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className={`p-1 rounded-sm ${
              row.status === 'active'
                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={row.status === 'active' ? 'ផ្អាកឧបករណ៍' : 'បើកដំណើរការ'}
          >
            {row.status === 'active' ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="គ្រប់គ្រងឧបករណ៍ (Device Management)"
        subtitle="តាមដានម៉ាស៊ីនកុំព្យូទ័រ កម្មវិធីរុករក អាសយដ្ឋាន IP និងកំណត់ត្រាចូលប្រើប្រាស់"
        columns={columns}
        data={devices}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមឈ្មោះឧបករណ៍, IP, ប្រព័ន្ធប្រតិបត្តិការ..."
        onRefresh={fetchDevices}
        canDelete={isAdmin}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Devices"
        filters={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
          >
            <option value="">គ្រប់ស្ថានភាព</option>
            <option value="active">សកម្ម (Active)</option>
            <option value="disabled">ផ្អាកដំណើរការ (Disabled)</option>
          </select>
        }
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { KeyRound, Shield, UserCheck, UserX, UserPlus } from 'lucide-react';
import { DataTable, Column } from '../../components/DataTable/DataTable.js';
import { Modal } from '../../components/Modal/Modal.js';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatDateTime } from '../../utils/formatters.js';

export function UsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Create / Edit User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    phone_number: '',
    role: 'viewer',
    department: '',
    position: '',
    status: 'active',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Reset Password Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          role: roleFilter,
          status: statusFilter,
        },
      });
      if (res.data.success) {
        setUsers(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, searchTerm, roleFilter, statusFilter]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingUserId(null);
    setFormData({
      username: '',
      password: '',
      full_name: '',
      email: '',
      phone_number: '',
      role: 'viewer',
      department: '',
      position: '',
      status: 'active',
    });
    setFormError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setModalMode('edit');
    setEditingUserId(user.user_id);
    setFormData({
      username: user.username,
      password: '',
      full_name: user.full_name,
      email: user.email || '',
      phone_number: user.phone_number || '',
      role: user.role,
      department: user.department || '',
      position: user.position || '',
      status: user.status,
    });
    setFormError(null);
    setIsUserModalOpen(true);
  };

  const handleToggleStatus = async (user: any) => {
    const actionText = user.status === 'active' ? 'ផ្អាកដំណើរការ' : 'បើកដំណើរការ';
    if (!window.confirm(`តើលោកអ្នកពិតជាចង់ ${actionText} គណនី "${user.username}" មែនទេ?`)) return;

    try {
      const res = await api.patch(`/users/${user.user_id}/status`, {
        status: user.status === 'active' ? 'inactive' : 'active',
      });
      if (res.data.success) {
        fetchUsers();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleOpenReset = (user: any) => {
    setResetUserId(user.user_id);
    setNewPassword('');
    setResetError(null);
    setIsResetModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (modalMode === 'create') {
        const res = await api.post('/users', formData);
        if (res.data.success) {
          setIsUserModalOpen(false);
          fetchUsers();
        }
      } else {
        const res = await api.put(`/users/${editingUserId}`, formData);
        if (res.data.success) {
          setIsUserModalOpen(false);
          fetchUsers();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
    }
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!newPassword || newPassword.length < 6) {
      setResetError('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦តួអក្សរ');
      return;
    }

    try {
      const res = await api.patch(`/users/${resetUserId}/reset-password`, { new_password: newPassword });
      if (res.data.success) {
        setIsResetModalOpen(false);
        alert('បានកំណត់ពាក្យសម្ងាត់ថ្មីដោយជោគជ័យ');
      }
    } catch (err: any) {
      setResetError(err.response?.data?.message || 'ប្រតិបត្តិការមិនបានសម្រេច');
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
      key: 'username',
      header: 'ឈ្មោះអ្នកប្រើប្រាស់',
      className: 'font-mono font-bold text-slate-900',
    },
    {
      key: 'full_name',
      header: 'ឈ្មោះពេញ',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-800">{row.full_name}</div>
          {row.email && <div className="text-[11px] text-slate-400 font-mono">{row.email}</div>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'តួនាទី',
      render: (row) => <StatusBadge status={row.role} />,
    },
    {
      key: 'department',
      header: 'អង្គភាព / ផ្នែក',
      render: (row) => (
        <div>
          <div className="text-slate-800">{row.department || '-'}</div>
          {row.position && <div className="text-[11px] text-slate-400">{row.position}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'ស្ថានភាព',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'last_login_at',
      header: 'ចូលប្រើចុងក្រោយ',
      render: (row) => <span className="font-mono text-slate-500">{formatDateTime(row.last_login_at)}</span>,
    },
    {
      key: 'custom_actions',
      header: 'សកម្មភាព',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end space-x-1">
          <button
            type="button"
            onClick={() => handleOpenReset(row)}
            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-sm"
            title="កំណត់ពាក្យសម្ងាត់ឡើងវិញ"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleStatus(row)}
            className={`p-1 rounded-sm ${
              row.status === 'active'
                ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={row.status === 'active' ? 'ផ្អាកដំណើរការ' : 'បើកដំណើរការ'}
          >
            {row.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        title="គ្រប់គ្រងអ្នកប្រើប្រាស់ (Users Management)"
        subtitle="បញ្ជីឈ្មោះមន្ត្រី តួនាទីសិទ្ធិអំណាច (Admin, Editor, Viewer) និងការកំណត់គណនី"
        columns={columns}
        data={users}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="ស្វែងរកតាមឈ្មោះ, អ៊ីមែល, ឬអង្គភាព..."
        onRefresh={fetchUsers}
        onAdd={handleOpenCreate}
        addLabel="បង្កើតអ្នកប្រើប្រាស់ថ្មី"
        canAdd={isAdmin}
        canEdit={isAdmin}
        onEdit={handleOpenEdit}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        exportFileName="Cambodian_Procurement_Users"
        filters={
          <>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">គ្រប់តួនាទី</option>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:outline-hidden"
            >
              <option value="">គ្រប់ស្ថានភាព</option>
              <option value="active">សកម្ម (Active)</option>
              <option value="inactive">អសកម្ម (Inactive)</option>
            </select>
          </>
        }
      />

      {/* User Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={modalMode === 'create' ? 'បង្កើតអ្នកប្រើប្រាស់ថ្មី' : 'កែប្រែព័ត៌មានអ្នកប្រើប្រាស់'}
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ឈ្មោះគណនី (Username) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={modalMode === 'edit'}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="ឧ. chinda.sokh"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            {modalMode === 'create' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ពាក្យសម្ងាត់ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ឈ្មោះពេញ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="ឧ. លោក សុខ ចិន្តា"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">អ៊ីមែល (Email)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@procurement.gov.kh"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">លេខទូរស័ព្ទ</label>
              <input
                type="text"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="012 345 678"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">តួនាទី (Role)</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              >
                <option value="viewer">Viewer (អ្នកមើលប៉ុណ្ណោះ)</option>
                <option value="editor">Editor (អ្នកកែសម្រួលទិន្នន័យ)</option>
                <option value="admin">Admin (អ្នកគ្រប់គ្រងប្រព័ន្ធ)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ស្ថានភាព</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              >
                <option value="active">សកម្ម (Active)</option>
                <option value="inactive">អសកម្ម (Inactive)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">អង្គភាព / នាយកដ្ឋាន</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="ឧ. នាយកដ្ឋានលទ្ធកម្ម..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">មុខតំណែង</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="ឧ. ប្រធានការិយាល័យ..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
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

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="កំណត់ពាក្យសម្ងាត់ឡើងវិញ (Reset Password)"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveResetPassword} className="space-y-4">
          {resetError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {resetError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ពាក្យសម្ងាត់ថ្មី (New Password) <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="យ៉ាងតិច ៦តួអក្សរ"
              className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>
          <div className="pt-4 border-t flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              ប្តូរពាក្យសម្ងាត់
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

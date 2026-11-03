import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User as UserIcon, AlertTriangle, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const res = await api.get('/dashboard/recent-activities');
        if (res.data?.success && res.data?.data?.alerts) {
          setAlerts(res.data.data.alerts);
        }
      } catch (err) {
        // quiet fallback
      }
    }
    loadAlerts();
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Map route to Khmer breadcrumb title
  const getBreadcrumbTitle = (path: string) => {
    if (path === '/') return 'ផ្ទាំងគ្រប់គ្រង';
    if (path.startsWith('/projects/')) return 'ព័ត៌មានលម្អិតគម្រោង';
    if (path.startsWith('/projects')) return 'បញ្ជីគម្រោង';
    if (path.startsWith('/project-requests')) return 'សំណើគម្រោង';
    if (path.startsWith('/bidding')) return 'ដំណើរការដេញថ្លៃ';
    if (path.startsWith('/bidders')) return 'ក្រុមហ៊ុនដាក់សំណើដេញថ្លៃ';
    if (path.startsWith('/contracts')) return 'កិច្ចសន្យា';
    if (path.startsWith('/handovers')) return 'ប្រគល់-ទទួលគម្រោង';
    if (path.startsWith('/warranties')) return 'ការធានាគម្រោង';
    if (path.startsWith('/users')) return 'គ្រប់គ្រងអ្នកប្រើប្រាស់';
    if (path.startsWith('/devices')) return 'គ្រប់គ្រងឧបករណ៍';
    if (path.startsWith('/audit-logs')) return 'ប្រវត្តិសកម្មភាពក្នុងប្រព័ន្ធ';
    if (path.startsWith('/reports')) return 'របាយការណ៍ស្ថិតិ';
    return 'ទំព័រដើម';
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 px-6 flex items-center justify-between shadow-xs">
      {/* Breadcrumb and Page Context */}
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-slate-400">ប្រព័ន្ធលទ្ធកម្ម</span>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-slate-800">{getBreadcrumbTitle(location.pathname)}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAlerts(!showAlerts)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"
            title="ការជូនដំណឹង"
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  ការជូនដំណឹងសំខាន់ៗ ({alerts.length})
                </span>
                <button
                  onClick={() => setShowAlerts(false)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  បិទ
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {alerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">គ្មានការជូនដំណឹងថ្មីទេ</div>
                ) : (
                  alerts.map((alt, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-50 transition-colors text-xs">
                      <div className="flex items-center space-x-2 mb-1">
                        {alt.type === 'danger' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        ) : alt.type === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                        )}
                        <span className="font-semibold text-slate-800">{alt.title}</span>
                      </div>
                      <p className="text-slate-600 pl-5">{alt.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* User Profile */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold overflow-hidden shadow-xs">
            {user?.profile_photo ? (
              <img src={user.profile_photo} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-4 h-4" />
            )}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-slate-800 leading-tight">{user?.full_name}</div>
            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
              <Shield className="w-3 h-3 text-blue-600" />
              <span className="capitalize font-medium">
                {user?.role === 'admin' ? 'អ្នកគ្រប់គ្រង' : user?.role === 'editor' ? 'អ្នកកែសម្រួល' : 'អ្នកមើល'}
              </span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          type="button"
          title="ចាកចេញ (Logout)"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

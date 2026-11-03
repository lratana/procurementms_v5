import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  FileSpreadsheet,
  Gavel,
  Building2,
  FileCheck2,
  Truck,
  ShieldCheck,
  Users2,
  Laptop2,
  History,
  FileBarChart2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export function Sidebar() {
  const { user, isAdmin } = useAuth();

  const menuItems = [
    { to: '/', label: 'ផ្ទាំងគ្រប់គ្រង', icon: LayoutDashboard },
    { to: '/projects', label: 'គម្រោង', icon: FolderKanban },
    { to: '/project-requests', label: 'សំណើគម្រោង', icon: FileSpreadsheet },
    { to: '/bidding', label: 'ការដេញថ្លៃ', icon: Gavel },
    { to: '/bidders', label: 'ក្រុមហ៊ុនដាក់សំណើ', icon: Building2 },
    { to: '/contracts', label: 'កិច្ចសន្យា', icon: FileCheck2 },
    { to: '/handovers', label: 'ប្រគល់-ទទួល', icon: Truck },
    { to: '/warranties', label: 'ការធានា', icon: ShieldCheck },
    ...(isAdmin
      ? [
          { to: '/users', label: 'អ្នកប្រើប្រាស់', icon: Users2 },
          { to: '/devices', label: 'ឧបករណ៍', icon: Laptop2 },
          { to: '/audit-logs', label: 'ប្រវត្តិសកម្មភាព', icon: History },
        ]
      : []),
    { to: '/reports', label: 'របាយការណ៍', icon: FileBarChart2 },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800 select-none z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center space-x-3 bg-slate-950/60">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold shrink-0">
          <Sparkles className="w-6 h-6 text-amber-300" />
        </div>
        <div className="overflow-hidden">
          <div className="text-[11px] font-medium tracking-wider text-amber-400 uppercase">
            ព្រះរាជាណាចក្រកម្ពុជា
          </div>
          <div className="text-sm font-bold text-white tracking-tight truncate">
            ប្រព័ន្ធគ្រប់គ្រងលទ្ធកម្ម
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
          ម៉ឺនុយចម្បង (Main Menu)
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Organization Tag */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-center">
        <p className="text-[11px] text-slate-400">នាយកដ្ឋានលទ្ធកម្មសាធារណៈ</p>
        <p className="text-[10px] text-slate-400 font-mono">v1.0.0 • MySQL 8.0</p>
      </div>
    </aside>
  );
}

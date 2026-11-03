import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar/Sidebar.js';
import { Header } from '../Header/Header.js';

export function MainLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 antialiased">
      {/* Navy Blue Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

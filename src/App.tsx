import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { MainLayout } from './components/Layout/MainLayout.js';
import { LoginPage } from './pages/Login/LoginPage.js';
import { DashboardPage } from './pages/Dashboard/DashboardPage.js';
import { ProjectsPage } from './pages/Projects/ProjectsPage.js';
import { ProjectDetailPage } from './pages/Projects/ProjectDetailPage.js';
import { ProjectRequestsPage } from './pages/ProjectRequests/ProjectRequestsPage.js';
import { BiddingPage } from './pages/Bidding/BiddingPage.js';
import { BiddersPage } from './pages/Bidders/BiddersPage.js';
import { ContractsPage } from './pages/Contracts/ContractsPage.js';
import { HandoversPage } from './pages/Handovers/HandoversPage.js';
import { WarrantiesPage } from './pages/Warranties/WarrantiesPage.js';
import { UsersPage } from './pages/Users/UsersPage.js';
import { DevicesPage } from './pages/Devices/DevicesPage.js';
import { AuditLogsPage } from './pages/AuditLogs/AuditLogsPage.js';
import { ReportsPage } from './pages/Reports/ReportsPage.js';

// Protected Route Guard
function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-medium text-sm">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>កំពុងផ្ទៀងផ្ទាត់សិទ្ធិប្រើប្រាស់...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="project-requests" element={<ProjectRequestsPage />} />
            <Route path="bidding" element={<BiddingPage />} />
            <Route path="bidders" element={<BiddersPage />} />
            <Route path="contracts" element={<ContractsPage />} />
            <Route path="handovers" element={<HandoversPage />} />
            <Route path="warranties" element={<WarrantiesPage />} />

            {/* Admin only routes */}
            <Route
              path="users"
              element={
                <ProtectedRoute requireAdmin>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="devices"
              element={
                <ProtectedRoute requireAdmin>
                  <DevicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute requireAdmin>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />

            <Route path="reports" element={<ReportsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

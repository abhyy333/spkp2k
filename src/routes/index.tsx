import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { AppLayout } from '../components/layout/AppLayout';
import { AppLoader } from '../components/ui/AppLoader';

// Auth Pages
import { AuthPage } from '../pages/auth/AuthPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { MasterDataPage } from '../pages/admin/MasterDataPage';
import { UnifiedSchedulingPage } from '../pages/admin/UnifiedSchedulingPage';
import { SettingsPage } from '../pages/admin/SettingsPage';

// Lecturer Pages
import { LecturerDashboard } from '../pages/lecturer/LecturerDashboard';
import { LecturerProfilePage } from '../pages/lecturer/LecturerProfilePage';
import { OfficialScheduleTablePage } from '../pages/public/OfficialScheduleTablePage';

// Lazy Loaded Heavy Pages for Performance
const ExamSchedulePage = React.lazy(() =>
  import('../pages/admin/ExamSchedulePage').then((m) => ({ default: m.ExamSchedulePage }))
);
const VersionHistoryPage = React.lazy(() =>
  import('../pages/admin/VersionHistoryPage').then((m) => ({ default: m.VersionHistoryPage }))
);
const AccountManagementPage = React.lazy(() =>
  import('../pages/admin/AccountManagementPage').then((m) => ({ default: m.AccountManagementPage }))
);

const LazyFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
  </div>
);

// Error Pages
import { ForbiddenPage } from '../pages/error/ForbiddenPage';
import { NotFoundPage } from '../pages/error/NotFoundPage';

import { useAuth } from '../contexts/AuthContext';

/**
 * Unified Dashboard component that serves either LecturerDashboard or AdminDashboard
 * based on the authenticated user's role.
 */
const UnifiedDashboard: React.FC = () => {
  const { role } = useAuth();
  if (role === 'DOSEN') {
    return <LecturerDashboard />;
  }
  return <AdminDashboard />;
};

/**
 * Shared profile route.
 * Admin uses the existing Settings page because it already contains the
 * administrator profile editor; lecturers use their academic profile page.
 */
const UnifiedProfilePage: React.FC = () => {
  const { role } = useAuth();

  if (role === 'ADMIN') {
    return <SettingsPage />;
  }

  return <LecturerProfilePage />;
};

export const AppRoutes: React.FC = () => {
  const { authStatus, isAuthenticated } = useAuth();

  // 1. MUST WAIT FOR AUTH STATUS INITIALIZATION
  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ForgotPasswordPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      {/* Root redirect: authenticated goes to /dashboard, unauthenticated goes to /login */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
      />

      {/* Main Application Shell - Protected for ADMIN and DOSEN */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* ========================================================
            CORE SHARED ROUTES (ADMIN & DOSEN)
           ======================================================== */}
        <Route
          path="/dashboard"
          element={
            <RoleGuard allowedRoles={['ADMIN', 'DOSEN']}>
              <UnifiedDashboard />
            </RoleGuard>
          }
        />

        <Route
          path="/jadwal-perkuliahan"
          element={
            <RoleGuard allowedRoles={['ADMIN', 'DOSEN']}>
              <OfficialScheduleTablePage />
            </RoleGuard>
          }
        />

        <Route
          path="/jadwal-ujian"
          element={
            <RoleGuard allowedRoles={['ADMIN', 'DOSEN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <ExamSchedulePage />
              </React.Suspense>
            </RoleGuard>
          }
        />

        <Route
          path="/profil"
          element={
            <RoleGuard allowedRoles={['ADMIN', 'DOSEN']}>
              <UnifiedProfilePage />
            </RoleGuard>
          }
        />

        {/* Legacy redirects */}
        <Route path="/jadwal-saya" element={<Navigate to="/jadwal-perkuliahan" replace />} />
        <Route path="/dosen/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dosen/profil" element={<Navigate to="/profil" replace />} />
        <Route path="/dosen/jadwal-saya" element={<Navigate to="/jadwal-perkuliahan" replace />} />

        {/* ========================================================
            ADMIN ONLY ROUTES
           ======================================================== */}
        <Route
          path="/penyusunan-jadwal"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <UnifiedSchedulingPage />
            </RoleGuard>
          }
        />

        {/* Master Data: Single page with tabs */}
        <Route
          path="/master-data"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <MasterDataPage />
            </RoleGuard>
          }
        />
        <Route path="/data-mata-kuliah" element={<Navigate to="/master-data?tab=mata-kuliah" replace />} />
        <Route path="/data-dosen" element={<Navigate to="/master-data?tab=dosen" replace />} />
        <Route path="/ruangan" element={<Navigate to="/master-data?tab=ruangan" replace />} />
        <Route path="/slot-waktu" element={<Navigate to="/master-data?tab=slot-waktu" replace />} />
        <Route path="/penawaran-kelas" element={<Navigate to="/penyusunan-jadwal" replace />} />

        {/* Riwayat Versi Jadwal */}
        <Route
          path="/riwayat"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <VersionHistoryPage />
              </React.Suspense>
            </RoleGuard>
          }
        />
        <Route path="/riwayat-jadwal" element={<Navigate to="/riwayat" replace />} />
        <Route path="/riwayat-versi" element={<Navigate to="/riwayat" replace />} />

        {/* Account Management & Settings */}
        <Route
          path="/manajemen-akun"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <AccountManagementPage />
              </React.Suspense>
            </RoleGuard>
          }
        />
        <Route path="/pengaturan/akun" element={<Navigate to="/manajemen-akun" replace />} />
        <Route
          path="/pengaturan"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <SettingsPage />
            </RoleGuard>
          }
        />

        {/* Removed legacy features redirected cleanly */}
        <Route path="/konflik-jadwal" element={<Navigate to="/penyusunan-jadwal" replace />} />
        <Route path="/evaluasi-sa" element={<Navigate to="/penyusunan-jadwal" replace />} />
        <Route path="/laporan" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* 404 Catch All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

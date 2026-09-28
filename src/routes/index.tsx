import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { AppLayout } from '../components/layout/AppLayout';
import { AppLoader } from '../components/ui/AppLoader';

// Auth Pages
import { AuthPage } from '../pages/auth/AuthPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { CoursesPage } from '../pages/admin/CoursesPage';
import { LecturersPage } from '../pages/admin/LecturersPage';
import { RoomsPage } from '../pages/admin/RoomsPage';
import { TimeSlotsPage } from '../pages/admin/TimeSlotsPage';
import { CourseOfferingsPage } from '../pages/admin/CourseOfferingsPage';
import { ScheduleConflictsPage } from '../pages/admin/ScheduleConflictsPage';
import { ScheduleViewerPage } from '../pages/admin/ScheduleViewerPage';
import { UnifiedSchedulingPage } from '../pages/admin/UnifiedSchedulingPage';
import { SettingsPage } from '../pages/admin/SettingsPage';

// Lecturer Pages
import { LecturerDashboard } from '../pages/lecturer/LecturerDashboard';
import { LecturerProfilePage } from '../pages/lecturer/LecturerProfilePage';
import { AturJadwalSayaPage } from '../pages/public/AturJadwalSayaPage';
import { OfficialScheduleTablePage } from '../pages/public/OfficialScheduleTablePage';

// Lazy Loaded Heavy Pages for Performance
const ExamSchedulePage = React.lazy(() =>
  import('../pages/admin/ExamSchedulePage').then((m) => ({ default: m.ExamSchedulePage }))
);
const VersionHistoryPage = React.lazy(() =>
  import('../pages/admin/VersionHistoryPage').then((m) => ({ default: m.VersionHistoryPage }))
);
const ReportsPage = React.lazy(() =>
  import('../pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const AccountManagementPage = React.lazy(() =>
  import('../pages/admin/AccountManagementPage').then((m) => ({ default: m.AccountManagementPage }))
);
const SAEvaluationPage = React.lazy(() =>
  import('../pages/admin/SAEvaluationPage').then((m) => ({ default: m.SAEvaluationPage }))
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

export const AppRoutes: React.FC = () => {
  const { authStatus, effectiveAccessMode } = useAuth();

  // 1. MUST WAIT FOR AUTH STATUS INITIALIZATION
  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  // 2. Determine default landing route based on effective access mode
  const defaultDestination =
    effectiveAccessMode === 'GUEST' ? '/jadwal-perkuliahan' : '/dashboard';

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage defaultTab="login" />} />
      <Route path="/register" element={<AuthPage defaultTab="register" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to={defaultDestination} replace />} />

      {/* Main Application Shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* ========================================================
            PUBLIC SCHEDULE VIEWER ROUTES (GUEST, DOSEN, ADMIN)
            These routes bypass generic protected guards completely.
           ======================================================== */}
        <Route path="/jadwal-perkuliahan" element={<OfficialScheduleTablePage />} />
        <Route
          path="/jadwal-ujian"
          element={
            <React.Suspense fallback={<LazyFallback />}>
              <ExamSchedulePage />
            </React.Suspense>
          }
        />
        <Route path="/jadwal-saya" element={<AturJadwalSayaPage />} />

        {/* ========================================================
            AUTHENTICATED ONLY ROUTES (/dashboard & /profil)
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
          path="/profil"
          element={
            <RoleGuard allowedRoles={['ADMIN', 'DOSEN']}>
              <LecturerProfilePage />
            </RoleGuard>
          }
        />

        {/* Lecturer Aliases & Backward Compatibility */}
        <Route path="/dosen/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dosen/profil" element={<Navigate to="/profil" replace />} />
        <Route path="/dosen/jadwal-saya" element={<Navigate to="/profil" replace />} />

        {/* ========================================================
            ADMIN ONLY ROUTES (Strictly Protected)
           ======================================================== */}
        <Route
          path="/penyusunan-jadwal"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <UnifiedSchedulingPage />
            </RoleGuard>
          }
        />

        {/* Master Data Routes */}
        <Route
          path="/data-mata-kuliah"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <CoursesPage />
            </RoleGuard>
          }
        />
        <Route
          path="/data-dosen"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <LecturersPage />
            </RoleGuard>
          }
        />
        <Route
          path="/ruangan"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <RoomsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/slot-waktu"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <TimeSlotsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/penawaran-kelas"
          element={<Navigate to="/penyusunan-jadwal" replace />}
        />

        {/* Monitoring & Operational Routes */}
        <Route
          path="/konflik-jadwal"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <ScheduleConflictsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/riwayat-jadwal"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <VersionHistoryPage />
              </React.Suspense>
            </RoleGuard>
          }
        />
        <Route
          path="/riwayat-versi"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <VersionHistoryPage />
              </React.Suspense>
            </RoleGuard>
          }
        />
        <Route
          path="/evaluasi-sa"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <SAEvaluationPage />
              </React.Suspense>
            </RoleGuard>
          }
        />
        <Route
          path="/laporan"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <ReportsPage />
              </React.Suspense>
            </RoleGuard>
          }
        />

        {/* Administration & Settings Routes */}
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
        <Route
          path="/pengaturan/akun"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <React.Suspense fallback={<LazyFallback />}>
                <AccountManagementPage />
              </React.Suspense>
            </RoleGuard>
          }
        />
        <Route
          path="/pengaturan"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <SettingsPage />
            </RoleGuard>
          }
        />
      </Route>

      {/* 404 Catch All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

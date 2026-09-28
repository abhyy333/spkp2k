import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { ForbiddenPage } from '../pages/error/ForbiddenPage';
import { AppLoader } from '../components/ui/AppLoader';

interface RoleGuardProps {
  children: React.ReactElement;
  allowedRoles: UserRole[];
  allowGuest?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  allowGuest = false,
}) => {
  const {
    actualRole,
    effectiveRole,
    effectiveAccessMode,
    isOwnerAdmin,
    authStatus,
    user,
  } = useAuth();

  // 1. MUST WAIT until Auth initialization finishes
  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  // 2. If route explicitly permits guest access
  if (allowGuest) {
    return children;
  }

  // 3. When in GUEST access mode (unauthenticated or public viewer)
  if (effectiveAccessMode === 'GUEST') {
    // If not logged in at all, direct to login
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    // If logged-in owner is in preview mode GUEST, redirect to public schedule viewer
    // NEVER redirect to /login (which would cause oscillation with AuthPage)
    return <Navigate to="/jadwal-perkuliahan" replace />;
  }

  // 4. If unauthenticated
  if (authStatus === 'UNAUTHENTICATED' || !user) {
    return <Navigate to="/login" replace />;
  }

  // 5. Check authorized roles
  // System owner admin has full admin access
  if (isOwnerAdmin && allowedRoles.includes('ADMIN')) {
    return children;
  }

  const currentRole = effectiveRole || actualRole;
  if (currentRole && allowedRoles.includes(currentRole)) {
    return children;
  }

  // 6. Authorized user but wrong role (e.g. Dosen visiting Admin settings)
  return <ForbiddenPage />;
};

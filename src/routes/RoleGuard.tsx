import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { ForbiddenPage } from '../pages/error/ForbiddenPage';
import { AppLoader } from '../components/ui/AppLoader';

interface RoleGuardProps {
  children: React.ReactElement;
  allowedRoles: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
}) => {
  const {
    role,
    isOwnerAdmin,
    authStatus,
    user,
  } = useAuth();

  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  if (authStatus === 'UNAUTHENTICATED' || !user) {
    return <Navigate to="/login" replace />;
  }

  // System owner admin has full admin access
  if (isOwnerAdmin && allowedRoles.includes('ADMIN')) {
    return children;
  }

  if (role && allowedRoles.includes(role)) {
    return children;
  }

  return <ForbiddenPage />;
};

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppLoader } from '../components/ui/AppLoader';

export const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { authStatus, user } = useAuth();

  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  if (authStatus === 'UNAUTHENTICATED' || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

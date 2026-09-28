import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppLoader } from '../components/ui/AppLoader';

export const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { authStatus } = useAuth();

  if (authStatus === 'INITIALIZING') {
    return <AppLoader />;
  }

  return children;
};

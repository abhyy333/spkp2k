/**
 * SPK Penjadwalan Perkuliahan — Teknik Elektro Universitas Mataram
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AcademicTermProvider } from './contexts/AcademicTermContext';
import { ToastProvider } from './components/ui/Toast';
import { AppRoutes } from './routes';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AcademicTermProvider>
              <AppRoutes />
            </AcademicTermProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

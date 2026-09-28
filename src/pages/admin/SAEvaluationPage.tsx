import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Layers,
  Sparkles,
  Zap,
  Clock,
  RefreshCw,
  Award,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  OptimizationRun,
  ScheduleVersion,
  AcademicTerm,
} from '../../types';
import { saEvaluationService } from '../../services/saEvaluation.service';
import { scheduleVersionsService } from '../../services/scheduleVersions.service';
import { academicTermsService } from '../../services/academicTerms.service';
import { SAEvaluationDashboard } from '../../components/admin/evaluation/SAEvaluationDashboard';
import { SAExperimentLab } from '../../components/admin/evaluation/SAExperimentLab';
import { SARunHistoryTable } from '../../components/admin/evaluation/SARunHistoryTable';
import { cn } from '../../lib/utils';
import { toast } from '../../components/ui/Toast';

export const SAEvaluationPage: React.FC = () => {
  const { role } = useAuth();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'LAB' | 'HISTORY'>('DASHBOARD');

  // Loading & Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [runs, setRuns] = useState<OptimizationRun[]>([]);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [term, versionList, runsList] = await Promise.all([
        academicTermsService.getActiveTerm(),
        scheduleVersionsService.getVersions(),
        saEvaluationService.getRuns(),
      ]);

      setActiveTerm(term);
      setVersions(versionList);
      setRuns(runsList);

      if (versionList.length > 0 && !selectedVersionId) {
        // Default to first draft version or first version in list
        const draft = versionList.find((v) => v.status === 'DRAFT') || versionList[0];
        setSelectedVersionId(draft.id);
      }
    } catch (err) {
      console.error('Error loading SA evaluation data:', err);
      toast.error('Gagal memuat data evaluasi Simulated Annealing.');
    } finally {
      setLoading(false);
    }
  }, [selectedVersionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) || (versions.length > 0 ? versions[0] : null);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header & Tab Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-3xs font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                Monitoring & Evaluasi
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-3xs font-bold bg-slate-100 text-slate-700 uppercase">
                Admin Area
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1 tracking-tight">
              Evaluasi & Eksperimen Simulated Annealing
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis kuantitatif optimasi penjadwalan perkuliahan Jurusan Teknik Elektro Universitas Mataram
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              Segarkan Data
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto">
          {[
            { id: 'DASHBOARD', label: 'Ringkasan Optimasi', icon: <Activity className="w-4 h-4" /> },
            { id: 'LAB', label: 'Lab Eksperimen (SA Runner)', icon: <Zap className="w-4 h-4" /> },
            { id: 'HISTORY', label: `Riwayat Analisis (${runs.length})`, icon: <Clock className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer',
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Tab Content Rendering */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px] bg-white rounded-2xl border border-slate-200 p-8">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-3 border-blue-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Memuat Data Evaluasi Simulated Annealing...</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'DASHBOARD' && (
            <SAEvaluationDashboard
              runs={runs}
              selectedVersion={selectedVersion}
              onNavigateToLab={() => setActiveTab('LAB')}
              onNavigateToHistory={() => setActiveTab('HISTORY')}
            />
          )}

          {activeTab === 'LAB' && (
            <SAExperimentLab
              versions={versions}
              selectedVersionId={selectedVersionId}
              onSelectVersionId={setSelectedVersionId}
              onExperimentComplete={loadData}
            />
          )}

          {activeTab === 'HISTORY' && (
            <SARunHistoryTable
              runs={runs}
              onRefresh={loadData}
            />
          )}
        </>
      )}
    </div>
  );
};

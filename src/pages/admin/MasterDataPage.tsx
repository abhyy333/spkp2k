import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Users,
  DoorClosed,
  Clock,
  Database,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { CoursesPage } from './CoursesPage';
import { LecturersPage } from './LecturersPage';
import { RoomsPage } from './RoomsPage';
import { TimeSlotsPage } from './TimeSlotsPage';
import { cn } from '../../lib/utils';

type TabKey = 'mata-kuliah' | 'dosen' | 'ruangan' | 'slot-waktu';

const TABS: { id: TabKey; label: string; icon: React.ReactNode }[] = [
  { id: 'mata-kuliah', label: 'Mata Kuliah', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'dosen', label: 'Dosen', icon: <Users className="w-4 h-4" /> },
  { id: 'ruangan', label: 'Ruangan', icon: <DoorClosed className="w-4 h-4" /> },
  { id: 'slot-waktu', label: 'Slot Waktu', icon: <Clock className="w-4 h-4" /> },
];

export const MasterDataPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabKey) || 'mata-kuliah';

  const activeTab: TabKey = TABS.some((t) => t.id === currentTab) ? currentTab : 'mata-kuliah';

  const handleTabChange = (tabId: TabKey) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Data"
        subtitle="Kelola data referensi mata kuliah, dosen, ruangan, dan slot waktu akademik"
      />

      {/* Clean Tab Navigation Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1.5 shadow-2xs gap-1">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-2">
        {activeTab === 'mata-kuliah' && <CoursesPage />}
        {activeTab === 'dosen' && <LecturersPage />}
        {activeTab === 'ruangan' && <RoomsPage />}
        {activeTab === 'slot-waktu' && <TimeSlotsPage />}
      </div>
    </div>
  );
};

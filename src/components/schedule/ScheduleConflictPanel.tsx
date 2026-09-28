import React from 'react';
import { ClientConflict } from '../../lib/scheduleValidator';
import { Drawer } from '../ui/Drawer';
import {
  AlertTriangle,
  DoorClosed,
  Users,
  HardDrive,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

interface ScheduleConflictPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ClientConflict[];
  onSelectConflict: (conflict: ClientConflict) => void;
  onGetSuggestion?: (conflict: ClientConflict) => void;
}

export const ScheduleConflictPanel: React.FC<ScheduleConflictPanelProps> = ({
  isOpen,
  onClose,
  conflicts,
  onSelectConflict,
  onGetSuggestion,
}) => {
  const roomConflicts = conflicts.filter((c) => c.type === 'ROOM');
  const lecturerConflicts = conflicts.filter(
    (c) => c.type === 'LECTURER' || c.type === 'UNAVAILABLE'
  );
  const capacityConflicts = conflicts.filter(
    (c) => c.type === 'CAPACITY' || c.type === 'ROOM_TYPE'
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Pemeriksaan Konflik Jadwal"
      subtitle="Evaluasi bentrok ruangan, dosen, dan kapasitas sebelum menyimpan draft"
      width="w-full sm:max-w-md lg:max-w-lg"
      footer={
        <div className="flex justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Tutup Panel
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Summary Counter Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
            <DoorClosed className="w-4 h-4 text-purple-600 mx-auto mb-1" />
            <span className="text-lg font-bold text-purple-900 block leading-none">
              {roomConflicts.length}
            </span>
            <span className="text-3xs font-medium text-purple-700">Bentrok Ruangan</span>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
            <Users className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <span className="text-lg font-bold text-blue-900 block leading-none">
              {lecturerConflicts.length}
            </span>
            <span className="text-3xs font-medium text-blue-700">Bentrok Dosen</span>
          </div>

          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-center">
            <HardDrive className="w-4 h-4 text-rose-600 mx-auto mb-1" />
            <span className="text-lg font-bold text-rose-900 block leading-none">
              {capacityConflicts.length}
            </span>
            <span className="text-3xs font-medium text-rose-700">Kapasitas / Tipe</span>
          </div>
        </div>

        {/* Conflict List */}
        {conflicts.length === 0 ? (
          <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-emerald-900">
              Tidak ada konflik jadwal yang terdeteksi
            </h4>
            <p className="text-xs text-emerald-700 mt-1 max-w-xs mx-auto">
              Semua alokasi waktu, dosen, dan ruangan pada draft jadwal ini saling kompatibel dan bebas bentrok.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
              Daftar Bentrok ({conflicts.length} Item)
            </p>

            {conflicts.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/60 hover:bg-rose-50 transition-all group space-y-2 shadow-2xs"
              >
                <div
                  onClick={() => {
                    onSelectConflict(c);
                    onClose();
                  }}
                  className="flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-3xs font-bold uppercase bg-rose-600 text-white">
                        {c.type}
                      </span>
                      <span className="text-xs font-bold text-rose-900 group-hover:text-rose-700">
                        {c.title}
                      </span>
                    </div>
                    <p className="text-2xs text-rose-800 leading-relaxed">
                      {c.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400 group-hover:text-rose-600 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                </div>

                {onGetSuggestion && (
                  <div className="flex items-center justify-end pt-1.5 border-t border-rose-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGetSuggestion(c);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-2xs font-bold text-rose-900 bg-white hover:bg-rose-100/80 border border-rose-300 rounded-lg transition-all shadow-2xs cursor-pointer"
                    >
                      <span>💡 Cari Saran Solusi Cerdas</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
};

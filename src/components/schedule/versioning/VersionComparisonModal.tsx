import React, { useState, useEffect } from 'react';
import { ScheduleVersion } from '../../../types';
import { scheduleVersionsService } from '../../../services/scheduleVersions.service';
import {
  Scale,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
} from 'lucide-react';
import { minuteToTime, dayOfWeekToName } from '../../../lib/utils';
import { toast } from '../../ui/Toast';

interface VersionComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ScheduleVersion[];
  initialVersionAId?: string;
  initialVersionBId?: string;
}

export const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({
  isOpen,
  onClose,
  versions,
  initialVersionAId,
  initialVersionBId,
}) => {
  const [versionAId, setVersionAId] = useState<string>(
    initialVersionAId || versions[0]?.id || ''
  );
  const [versionBId, setVersionBId] = useState<string>(
    initialVersionBId || versions[1]?.id || versions[0]?.id || ''
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [diffData, setDiffData] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'MODIFIED' | 'ADDED' | 'REMOVED'>('ALL');
  const [search, setSearch] = useState('');

  const loadComparison = async () => {
    if (!versionAId || !versionBId) return;
    setLoading(true);
    try {
      const data = await scheduleVersionsService.compareVersions(versionAId, versionBId);
      setDiffData(data);
    } catch (err: any) {
      console.error('Error loading version comparison:', err);
      toast.error('Gagal memuat komparasi versi jadwal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && versionAId && versionBId) {
      loadComparison();
    }
  }, [isOpen, versionAId, versionBId]);

  if (!isOpen) return null;

  const verA = versions.find((v) => v.id === versionAId);
  const verB = versions.find((v) => v.id === versionBId);

  // Combine items for filtered list
  const combinedItems: Array<{
    type: 'MODIFIED' | 'ADDED' | 'REMOVED' | 'IDENTICAL';
    courseName: string;
    courseCode?: string;
    classCode: string;
    entryA?: any;
    entryB?: any;
    timeChanged?: boolean;
    roomChanged?: boolean;
  }> = [];

  if (diffData) {
    diffData.modified.forEach((m: any) =>
      combinedItems.push({
        type: 'MODIFIED',
        courseName: m.courseName,
        courseCode: m.courseCode,
        classCode: m.classCode,
        entryA: m.entryA,
        entryB: m.entryB,
        timeChanged: m.timeChanged,
        roomChanged: m.roomChanged,
      })
    );

    diffData.addedInB.forEach((a: any) =>
      combinedItems.push({
        type: 'ADDED',
        courseName: a.course_offering?.course?.name || a.course_name || 'Mata Kuliah',
        courseCode: a.course_offering?.course?.code || a.course_code,
        classCode: a.course_offering?.class_code || a.class_code || 'A',
        entryB: a,
      })
    );

    diffData.removedFromA.forEach((r: any) =>
      combinedItems.push({
        type: 'REMOVED',
        courseName: r.course_offering?.course?.name || r.course_name || 'Mata Kuliah',
        courseCode: r.course_offering?.course?.code || r.course_code,
        classCode: r.course_offering?.class_code || r.class_code || 'A',
        entryA: r,
      })
    );
  }

  const filteredItems = combinedItems.filter((item) => {
    if (filterType !== 'ALL' && item.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.courseName.toLowerCase().includes(q) ||
        (item.courseCode && item.courseCode.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Komparasi Antar Versi Jadwal (Version Diff)
              </h3>
              <p className="text-2xs text-slate-500">
                Bandingkan perbedaan alokasi waktu, ruangan, dan kelas antara dua versi jadwal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Version Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/90">
            {/* Version A (Base) */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500">
                Versi A (Dasar Pembanding):
              </label>
              <select
                value={versionAId}
                onChange={(e) => setVersionAId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title || `Jadwal Perkuliahan v${v.version_number || '1'}`} ({v.status === 'PUBLISHED' ? `TERBIT · v${v.version_number || '1'}` : (v.status || 'DRAFT')})
                  </option>
                ))}
              </select>
            </div>

            {/* Version B (Target) */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500">
                Versi B (Versi Tujuan):
              </label>
              <select
                value={versionBId}
                onChange={(e) => setVersionBId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-blue-500"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title || `Jadwal Perkuliahan v${v.version_number || '1'}`} ({v.status === 'PUBLISHED' ? `TERBIT · v${v.version_number || '1'}` : (v.status || 'DRAFT')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Diff Metrics */}
          {diffData && (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-3xs font-semibold text-blue-700 uppercase block">
                  Perubahan Posisi
                </span>
                <strong className="text-base text-blue-950 font-bold">
                  {diffData.summary.modifiedCount} Kelas
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-3xs font-semibold text-emerald-700 uppercase block">
                  Ditambahkan di B
                </span>
                <strong className="text-base text-emerald-950 font-bold">
                  +{diffData.summary.addedCount} Kelas
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-3xs font-semibold text-rose-700 uppercase block">
                  Dihapus dari A
                </span>
                <strong className="text-base text-rose-950 font-bold">
                  -{diffData.summary.removedCount} Kelas
                </strong>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-3xs font-semibold text-slate-600 uppercase block">
                  Posisi Identik
                </span>
                <strong className="text-base text-slate-800 font-bold">
                  {diffData.summary.identicalCount} Kelas
                </strong>
              </div>
            </div>
          )}

          {/* Filter Bar & Search */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari mata kuliah..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 w-56"
                />
              </div>

              <div className="flex p-0.5 bg-slate-100 rounded-lg text-2xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filterType === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Semua Perubahan ({combinedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('MODIFIED')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filterType === 'MODIFIED' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Bergeser ({diffData?.summary.modifiedCount || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('ADDED')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filterType === 'ADDED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Baru (+{diffData?.summary.addedCount || 0})
                </button>
              </div>
            </div>
          </div>

          {/* Diff Items List */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-500" />
              <p className="text-xs font-semibold">Memuat dan menganalisis perbedaan versi...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-800">
                Kedua versi memiliki susunan jadwal yang identik
              </h4>
              <p className="text-2xs text-slate-500 mt-1">
                Tidak ada perbedaan waktu, ruangan, atau alokasi kelas antara Versi A dan Versi B.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item, idx) => {
                const dayA = item.entryA?.day || (item.entryA?.day_of_week ? dayOfWeekToName(item.entryA.day_of_week) : '-');
                const timeA = item.entryA ? `${item.entryA.start_time || minuteToTime(item.entryA.start_minute)}` : '-';
                const roomA = item.entryA?.room?.code || item.entryA?.room_id || '-';

                const dayB = item.entryB?.day || (item.entryB?.day_of_week ? dayOfWeekToName(item.entryB.day_of_week) : '-');
                const timeB = item.entryB ? `${item.entryB.start_time || minuteToTime(item.entryB.start_minute)}` : '-';
                const roomB = item.entryB?.room?.code || item.entryB?.room_id || '-';

                return (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{item.courseName}</span>
                        <span className="px-1.5 py-0.2 rounded font-bold text-3xs bg-blue-50 text-blue-700 border border-blue-200">
                          Kelas {item.classCode}
                        </span>

                        {item.type === 'MODIFIED' && (
                          <div className="flex items-center gap-1">
                            {item.timeChanged && (
                              <span className="px-2 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                WAKTU BERUBAH
                              </span>
                            )}
                            {item.roomChanged && (
                              <span className="px-2 py-0.5 rounded text-3xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                RUANG BERUBAH
                              </span>
                            )}
                          </div>
                        )}

                        {item.type === 'ADDED' && (
                          <span className="px-2 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            DITAMBAHKAN DI B
                          </span>
                        )}

                        {item.type === 'REMOVED' && (
                          <span className="px-2 py-0.5 rounded text-3xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            DIHAPUS DARI A
                          </span>
                        )}
                      </div>
                      {item.courseCode && (
                        <span className="font-mono text-2xs text-slate-400 block">
                          {item.courseCode}
                        </span>
                      )}
                    </div>

                    {/* Comparison Details Side by Side */}
                    <div className="flex items-center gap-3 shrink-0 text-2xs">
                      {/* Left: Ver A */}
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 min-w-[130px]">
                        <span className="text-3xs font-bold text-slate-400 uppercase block mb-0.5">
                          Versi A
                        </span>
                        {item.entryA ? (
                          <>
                            <div className="font-semibold text-slate-800">
                              {dayA} {timeA}
                            </div>
                            <div className="text-slate-500 font-mono text-3xs">
                              Ruang: {roomA}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Tidak ada</span>
                        )}
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                      {/* Right: Ver B */}
                      <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 min-w-[130px]">
                        <span className="text-3xs font-bold text-indigo-600 uppercase block mb-0.5">
                          Versi B
                        </span>
                        {item.entryB ? (
                          <>
                            <div className="font-semibold text-indigo-950">
                              {dayB} {timeB}
                            </div>
                            <div className="text-indigo-700 font-mono text-3xs">
                              Ruang: {roomB}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Dihapus</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Tutup Komparasi
          </button>
        </div>
      </div>
    </div>
  );
};

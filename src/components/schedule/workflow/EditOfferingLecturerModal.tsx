import React, { useState, useEffect } from 'react';
import { CourseOffering, Lecturer } from '../../../types';
import { Modal } from '../../ui/Modal';
import { UserCheck, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { toast } from '../../ui/Toast';

interface EditOfferingLecturerModalProps {
  isOpen: boolean;
  onClose: () => void;
  offering: CourseOffering | null;
  lecturersList: Lecturer[];
  onSaveLecturers: (
    offeringId: string,
    assignments: { lecturer_id: string; assignment_role: string }[]
  ) => Promise<void>;
}

export const EditOfferingLecturerModal: React.FC<EditOfferingLecturerModalProps> = ({
  isOpen,
  onClose,
  offering,
  lecturersList,
  onSaveLecturers,
}) => {
  const [assignments, setAssignments] = useState<
    { lecturer_id: string; assignment_role: string }[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (offering) {
      const existing = (offering.course_offering_lecturers || []).map((col) => ({
        lecturer_id: col.lecturer_id,
        assignment_role: col.assignment_role || 'PENGAMPU',
      }));
      setAssignments(
        existing.length > 0
          ? existing
          : offering.lecturers?.map((l) => ({
              lecturer_id: l.lecturer_id,
              assignment_role: l.assignment_role || 'PENGAMPU',
            })) || []
      );
    }
  }, [offering, isOpen]);

  if (!offering) return null;

  const handleAddLecturer = () => {
    // Pick first lecturer not yet assigned
    const assignedIds = new Set(assignments.map((a) => a.lecturer_id));
    const nextAvailable = lecturersList.find((l) => !assignedIds.has(l.id));
    if (nextAvailable) {
      setAssignments((prev) => [
        ...prev,
        {
          lecturer_id: nextAvailable.id,
          assignment_role: prev.length === 0 ? 'KOORDINATOR' : 'PENGAMPU',
        },
      ]);
    } else if (lecturersList.length > 0) {
      setAssignments((prev) => [
        ...prev,
        {
          lecturer_id: lecturersList[0].id,
          assignment_role: 'PENGAMPU',
        },
      ]);
    }
  };

  const handleRemoveLecturer = (index: number) => {
    setAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLecturer = (index: number, lecturerId: string) => {
    setAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, lecturer_id: lecturerId } : a))
    );
  };

  const handleUpdateRole = (index: number, role: string) => {
    setAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, assignment_role: role } : a))
    );
  };

  const handleSave = async () => {
    if (assignments.length === 0) {
      toast.error('Minimal tentukan 1 dosen pengampu.');
      return;
    }

    // Check duplicates
    const ids = assignments.map((a) => a.lecturer_id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      toast.error('Dosen tidak boleh diduplikasi dalam kelas yang sama.');
      return;
    }

    try {
      setSaving(true);
      await onSaveLecturers(offering.id, assignments);
      toast.success('Dosen pengampu berhasil diperbarui.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan penugasan dosen.');
    } finally {
      setSaving(false);
    }
  };

  const course = offering.course;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ubah Dosen Pengampu"
      description={`${course?.code || ''} – ${course?.name || ''} (Kelas ${offering.class_code})`}
      size="md"
    >
      <div className="space-y-4">
        {/* Offering Info */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
          <p className="font-bold text-slate-800">{course?.name}</p>
          <div className="flex items-center gap-2 text-2xs text-slate-500">
            <span>Kelas {offering.class_code}</span>
            <span>•</span>
            <span>Semester {course?.semester}</span>
            <span>•</span>
            <span>{course?.effective_sks || 2} SKS</span>
            <span>•</span>
            <span>{offering.expected_students || 0} Mahasiswa</span>
          </div>
        </div>

        {/* Lecturer Assignments List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              Daftar Dosen Pengampu (Team Teaching)
            </label>
            <button
              type="button"
              onClick={handleAddLecturer}
              className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Dosen
            </button>
          </div>

          {assignments.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              Belum ada dosen yang ditugaskan untuk kelas ini.
            </div>
          ) : (
            assignments.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs"
              >
                {/* Lecturer Selector */}
                <select
                  value={item.lecturer_id}
                  onChange={(e) => handleUpdateLecturer(idx, e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  {lecturersList.map((lec) => (
                    <option key={lec.id} value={lec.id}>
                      {lec.name} {lec.lecturer_code ? `(${lec.lecturer_code})` : ''}
                    </option>
                  ))}
                </select>

                {/* Role Selector */}
                <select
                  value={item.assignment_role}
                  onChange={(e) => handleUpdateRole(idx, e.target.value)}
                  className="w-32 px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                >
                  <option value="KOORDINATOR">Koordinator</option>
                  <option value="PENGAMPU">Pengampu</option>
                  <option value="ANGGOTA">Anggota</option>
                </select>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveLecturer(idx)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Hapus dosen dari kelas ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving || assignments.length === 0}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

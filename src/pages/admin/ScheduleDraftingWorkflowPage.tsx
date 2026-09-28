import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DraftingWorkflowStepper } from '../../components/schedule/drafting/DraftingWorkflowStepper';
import { Step1CourseSelection } from '../../components/schedule/drafting/Step1CourseSelection';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { schedulesService } from '../../services/schedules.service';
import { AcademicTerm } from '../../types';
import { Layers } from 'lucide-react';
import { toast } from '../../components/ui/Toast';

const STORAGE_SELECTED_COURSES_PREFIX = 'spk_draft_courses_';
const STORAGE_EXPECTED_STUDENTS_PREFIX = 'spk_draft_students_';

export const ScheduleDraftingWorkflowPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeTerm, setActiveTerm] = useState<AcademicTerm | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Exclusive curriculum year state (default: 2026)
  const [curriculumYear, setCurriculumYear] = useState<2026 | 2022>(2026);

  // Selected course codes for Step 1
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);

  // Expected students map per course code: { [courseCode]: number }
  const [expectedStudentsMap, setExpectedStudentsMap] = useState<Record<string, number>>({});

  // Load initial active term data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const term = await schedulesService.getActiveTerm();
      setActiveTerm(term);

      if (term?.id) {
        // Restore selected course codes
        try {
          const savedCourses = localStorage.getItem(
            `${STORAGE_SELECTED_COURSES_PREFIX}${term.id}_${curriculumYear}`
          );
          if (savedCourses) {
            setSelectedCourseCodes(JSON.parse(savedCourses));
          } else {
            // Default: do not auto-select everything, user can use "Pilih Semua dari Template"
            setSelectedCourseCodes([]);
          }

          const savedStudents = localStorage.getItem(
            `${STORAGE_EXPECTED_STUDENTS_PREFIX}${term.id}`
          );
          if (savedStudents) {
            setExpectedStudentsMap(JSON.parse(savedStudents));
          }
        } catch {
          setSelectedCourseCodes([]);
        }
      }
    } catch (err: any) {
      console.error('Error loading workflow data:', err);
      setError(err.message || 'Gagal memuat data penyusunan jadwal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When curriculum year switches, restore or clear selected codes for that curriculum
  const handleChangeCurriculumYear = (year: 2026 | 2022) => {
    setCurriculumYear(year);
    if (activeTerm?.id) {
      try {
        const saved = localStorage.getItem(
          `${STORAGE_SELECTED_COURSES_PREFIX}${activeTerm.id}_${year}`
        );
        if (saved) {
          setSelectedCourseCodes(JSON.parse(saved));
        } else {
          setSelectedCourseCodes([]);
        }
      } catch {
        setSelectedCourseCodes([]);
      }
    }
  };

  const handleUpdateSelectedCourses = (newSelectedCodes: string[]) => {
    setSelectedCourseCodes(newSelectedCodes);
    if (activeTerm?.id) {
      try {
        localStorage.setItem(
          `${STORAGE_SELECTED_COURSES_PREFIX}${activeTerm.id}_${curriculumYear}`,
          JSON.stringify(newSelectedCodes)
        );
      } catch {
        // ignore
      }
    }
  };

  const handleToggleCourse = (courseCode: string) => {
    const isSelected = selectedCourseCodes.includes(courseCode);
    const updated = isSelected
      ? selectedCourseCodes.filter((code) => code !== courseCode)
      : [...selectedCourseCodes, courseCode];
    handleUpdateSelectedCourses(updated);
  };

  const handleSelectMultipleCourses = (courseCodes: string[]) => {
    const set = new Set([...selectedCourseCodes, ...courseCodes]);
    handleUpdateSelectedCourses(Array.from(set));
  };

  const handleDeselectMultipleCourses = (courseCodes: string[]) => {
    const removeSet = new Set(courseCodes);
    const updated = selectedCourseCodes.filter((code) => !removeSet.has(code));
    handleUpdateSelectedCourses(updated);
  };

  const handleUpdateExpectedStudents = (courseCode: string, count: number) => {
    const updated = {
      ...expectedStudentsMap,
      [courseCode]: count,
    };
    setExpectedStudentsMap(updated);
    if (activeTerm?.id) {
      try {
        localStorage.setItem(
          `${STORAGE_EXPECTED_STUDENTS_PREFIX}${activeTerm.id}`,
          JSON.stringify(updated)
        );
      } catch {
        // ignore
      }
    }
  };

  const termDisplay = activeTerm
    ? `Semester ${activeTerm.semester_type || activeTerm.term || 'Ganjil'} ${activeTerm.academic_year || activeTerm.year || '2026/2027'} ${activeTerm.semester_type || activeTerm.term || 'Ganjil'}`
    : 'Semester Ganjil 2026/2027 Ganjil';

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Penyusunan & Optimasi Jadwal Terpadu"
        subtitle={`Teknik Elektro UNRAM • ${termDisplay}`}
        badge={
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Belum Terbit
          </span>
        }
      />

      {/* 2. Horizontal 6-Step Stepper */}
      <DraftingWorkflowStepper
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step > 1) {
            toast.info('Selesaikan tahap sebelumnya terlebih dahulu.');
            return;
          }
          setCurrentStep(step);
        }}
      />

      {/* 3. Loading / Error States */}
      {loading && (
        <LoadingState
          type="table-skeleton"
          rows={8}
          message="Memuat struktur kurikulum dan paket mata kuliah..."
        />
      )}

      {error && <ErrorState message={error} onRetry={loadData} />}

      {/* 4. Active Step Content */}
      {!loading && !error && (
        <>
          {currentStep === 1 && (
            <Step1CourseSelection
              activeTerm={activeTerm}
              selectedCourseCodes={selectedCourseCodes}
              expectedStudentsMap={expectedStudentsMap}
              onToggleCourse={handleToggleCourse}
              onSelectMultipleCourses={handleSelectMultipleCourses}
              onDeselectMultipleCourses={handleDeselectMultipleCourses}
              onUpdateExpectedStudents={handleUpdateExpectedStudents}
              curriculumYear={curriculumYear}
              onChangeCurriculumYear={handleChangeCurriculumYear}
            />
          )}

          {/* Steps 2–6 are locked placeholders */}
          {currentStep > 1 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">Tahap Terkunci</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tahap {currentStep} akan diaktifkan pada iterasi implementasi berikutnya setelah Tahap 1 disetujui.
              </p>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="mt-4 px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                Kembali ke Tahap 1
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

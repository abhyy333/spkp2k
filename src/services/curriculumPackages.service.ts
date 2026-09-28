import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CurriculumPackage, AcademicTerm } from '../types';
import { verifyOwnerAdmin } from '../lib/authGuard';
import { academicTermsService } from './academicTerms.service';
import {
  KURIKULUM_2026_ALL_PACKAGES,
  KURIKULUM_2022_ALL_PACKAGES,
  PackageGroup,
} from '../components/schedule/drafting/PackageDefinitionConstants';

/**
 * Converts internal PackageGroup into standard CurriculumPackage
 */
export function convertPackageGroupToCurriculumPackage(pg: PackageGroup): CurriculumPackage {
  const isElective =
    pg.semester === 0 ||
    pg.name.toLowerCase().includes('pilihan') ||
    pg.name.toLowerCase().includes('elective') ||
    pg.kbk_code === 'ELKOM_TEL' ||
    pg.kbk_code === 'ELKOM_EL';

  return {
    id: pg.id,
    legacy_id: pg.legacy_id,
    name: pg.name,
    payload: {
      curriculum_year: pg.curriculum_year,
      semester: isElective ? null : pg.semester,
      scope: isElective ? `Pilihan ${pg.kbk_name}` : `Semester ${pg.semester}`,
      kbk_code: pg.kbk_code,
      kbk_name: pg.kbk_name,
      legacy_track:
        pg.kbk_code === 'ELKOM_TEL'
          ? 'TELEKOMUNIKASI'
          : pg.kbk_code === 'ELKOM_EL'
          ? 'ELEKTRONIKA'
          : null,
      package_type: isElective ? 'ELECTIVE_CATALOG' : 'SEMESTER_REGULER',
      course_count: pg.course_count || pg.courses.length,
      total_sks: pg.total_sks || pg.courses.reduce((sum, c) => sum + (c.sks || 0), 0),
      courses: pg.courses.map((c, idx) => ({
        code: c.code,
        name: c.name,
        sks: c.sks,
        order: c.order || idx + 1,
      })),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Returns default official curriculum packages for Teknik Elektro UNRAM
 */
export function getDefaultCurriculumPackages(): CurriculumPackage[] {
  const allGroups: PackageGroup[] = [
    ...KURIKULUM_2026_ALL_PACKAGES,
    ...KURIKULUM_2022_ALL_PACKAGES,
  ];
  return allGroups.map(convertPackageGroupToCurriculumPackage);
}

export const curriculumPackagesService = {
  /**
   * Fetch all curriculum packages from public.curriculum_packages
   * Note: The table schema is (id, curriculum_id, legacy_id, name, payload).
   * All structural info (curriculum_year, semester, scope, kbk_code, kbk_name, courses)
   * resides strictly inside the JSON payload.
   * If the table is restricted (e.g. 42501 permission denied for anon) or unavailable,
   * it gracefully falls back to the official Teknik Elektro UNRAM curriculum catalog.
   */
  async getPackages(): Promise<CurriculumPackage[]> {
    if (!isSupabaseConfigured()) {
      return getDefaultCurriculumPackages();
    }

    try {
      const isOwner = await verifyOwnerAdmin();
      const tableName = isOwner ? 'curriculum_packages' : 'guest_curriculum_packages';

      let data: any[] | null = null;
      let queryError: any = null;

      try {
        const res = await supabase
          .from(tableName)
          .select('*')
          .order('name', { ascending: true });
        data = res.data;
        queryError = res.error;
      } catch (err: any) {
        queryError = err;
      }

      // If guest_curriculum_packages view doesn't exist or errored, try direct curriculum_packages
      if (queryError && !isOwner) {
        try {
          const fallbackRes = await supabase
            .from('curriculum_packages')
            .select('*')
            .order('name', { ascending: true });
          if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
            data = fallbackRes.data;
            queryError = null;
          } else if (fallbackRes.error) {
            queryError = fallbackRes.error;
          }
        } catch (fbErr: any) {
          queryError = fbErr;
        }
      }

      // If database query succeeded and returned rows, parse and return them
      if (!queryError && data && Array.isArray(data) && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          curriculum_id: row.curriculum_id,
          legacy_id: row.legacy_id,
          name: row.name,
          payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || { courses: [] }),
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
      }

      // If query failed (e.g. 42501 permission denied for anon or table does not exist) or returned empty:
      // Gracefully fall back to official curriculum packages definitions
      return getDefaultCurriculumPackages();
    } catch (err: any) {
      console.warn('Menggunakan paket kurikulum resmi default:', err?.message || err);
      return getDefaultCurriculumPackages();
    }
  },

  /**
   * Safe lookup for course category from master courses table by course code
   */
  async getMasterCourseCategoryMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    // Seed map from official package definitions
    const defaultPkgs = [...KURIKULUM_2026_ALL_PACKAGES, ...KURIKULUM_2022_ALL_PACKAGES];
    defaultPkgs.forEach((pkg) => {
      pkg.courses.forEach((c) => {
        if (c.code) {
          map.set(c.code.trim().toUpperCase(), c.category || 'Wajib');
        }
      });
    });

    if (!isSupabaseConfigured()) return map;

    try {
      const isOwner = await verifyOwnerAdmin();
      const tableName = isOwner ? 'courses' : 'guest_courses';

      let { data, error } = await supabase
        .from(tableName)
        .select('code, course_type, category');

      if (error && !isOwner) {
        const fallback = await supabase
          .from('courses')
          .select('code, course_type, category');
        data = fallback.data;
      }

      if (data) {
        data.forEach((c: any) => {
          if (c.code) {
            const cat = c.category || (c.course_type === 'WAJIB' ? 'Wajib' : c.course_type === 'PILIHAN' ? 'Pilihan' : '-');
            map.set(c.code.trim().toUpperCase(), cat);
          }
        });
      }
    } catch (e) {
      // Use seeded categories without throwing
    }

    return map;
  },

  /**
   * Get active academic term via RPC or academicTermsService
   */
  async getActiveAcademicTerm(): Promise<AcademicTerm | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_active_academic_term');
      if (!rpcErr && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row) {
          return {
            id: row.id,
            academic_year: row.academic_year || row.year || '2026/2027',
            semester_type: row.semester_type || row.term || 'GANJIL',
            is_active: true,
            year: row.academic_year || row.year,
            term: row.semester_type || row.term,
          };
        }
      }
    } catch {
      // fallback to academicTermsService
    }

    return academicTermsService.getActiveTerm();
  },
};

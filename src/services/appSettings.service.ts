import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  AcademicTimeProfilePayload,
  DEFAULT_ACADEMIC_TIME_PROFILE_PAYLOAD,
  AcademicTimeProfileType,
} from '../lib/academicTimeProfile';
import { assertOwnerAdmin } from '../lib/authGuard';
import { parseSupabaseError } from '../lib/utils';

const SETTINGS_KEY = 'academic_time_profile';
const LOCAL_STORAGE_KEY = 'spk:academic_time_profile';

export const appSettingsService = {
  /**
   * Fetch current academic time profile configuration from public.app_settings
   */
  async getAcademicTimeProfile(): Promise<AcademicTimeProfilePayload> {
    // 1. Try fetching from Supabase app_settings
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('key', SETTINGS_KEY)
          .maybeSingle();

        if (!error && data && data.value) {
          const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (val && (val.activeProfile === 'NORMAL' || val.activeProfile === 'RAMADAN')) {
            // Cache locally
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(val));
            } catch (_) {}
            return val as AcademicTimeProfilePayload;
          }
        }
      } catch (err) {
        console.warn('[appSettingsService] Fallback to local settings due to:', err);
      }
    }

    // 2. Fallback to localStorage
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.activeProfile === 'NORMAL' || parsed.activeProfile === 'RAMADAN')) {
          return parsed as AcademicTimeProfilePayload;
        }
      }
    } catch (_) {}

    // 3. Default fallback
    return DEFAULT_ACADEMIC_TIME_PROFILE_PAYLOAD;
  },

  /**
   * Save academic time profile configuration to public.app_settings
   */
  async setAcademicTimeProfile(
    profileType: AcademicTimeProfileType,
    customPayload?: Partial<AcademicTimeProfilePayload>
  ): Promise<AcademicTimeProfilePayload> {
    await assertOwnerAdmin('mengubah profil waktu akademik');

    const updatedPayload: AcademicTimeProfilePayload = {
      ...DEFAULT_ACADEMIC_TIME_PROFILE_PAYLOAD,
      ...customPayload,
      activeProfile: profileType,
    };

    // Cache locally immediately
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedPayload));
    } catch (_) {}

    // Persist to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('app_settings').upsert({
          key: SETTINGS_KEY,
          value: updatedPayload,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.warn('[appSettingsService] Supabase upsert error:', error);
          // If table doesn't exist or RLS blocks it, we still have localStorage cache
        }
      } catch (err: any) {
        console.warn('[appSettingsService] Supabase exception during save:', err);
      }
    }

    return updatedPayload;
  },
};

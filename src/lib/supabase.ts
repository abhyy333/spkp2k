import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Local storage keys for runtime configuration if env variables are not yet provided
const STORAGE_URL_KEY = 'spk_supabase_url';
const STORAGE_KEY_KEY = 'spk_supabase_key';

export function getSupabaseConfig(): { url: string; key: string } {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const envUrl = (metaEnv?.VITE_SUPABASE_URL as string) || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : '') || '';
  const envKey = (metaEnv?.VITE_SUPABASE_PUBLISHABLE_KEY as string) || (metaEnv?.VITE_SUPABASE_ANON_KEY as string) || (typeof process !== 'undefined' ? (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY) : '') || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) || '' : '';

  const url = (envUrl || localUrl).trim();
  const key = (envKey || localKey).trim();

  return { url, key };
}

export function saveRuntimeSupabaseConfig(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    // reload to reinitialize client
    window.location.reload();
  }
}

export function clearRuntimeSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_KEY_KEY);
    window.location.reload();
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseConfig();
  return Boolean(
    url &&
    key &&
    url.startsWith('http') &&
    !url.includes('placeholder-project') &&
    !key.includes('placeholder-anon-key') &&
    !key.includes('placeholder')
  );
}

const { url, key } = getSupabaseConfig();

// Fallback placeholder client if not configured so the app doesn't crash on import
// but operations will reject gracefully and show the required banner/modal
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder-project.supabase.co',
  key || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

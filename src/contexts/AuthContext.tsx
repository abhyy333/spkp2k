import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, UserRole } from '../types';
import { authorizedAccountsService } from '../services/authorizedAccounts.service';
import { toast } from '../components/ui/Toast';

export const OWNER_EMAIL = 'abhyy333@gmail.com';
export type AccessMode = 'GUEST' | 'OWNER_ADMIN' | 'ADMIN' | 'DOSEN';
export type SystemPreviewRole = UserRole | 'GUEST';
export type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

const STORAGE_PREVIEW_ROLE_KEY = 'spk_preview_role';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null; // effectiveRole for UI / permission consumption
  actualRole: UserRole | null; // Database authoritative role
  previewRole: SystemPreviewRole | null; // Preview view override
  effectiveRole: UserRole | null;
  effectiveAccessMode: 'ADMIN' | 'DOSEN' | 'GUEST';
  authStatus: AuthStatus;
  isOwnerAdmin: boolean;
  isSystemOwner: boolean;
  isAdmin: boolean;
  isDosen: boolean;
  isMahasiswa: boolean;
  isGuest: boolean;
  accessMode: AccessMode;
  availablePreviewRoles: SystemPreviewRole[];
  setPreviewRole: (role: SystemPreviewRole | null) => void;
  exitPreview: () => void;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; role?: UserRole; isOwner?: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string; isConfirmationRequired?: boolean; user?: User | null }>;
  resetPassword: (email: string) => Promise<{ error?: string; success?: boolean }>;
  updatePassword: (password: string) => Promise<{ error?: string; success?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [previewRole, setPreviewRoleState] = useState<SystemPreviewRole | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREVIEW_ROLE_KEY);
      if (saved === 'ADMIN' || saved === 'DOSEN' || saved === 'GUEST') {
        return saved as SystemPreviewRole;
      }
      return null;
    } catch {
      return null;
    }
  });

  // Strict 1-way Auth Initialization State Machine
  const [authStatus, setAuthStatus] = useState<AuthStatus>('INITIALIZING');
  const loading = authStatus === 'INITIALIZING';

  // Authoritative database role
  const actualRole: UserRole | null = profile?.role ?? null;

  // STRICT SECURITY RULE: System Owner check
  const isSystemOwner = !!user && user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const isOwnerAdmin = isSystemOwner && (profile?.role === 'ADMIN' || !profile?.role);
  const isAdmin = actualRole === 'ADMIN' || isOwnerAdmin;
  const isDosen = actualRole === 'DOSEN';
  const isMahasiswa = false;

  // Effective access mode (Decoupled from actual database role)
  // When previewRole === 'GUEST', effectiveAccessMode is 'GUEST', but user and actualRole remain intact!
  const effectiveAccessMode: 'ADMIN' | 'DOSEN' | 'GUEST' =
    isOwnerAdmin && previewRole === 'GUEST'
      ? 'GUEST'
      : isOwnerAdmin && previewRole === 'DOSEN'
      ? 'DOSEN'
      : isOwnerAdmin && previewRole === 'ADMIN'
      ? 'ADMIN'
      : isAdmin
      ? 'ADMIN'
      : isDosen
      ? 'DOSEN'
      : 'GUEST';

  const isGuest = !user || effectiveAccessMode === 'GUEST';

  const accessMode: AccessMode = isOwnerAdmin
    ? 'OWNER_ADMIN'
    : isAdmin
    ? 'ADMIN'
    : isDosen
    ? 'DOSEN'
    : 'GUEST';

  // Role preview options strictly for System Owner
  const availablePreviewRoles: SystemPreviewRole[] = React.useMemo(() => {
    if (!isOwnerAdmin) return [];
    return ['ADMIN', 'DOSEN', 'GUEST'];
  }, [isOwnerAdmin]);

  // Effective role used strictly for UI presentation
  const effectiveRole: UserRole | null =
    effectiveAccessMode === 'GUEST' ? null : (effectiveAccessMode as UserRole);
  const role: UserRole | null = effectiveRole;

  // Set or switch preview role
  const setPreviewRole = (newRole: SystemPreviewRole | null) => {
    if (!isOwnerAdmin) {
      setPreviewRoleState(null);
      try {
        localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
      } catch {
        // ignore
      }
      return;
    }

    if (!newRole || newRole === 'ADMIN') {
      setPreviewRoleState(null);
      try {
        localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
      } catch {
        // ignore
      }
      return;
    }

    if (availablePreviewRoles.includes(newRole)) {
      setPreviewRoleState(newRole);
      try {
        localStorage.setItem(STORAGE_PREVIEW_ROLE_KEY, newRole);
      } catch {
        // ignore
      }
    }
  };

  // Exit preview mode back to authoritative admin view
  const exitPreview = () => {
    setPreviewRoleState(null);
    try {
      localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
    } catch {
      // ignore
    }
  };

  // Profile cache helpers
  const getCachedProfile = (userId: string): Profile | null => {
    try {
      const raw = localStorage.getItem(`spk_profile_cache_${userId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  };

  const setCachedProfile = (userId: string, prof: Profile) => {
    try {
      localStorage.setItem(`spk_profile_cache_${userId}`, JSON.stringify(prof));
    } catch {
      // ignore
    }
  };

  // Fetch and strictly validate user profile and authorization
  const fetchProfile = async (currentUser: User): Promise<Profile | null> => {
    const isOwner = currentUser.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

    if (!isSupabaseConfigured()) {
      const displayName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        (isOwner ? 'System Owner' : 'Pengguna');
      const fallbackProfile: Profile = {
        id: currentUser.id,
        email: currentUser.email || '',
        name: displayName,
        full_name: displayName,
        role: isOwner ? 'ADMIN' : 'DOSEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile(fallbackProfile);
      return fallbackProfile;
    }

    try {
      const email = (currentUser.email || '').trim().toLowerCase();

      if (!isOwner) {
        // 1. Check authorized_accounts authorization
        const { data: authAcc, error: accErr } = await supabase
          .from('authorized_accounts')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (accErr || !authAcc || !authAcc.is_active || (authAcc.user_id && authAcc.user_id !== currentUser.id)) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setAuthStatus('UNAUTHENTICATED');
          toast.error('Akun ini tidak memiliki akses ke sistem. Silakan gunakan Public View atau hubungi Administrator Jurusan.');
          return null;
        }

        if (!authAcc.user_id) {
          await supabase
            .from('authorized_accounts')
            .update({ user_id: currentUser.id, claimed_at: new Date().toISOString() })
            .eq('email', email);
        }
      }

      // 2. Fetch profile from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error || !data || !data.is_active || !data.role || (data.role !== 'ADMIN' && data.role !== 'DOSEN')) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setAuthStatus('UNAUTHENTICATED');
        toast.error('Akun ini tidak memiliki akses ke sistem. Silakan gunakan Public View atau hubungi Administrator Jurusan.');
        return null;
      }

      const verifiedProfile = {
        ...data,
        role: isOwner ? 'ADMIN' : data.role,
      } as Profile;

      setProfile(verifiedProfile);
      return verifiedProfile;
    } catch (err: any) {
      console.warn('Exception during strict profile validation:', err?.message || err);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setAuthStatus('UNAUTHENTICATED');
      toast.error('Akun ini tidak memiliki akses ke sistem. Silakan gunakan Public View atau hubungi Administrator Jurusan.');
      return null;
    }
  };

  // Single Auth Listener and Initial Session Setup
  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured()) {
      setAuthStatus('UNAUTHENTICATED');
      return;
    }

    let authResolved = false;

    // 1. Single Auth State Change Subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session: Session | null) => {
      if (!mounted) return;
      authResolved = true;

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user);
        if (mounted) {
          setAuthStatus('AUTHENTICATED');
        }
      } else {
        setUser(null);
        setProfile(null);
        if (mounted) {
          setAuthStatus('UNAUTHENTICATED');
        }
      }
    });

    // 2. Safe initial fallback in case onAuthStateChange is delayed
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!mounted || authResolved) return;
        authResolved = true;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user);
          if (mounted) {
            setAuthStatus('AUTHENTICATED');
          }
        } else {
          if (mounted) {
            setAuthStatus('UNAUTHENTICATED');
          }
        }
      })
      .catch((err) => {
        console.warn('Auth getSession notice:', err?.message || err);
        if (mounted && !authResolved) {
          setAuthStatus('UNAUTHENTICATED');
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: string; role?: UserRole; isOwner?: boolean }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Koneksi database belum dikonfigurasi. Tambahkan Supabase URL dan Publishable Key.',
      };
    }

    try {
      setAuthStatus('INITIALIZING');
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setAuthStatus('UNAUTHENTICATED');
        return { error: error.message };
      }

      if (!data.user) {
        setAuthStatus('UNAUTHENTICATED');
        return { error: 'Gagal melakukan otentikasi. Silakan periksa kembali email dan password.' };
      }

      setUser(data.user);
      const prof = await fetchProfile(data.user);
      const isOwner = cleanEmail === OWNER_EMAIL && prof?.role === 'ADMIN';

      // Clear any previous GUEST preview when logging in cleanly
      setPreviewRoleState(null);
      try {
        localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
      } catch {
        // ignore
      }

      setAuthStatus('AUTHENTICATED');
      return { role: prof?.role, isOwner };
    } catch (err: any) {
      setAuthStatus('UNAUTHENTICATED');
      return { error: err.message || 'Terjadi kesalahan sistem saat proses login.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error?: string; isConfirmationRequired?: boolean; user?: User | null }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Koneksi database belum dikonfigurasi. Tambahkan Supabase URL dan Publishable Key.',
      };
    }

    try {
      setAuthStatus('INITIALIZING');
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();

      const { data: rpcAllowed, error: rpcErr } = await supabase.rpc('can_register_authorized_account', {
        p_email: cleanEmail,
      });

      if (rpcErr || !rpcAllowed) {
        setAuthStatus('UNAUTHENTICATED');
        return {
          error: 'Email belum diotorisasi.',
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
          },
        },
      });

      if (error) {
        setAuthStatus('UNAUTHENTICATED');
        let errMsg = error.message || '';
        if (errMsg.includes('REGISTRATION_NOT_AUTHORIZED') || errMsg.includes('not authorized')) {
          errMsg = 'Email ini belum diotorisasi oleh Administrator Jurusan.';
        } else if (errMsg.includes('LECTURER_LINK_REQUIRED')) {
          errMsg = 'Akun dosen belum terhubung dengan Master Data Dosen. Hubungi Administrator Jurusan.';
        } else if (errMsg.includes('AUTHORIZED_ACCOUNT_ALREADY_CLAIMED')) {
          errMsg = 'Akun ini sudah pernah didaftarkan. Silakan masuk atau gunakan pemulihan kata sandi.';
        } else if (errMsg.includes('LECTURER_ALREADY_LINKED_TO_ANOTHER_ACCOUNT')) {
          errMsg = 'Profil dosen sudah terhubung dengan akun lain.';
        } else {
          errMsg = 'Email belum diotorisasi.';
        }
        return { error: errMsg };
      }

      if (data.user) {
        if (data.session) {
          setUser(data.user);
          await fetchProfile(data.user);
          setAuthStatus('AUTHENTICATED');
          return { user: data.user, isConfirmationRequired: false };
        } else {
          setAuthStatus('UNAUTHENTICATED');
          return { user: data.user, isConfirmationRequired: true };
        }
      }

      setAuthStatus('UNAUTHENTICATED');
      return { error: 'Gagal membuat akun. Silakan coba lagi.' };
    } catch (err: any) {
      setAuthStatus('UNAUTHENTICATED');
      return { error: err.message || 'Terjadi kesalahan sistem saat proses pendaftaran.' };
    }
  };

  const resetPassword = async (email: string): Promise<{ error?: string; success?: boolean }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Koneksi database belum dikonfigurasi.',
      };
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const redirectUrl = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Gagal mengirim email reset kata sandi.' };
    }
  };

  const updatePassword = async (password: string): Promise<{ error?: string; success?: boolean }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Koneksi database belum dikonfigurasi.',
      };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Gagal memperbarui kata sandi.' };
    }
  };

  const signOut = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setPreviewRoleState(null);
      try {
        localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
      } catch {
        // ignore
      }
      setAuthStatus('UNAUTHENTICATED');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: effectiveRole,
        actualRole,
        previewRole,
        effectiveRole,
        effectiveAccessMode,
        authStatus,
        isOwnerAdmin,
        isSystemOwner,
        isAdmin,
        isDosen,
        isMahasiswa,
        isGuest,
        accessMode,
        availablePreviewRoles,
        setPreviewRole,
        exitPreview,
        loading,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

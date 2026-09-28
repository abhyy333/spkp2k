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
  mustChangePassword: boolean;
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
  signIn: (email: string, password: string) => Promise<{ error?: string; role?: UserRole; isOwner?: boolean; mustChangePassword?: boolean }>;
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
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
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

  // Effective access mode
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
      } catch {}
      return;
    }

    if (!newRole || newRole === 'ADMIN') {
      setPreviewRoleState(null);
      try {
        localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
      } catch {}
      return;
    }

    if (availablePreviewRoles.includes(newRole)) {
      setPreviewRoleState(newRole);
      try {
        localStorage.setItem(STORAGE_PREVIEW_ROLE_KEY, newRole);
      } catch {}
    }
  };

  const exitPreview = () => {
    setPreviewRoleState(null);
    try {
      localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
    } catch {}
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
      setMustChangePassword(false);
      return fallbackProfile;
    }

    try {
      const email = (currentUser.email || '').trim().toLowerCase();

      if (!isOwner) {
        // 1. Check authorized_accounts authorization & must_change_password flag
        const { data: authAcc, error: accErr } = await supabase
          .from('authorized_accounts')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (accErr || !authAcc || !authAcc.is_active || (authAcc.user_id && authAcc.user_id !== currentUser.id)) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          setMustChangePassword(false);
          setAuthStatus('UNAUTHENTICATED');
          toast.error('Akun Anda tidak aktif. Hubungi Administrator Jurusan.');
          return null;
        }

        if (!authAcc.user_id) {
          await supabase
            .from('authorized_accounts')
            .update({ user_id: currentUser.id, claimed_at: new Date().toISOString() })
            .eq('email', email);
        }

        setMustChangePassword(Boolean(authAcc.must_change_password));
      } else {
        setMustChangePassword(false);
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
        setMustChangePassword(false);
        setAuthStatus('UNAUTHENTICATED');
        toast.error('Akun ini tidak memiliki akses ke sistem. Hubungi Administrator Jurusan.');
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
      setMustChangePassword(false);
      setAuthStatus('UNAUTHENTICATED');
      toast.error('Gagal memverifikasi hak akses akun.');
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session: Session | null) => {
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
        setMustChangePassword(false);
        if (mounted) {
          setAuthStatus('UNAUTHENTICATED');
        }
      }
    });

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
  ): Promise<{ error?: string; role?: UserRole; isOwner?: boolean; mustChangePassword?: boolean }> => {
    if (!isSupabaseConfigured()) {
      return {
        error: 'Koneksi database belum dikonfigurasi.',
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
        let errMsg = 'Email atau kata sandi tidak sesuai.';
        if (error.message.includes('Email not confirmed')) {
          errMsg = 'Email belum dikonfirmasi.';
        }
        return { error: errMsg };
      }

      if (!data.user) {
        setAuthStatus('UNAUTHENTICATED');
        return { error: 'Email atau kata sandi tidak sesuai.' };
      }

      setUser(data.user);
      const prof = await fetchProfile(data.user);
      if (!prof) {
        setAuthStatus('UNAUTHENTICATED');
        return { error: 'Akun Anda tidak aktif. Hubungi Administrator Jurusan.' };
      }

      const isOwner = cleanEmail === OWNER_EMAIL && prof?.role === 'ADMIN';

      setPreviewRoleState(null);
      try {
        localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
      } catch {}

      setAuthStatus('AUTHENTICATED');
      return { role: prof?.role, isOwner, mustChangePassword };
    } catch (err: any) {
      setAuthStatus('UNAUTHENTICATED');
      return { error: 'Email atau kata sandi tidak sesuai.' };
    }
  };

  // Self signUp is disabled in Admin-Managed Auth Model
  const signUp = async (): Promise<{ error?: string; isConfirmationRequired?: boolean; user?: User | null }> => {
    return {
      error: 'Registrasi mandiri tidak tersedia. Seluruh akun dikelola langsung oleh Administrator Jurusan.',
    };
  };

  // Password recovery via email is disabled in Admin-Managed Auth Model
  const resetPassword = async (): Promise<{ error?: string; success?: boolean }> => {
    return {
      error: 'Fitur reset sandi via email tidak tersedia. Silakan hubungi Administrator Jurusan.',
    };
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

      // Complete password change state in authorized_accounts
      await authorizedAccountsService.completePasswordChange();
      setMustChangePassword(false);

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
      setMustChangePassword(false);
      setPreviewRoleState(null);
      try {
        localStorage.removeItem(STORAGE_PREVIEW_ROLE_KEY);
      } catch {}
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
        mustChangePassword,
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

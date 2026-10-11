import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, UserRole } from '../types';
import { authorizedAccountsService } from '../services/authorizedAccounts.service';
import { toast } from '../components/ui/Toast';

export const OWNER_EMAIL = 'abhyy333@gmail.com';
export type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  effectiveAccessMode: 'ADMIN' | 'DOSEN' | 'GUEST';
  previewRole: UserRole | null;
  mustChangePassword: boolean;
  isOwnerAdmin: boolean;
  isSystemOwner: boolean;
  isAdmin: boolean;
  isDosen: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; role?: UserRole; isOwner?: boolean; mustChangePassword?: boolean }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error?: string; success?: boolean }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('INITIALIZING');

  const loading = authStatus === 'INITIALIZING';

  const isSystemOwner = !!user && user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const isOwnerAdmin = isSystemOwner;
  const role: UserRole | null = isOwnerAdmin ? 'ADMIN' : (profile?.role ?? null);
  const isAdmin = role === 'ADMIN';
  const isDosen = role === 'DOSEN';

  // Resolve access strictly. Never fall back to another role.
  const fetchProfile = async (currentUser: User): Promise<Profile | null> => {
    const isOwner = currentUser.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const cleanEmail = (currentUser.email || '').trim().toLowerCase();
      if (!cleanEmail) return null;

      const [{ data: profData, error: profError }, { data: authAcc, error: authError }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle(),
          supabase
            .from('authorized_accounts')
            .select('email, role, lecturer_id, user_id, is_active, is_system_owner, must_change_password')
            .eq('email', cleanEmail)
            .maybeSingle(),
        ]);

      // System owner must still resolve as ADMIN. Every other account must have
      // one active authorization row linked to the same authenticated user.
      if (!isOwner) {
        if (authError || !authAcc || !authAcc.is_active) {
          return null;
        }
        if (authAcc.user_id && authAcc.user_id !== currentUser.id) {
          return null;
        }
        if (authAcc.role !== 'ADMIN' && authAcc.role !== 'DOSEN') {
          return null;
        }
      }

      const resolvedRole: UserRole = isOwner ? 'ADMIN' : (authAcc!.role as UserRole);

      let currentProfile: Profile | null = null;
      if (!profError && profData) {
        currentProfile = profData as Profile;
      }

      // Do not silently reinterpret an ADMIN as DOSEN or vice versa.
      if (currentProfile && currentProfile.role !== resolvedRole) {
        console.error(
          '[AUTH] Role mismatch between profiles and authorized_accounts.',
          currentProfile.role,
          resolvedRole
        );
        return null;
      }

      if (!currentProfile) {
        const displayName =
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          (resolvedRole === 'ADMIN' ? 'Administrator' : 'Dosen');

        // Use only columns that actually exist in public.profiles.
        const { data: newProf, error: createErr } = await supabase
          .from('profiles')
          .insert({
            id: currentUser.id,
            full_name: displayName,
            role: resolvedRole,
            is_active: true,
          })
          .select()
          .single();

        if (createErr || !newProf) {
          console.error('[AUTH] Failed to create strict profile:', createErr);
          return null;
        }
        currentProfile = newProf as Profile;
      }

      if (currentProfile.is_active === false && !isOwner) {
        return null;
      }

      // Lecturer linkage is metadata for DOSEN only; it never decides the role.
      let lecturerId = authAcc?.lecturer_id || null;
      if (resolvedRole === 'DOSEN' && !lecturerId) {
        const { data: lectData } = await supabase
          .from('lecturers')
          .select('id')
          .or(`profile_id.eq.${currentUser.id},email.eq.${cleanEmail}`)
          .maybeSingle();
        lecturerId = lectData?.id || null;
      }

      setMustChangePassword(
        isOwner ? false : Boolean(authAcc?.must_change_password)
      );

      const verifiedProfile: Profile = {
        ...currentProfile,
        role: resolvedRole,
        lecturer_id: lecturerId,
      };

      setProfile(verifiedProfile);
      return verifiedProfile;
    } catch (err: any) {
      console.error('[AUTH] Strict profile resolution failed:', err?.message || err);
      return null;
    }
  };

  // Auth Listener
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
        const resolvedProfile = await fetchProfile(session.user);
        if (mounted) {
          if (resolvedProfile) {
            setAuthStatus('AUTHENTICATED');
          } else {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setMustChangePassword(false);
            setAuthStatus('UNAUTHENTICATED');
          }
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
          const resolvedProfile = await fetchProfile(session.user);
          if (mounted) {
            if (resolvedProfile) {
              setAuthStatus('AUTHENTICATED');
            } else {
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
              setMustChangePassword(false);
              setAuthStatus('UNAUTHENTICATED');
            }
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

      const authorization = await authorizedAccountsService.checkAuthorization(cleanEmail);
      if (!authorization.authorized) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setMustChangePassword(false);
        setAuthStatus('UNAUTHENTICATED');
        return {
          error:
            authorization.message ||
            'Akun tidak memiliki akses aktif. Hubungi Administrator Jurusan.',
        };
      }

      setUser(data.user);
      const prof = await fetchProfile(data.user);
      if (!prof) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setMustChangePassword(false);
        setAuthStatus('UNAUTHENTICATED');
        return {
          error:
            'Data akses akun tidak konsisten. Hubungi Administrator Jurusan untuk memperbaiki role akun.',
        };
      }

      if (authorization.role && prof.role !== authorization.role) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setMustChangePassword(false);
        setAuthStatus('UNAUTHENTICATED');
        return {
          error:
            'Role akun tidak sesuai dengan otorisasi. Login dibatalkan; sistem tidak akan memindahkan Anda ke role lain.',
        };
      }

      const isOwner = cleanEmail === OWNER_EMAIL && prof.role === 'ADMIN';
      const forcePasswordChange = Boolean(
        authorization.mustChangePassword || prof.must_change_password
      );
      setMustChangePassword(forcePasswordChange);
      setAuthStatus('AUTHENTICATED');
      return {
        role: prof.role,
        isOwner,
        mustChangePassword: forcePasswordChange,
      };
    } catch (err: any) {
      setAuthStatus('UNAUTHENTICATED');
      return { error: 'Email atau kata sandi tidak sesuai.' };
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
      setAuthStatus('UNAUTHENTICATED');
    }
  };

  const isAuthenticated = authStatus === 'AUTHENTICATED' && !!user;
  const effectiveAccessMode: 'ADMIN' | 'DOSEN' | 'GUEST' = isAdmin ? 'ADMIN' : (isDosen ? 'DOSEN' : 'GUEST');
  const previewRole: UserRole | null = role;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        authStatus,
        isAuthenticated,
        effectiveAccessMode,
        previewRole,
        mustChangePassword,
        isOwnerAdmin,
        isSystemOwner,
        isAdmin,
        isDosen,
        loading,
        signIn,
        signOut,
        updatePassword,
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

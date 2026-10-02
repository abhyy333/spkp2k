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

  // Fetch profile with profiles table as the authoritative source of truth
  const fetchProfile = async (currentUser: User): Promise<Profile | null> => {
    const isOwner = currentUser.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

    if (!isSupabaseConfigured()) {
      const displayName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        (isOwner ? 'System Administrator' : 'Dosen');
      const fallbackProfile: Profile = {
        id: currentUser.id,
        email: currentUser.email || '',
        name: displayName,
        full_name: displayName,
        role: isOwner ? 'ADMIN' : 'DOSEN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProfile(fallbackProfile);
      setMustChangePassword(false);
      return fallbackProfile;
    }

    try {
      const cleanEmail = (currentUser.email || '').trim().toLowerCase();

      // 1. Fetch from profiles table
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      let currentProfile: Profile | null = null;

      if (!profError && profData) {
        currentProfile = profData as Profile;
      }

      // 2. If profile not yet created in public.profiles, check authorized_accounts or system owner
      if (!currentProfile) {
        const { data: authAcc } = await supabase
          .from('authorized_accounts')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        const resolvedRole: UserRole = isOwner ? 'ADMIN' : ((authAcc?.role as UserRole) || 'DOSEN');
        const displayName =
          currentUser.user_metadata?.full_name ||
          currentUser.user_metadata?.name ||
          (isOwner ? 'System Administrator' : 'Pengguna JTE');

        // Create initial profile record
        const { data: newProf, error: createErr } = await supabase
          .from('profiles')
          .insert({
            id: currentUser.id,
            email: cleanEmail,
            name: displayName,
            full_name: displayName,
            role: resolvedRole,
            lecturer_id: authAcc?.lecturer_id || null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!createErr && newProf) {
          currentProfile = newProf as Profile;
        } else {
          // In-memory fallback
          currentProfile = {
            id: currentUser.id,
            email: cleanEmail,
            name: displayName,
            full_name: displayName,
            role: resolvedRole,
            lecturer_id: authAcc?.lecturer_id || null,
            is_active: true,
          };
        }
      }

      // 3. Verify active status
      if (currentProfile.is_active === false && !isOwner) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setMustChangePassword(false);
        setAuthStatus('UNAUTHENTICATED');
        toast.error('Akun Anda dinonaktifkan. Hubungi Administrator Jurusan.');
        return null;
      }

      // 4. Resolve lecturer_id if user is DOSEN and not yet linked
      let lecturerId = currentProfile.lecturer_id || null;
      if (currentProfile.role === 'DOSEN' && !lecturerId) {
        // Check lecturers table by profile_id or email
        const { data: lectData } = await supabase
          .from('lecturers')
          .select('id')
          .or(`profile_id.eq.${currentUser.id},email.eq.${cleanEmail}`)
          .maybeSingle();

        if (lectData?.id) {
          lecturerId = lectData.id;
          currentProfile.lecturer_id = lectData.id;
          // Sync to profiles
          supabase
            .from('profiles')
            .update({ lecturer_id: lectData.id })
            .eq('id', currentUser.id)
            .then();
        }
      }

      // 5. Check must_change_password flag from authorized_accounts or profile
      if (!isOwner) {
        const { data: authAcc } = await supabase
          .from('authorized_accounts')
          .select('must_change_password')
          .eq('email', cleanEmail)
          .maybeSingle();

        setMustChangePassword(Boolean(authAcc?.must_change_password || currentProfile.must_change_password));
      } else {
        setMustChangePassword(false);
      }

      const verifiedProfile: Profile = {
        ...currentProfile,
        lecturer_id: lecturerId,
        role: isOwner ? 'ADMIN' : currentProfile.role,
      };

      setProfile(verifiedProfile);
      return verifiedProfile;
    } catch (err: any) {
      console.warn('Profile resolution notice:', err?.message || err);
      if (isOwner) {
        const fallback: Profile = {
          id: currentUser.id,
          email: currentUser.email || '',
          name: 'System Administrator',
          full_name: 'System Administrator',
          role: 'ADMIN',
          is_active: true,
        };
        setProfile(fallback);
        return fallback;
      }
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
        return { error: 'Akun Anda dinonaktifkan atau belum terdaftar. Hubungi Administrator Jurusan.' };
      }

      const isOwner = cleanEmail === OWNER_EMAIL && prof?.role === 'ADMIN';
      setAuthStatus('AUTHENTICATED');
      return { role: prof?.role, isOwner, mustChangePassword };
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

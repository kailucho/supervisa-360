import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithPassword,
  signOut as signOutService,
} from '@/services/supabase/auth';
import { fetchProfile } from '@/services/supabase/profiles';
import { translateAuthError } from '@/services/supabase/errors';
import type { AppError } from '@/services/supabase/errors';
import type { ProfileRow } from '@/shared/types/domain';

interface State {
  status: AuthStatus;
  session: Session | null;
  profile: ProfileRow | null;
}

const SIGNED_OUT_STATE: State = { status: 'signed-out', session: null, profile: null };

const INACTIVE_ACCOUNT_ERROR: AppError = {
  code: 'PERMISSION_DENIED',
  message:
    'Esta cuenta no tiene acceso habilitado en Supervisa 360. Contacta a quien administra la aplicación.',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', session: null, profile: null });
  const mountedRef = useRef(true);

  const resolveSession = useCallback(async (session: Session | null) => {
    if (!session) {
      if (mountedRef.current) setState(SIGNED_OUT_STATE);
      return;
    }
    const profile = await fetchProfile(session.user.id).catch(() => null);
    if (!mountedRef.current) return;

    if (!profile || !profile.is_active) {
      await signOutService();
      if (mountedRef.current) setState(SIGNED_OUT_STATE);
      return;
    }

    setState({ status: 'signed-in', session, profile });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    getCurrentSession()
      .then(resolveSession)
      .catch(() => {
        if (mountedRef.current) setState(SIGNED_OUT_STATE);
      });

    const unsubscribe = onAuthStateChange((session) => {
      void resolveSession(session);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [resolveSession]);

  const signIn = useCallback(async (email: string, password: string): Promise<AppError | null> => {
    const { data, error } = await signInWithPassword(email, password);
    if (error || !data.session) {
      return translateAuthError();
    }

    const profile = await fetchProfile(data.session.user.id).catch(() => null);
    if (!profile || !profile.is_active) {
      await signOutService();
      return INACTIVE_ACCOUNT_ERROR;
    }

    setState({ status: 'signed-in', session: data.session, profile });
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await signOutService();
    setState(SIGNED_OUT_STATE);
  }, []);

  const value: AuthContextValue = { ...state, signIn, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

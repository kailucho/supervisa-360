import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppError } from '@/services/supabase/errors';
import type { ProfileRow } from '@/shared/types/domain';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: ProfileRow | null;
  signIn: (email: string, password: string) => Promise<AppError | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

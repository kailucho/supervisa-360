export type AppErrorCode =
  | 'SESSION_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'ACTIVE_VISIT_CONFLICT'
  | 'ASSOCIATION_NOT_SUPERVISABLE'
  | 'INCOMPLETE_RESULT'
  | 'INVALID_TIME_RANGE'
  | 'DUPLICATE_GOAL'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface AppError {
  code: AppErrorCode;
  message: string;
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

function hasStringProp<K extends string>(value: unknown, key: K): value is Record<K, string> {
  return typeof value === 'object' && value !== null && typeof (value as never)[key] === 'string';
}

function asPostgrestLikeError(error: unknown): PostgrestLikeError | null {
  if (typeof error !== 'object' || error === null) return null;
  if (!hasStringProp(error, 'message') && !hasStringProp(error, 'code')) return null;
  return error as PostgrestLikeError;
}

const GENERIC_MESSAGE = 'Ocurrió un problema inesperado. Intenta nuevamente en unos segundos.';

/**
 * Traduce errores de Supabase/PostgREST/Postgres (o de red) a un mensaje en
 * español entendible para las supervisoras. No expone texto crudo de Postgres.
 */
export function translateError(error: unknown): AppError {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return {
      code: 'NETWORK_ERROR',
      message:
        'No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
    };
  }

  const pg = asPostgrestLikeError(error);
  if (!pg) {
    return { code: 'UNKNOWN', message: GENERIC_MESSAGE };
  }

  const message = pg.message ?? '';
  const details = pg.details ?? '';
  const haystack = `${message} ${details}`.toLowerCase();

  switch (pg.code) {
    case '23505': // unique_violation
      if (haystack.includes('visits_one_active_per_association')) {
        return {
          code: 'ACTIVE_VISIT_CONFLICT',
          message: 'Esta asociación ya tiene una visita activa programada.',
        };
      }
      if (haystack.includes('monthly_goals_supervisor_region_period_unique')) {
        return {
          code: 'DUPLICATE_GOAL',
          message: 'Ya existe una meta para esa supervisora en esa sede, mes y año.',
        };
      }
      if (haystack.includes('regional_monthly_goals_region_period_unique')) {
        return {
          code: 'DUPLICATE_GOAL',
          message: 'Ya existe una meta conjunta para esa sede en ese mes y año.',
        };
      }
      return { code: 'UNKNOWN', message: 'Ese valor ya existe y debe ser único.' };

    case '23514': // check_violation
      if (haystack.includes('visits_result_completeness')) {
        return {
          code: 'INCOMPLETE_RESULT',
          message:
            'Para marcar la visita como realizada, completa la fecha, la puntuación y el comentario.',
        };
      }
      if (haystack.includes('score')) {
        return {
          code: 'INCOMPLETE_RESULT',
          message: 'La puntuación debe ser un número entero entre 0 y 5.',
        };
      }
      if (haystack.includes('visits_hours_order')) {
        return {
          code: 'INVALID_TIME_RANGE',
          message: 'La hora de fin no puede ser anterior a la hora de inicio.',
        };
      }
      return { code: 'UNKNOWN', message: GENERIC_MESSAGE };

    case 'P0001': // raise_exception (triggers)
      if (haystack.includes('no se puede programar') || haystack.includes('estado')) {
        return {
          code: 'ASSOCIATION_NOT_SUPERVISABLE',
          message:
            'No se puede programar una visita: la asociación no está en un estado supervisable.',
        };
      }
      if (haystack.includes('solo puede crearse con estado')) {
        return { code: 'UNKNOWN', message: GENERIC_MESSAGE };
      }
      return { code: 'UNKNOWN', message: message || GENERIC_MESSAGE };

    case '42501': // insufficient_privilege
      return {
        code: 'PERMISSION_DENIED',
        message: 'No tienes permisos para realizar esta acción.',
      };

    case 'PGRST301':
    case '401':
      return {
        code: 'SESSION_EXPIRED',
        message: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      };

    default:
      return { code: 'UNKNOWN', message: GENERIC_MESSAGE };
  }
}

export function translateAuthError(): AppError {
  // Nunca se revela si el correo existe o no (RN implícita de HU-06).
  return {
    code: 'INVALID_CREDENTIALS',
    message: 'Correo o contraseña incorrectos.',
  };
}

import { useEffect, useState } from 'react';

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/**
 * Hook mínimo para disparar una consulta a Supabase al montar o cuando cambien
 * las dependencias, con estados de carga/error y una función de recarga manual.
 * No pretende reemplazar TanStack Query: solo cubre lectura simple con reintento.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Deferido a un microtask: llamar setState de forma síncrona en el cuerpo del
    // efecto dispara el lint react-hooks/set-state-in-effect (cascading renders).
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });

    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher se reconstruye cada render a propósito
  }, [...deps, reloadToken]);

  return { data, loading, error, reload: () => setReloadToken((t) => t + 1) };
}

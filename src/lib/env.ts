import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  throw new Error(
    `Variables de entorno inválidas o faltantes: ${parsed.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ')}. Revisa .env.local contra .env.example.`,
  );
}

export const env = parsed.data;

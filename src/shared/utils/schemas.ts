import { z } from 'zod';
import { CHARACTERISTICS_BY_MODALITY } from '@/shared/types/domain';

/** Acepta number u string numérica (de un <input>), pero nunca redondea: 4.5 sigue sin ser entero. */
function coerceNumeric(val: unknown): unknown {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? val : Number(trimmed);
  }
  return val;
}

// RN-19: puntuación entera de 0 a 5.
export const scoreSchema = z.preprocess(
  coerceNumeric,
  z
    .number({ message: 'La puntuación es obligatoria.' })
    .int('La puntuación debe ser un número entero, sin decimales.')
    .min(0, 'La puntuación mínima es 0.')
    .max(5, 'La puntuación máxima es 5.'),
);

export const targetVisitsSchema = z.preprocess(
  coerceNumeric,
  z
    .number({ message: 'La meta es obligatoria.' })
    .int('La meta debe ser un número entero.')
    .min(0, 'La meta no puede ser negativa.'),
);

export type ScoreInput = z.input<typeof scoreSchema>;
export type TargetVisitsInput = z.input<typeof targetVisitsSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, 'El correo es obligatorio.').email('Ingresa un correo válido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const visitScheduleSchema = z
  .object({
    scheduledDate: z.string().min(1, 'La fecha es obligatoria.'),
    scheduledTime: z.string().optional().nullable(),
    visitType: z.enum(['ORDINARIA', 'SEGUIMIENTO', 'MORA', 'DESERCION', 'CIERRE']),
    modality: z.enum(['VIRTUAL', 'PRESENCIAL']),
    characteristic: z.enum(['ANUNCIADA', 'ANONIMA', 'SORPRESIVA']),
  })
  .superRefine((val, ctx) => {
    const allowed = CHARACTERISTICS_BY_MODALITY[val.modality];
    if (!allowed.includes(val.characteristic)) {
      const modalityLabel = val.modality === 'VIRTUAL' ? 'virtual' : 'presencial';
      ctx.addIssue({
        code: 'custom',
        path: ['characteristic'],
        message: `Para modalidad ${modalityLabel} la característica debe ser ${allowed.join(' o ')}.`,
      });
    }
  });
export type VisitScheduleFormValues = z.infer<typeof visitScheduleSchema>;

// RN-16, RN-19, RN-21: horas opcionales e independientes, orden coherente si ambas existen.
export const visitResultSchema = z
  .object({
    performedDate: z.string().min(1, 'La fecha realizada es obligatoria.'),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    score: scoreSchema,
    generalComment: z
      .string()
      .trim()
      .min(1, 'El comentario general es obligatorio y no puede estar vacío.'),
  })
  .superRefine((val, ctx) => {
    if (val.startTime && val.endTime && val.endTime < val.startTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'La hora de fin no puede ser anterior a la hora de inicio.',
      });
    }
  });
export type VisitResultFormValues = z.output<typeof visitResultSchema>;
export type VisitResultFormInput = z.input<typeof visitResultSchema>;

export const monthlyGoalSchema = z.object({
  targetVisits: targetVisitsSchema,
});
export type MonthlyGoalFormValues = z.output<typeof monthlyGoalSchema>;
export type MonthlyGoalFormInput = z.input<typeof monthlyGoalSchema>;

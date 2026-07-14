import { useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { visitResultSchema } from '@/shared/utils/schemas';
import type { VisitResultFormInput, VisitResultFormValues } from '@/shared/utils/schemas';
import { getLimaTodayISODate } from '@/shared/utils/date';
import { translateError } from '@/services/supabase/errors';
import type { VisitResultInput } from '@/services/supabase/visits';

export interface VisitResultDialogProps {
  open: boolean;
  mode: 'complete' | 'edit';
  initialValues?: Partial<VisitResultFormValues>;
  onClose: () => void;
  onSubmit: (result: VisitResultInput) => Promise<void>;
}

const SCORE_OPTIONS = [0, 1, 2, 3, 4, 5];

export function VisitResultDialog({
  open,
  mode,
  initialValues,
  onClose,
  onSubmit,
}: VisitResultDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VisitResultFormInput, unknown, VisitResultFormValues>({
    resolver: zodResolver(visitResultSchema),
    defaultValues: {
      performedDate: initialValues?.performedDate ?? getLimaTodayISODate(),
      startTime: initialValues?.startTime ?? '',
      endTime: initialValues?.endTime ?? '',
      score: initialValues?.score ?? '',
      generalComment: initialValues?.generalComment ?? '',
    },
  });

  const handleClose = () => {
    setSubmitError(null);
    reset();
    onClose();
  };

  const submitHandler = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        performedDate: values.performedDate,
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        score: values.score,
        generalComment: values.generalComment.trim(),
      });
      reset();
      onClose();
    } catch (error) {
      setSubmitError(translateError(error).message);
    } finally {
      setSubmitting(false);
    }
  });

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void submitHandler(event);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {mode === 'complete' ? 'Marcar visita como realizada' : 'Editar resultado de la visita'}
      </DialogTitle>
      <Box component="form" onSubmit={handleFormSubmit} noValidate>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            {...register('performedDate')}
            label="Fecha realizada"
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            error={Boolean(errors.performedDate)}
            helperText={errors.performedDate?.message}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              {...register('startTime')}
              label="Hora de inicio (opcional)"
              type="time"
              slotProps={{ inputLabel: { shrink: true } }}
              error={Boolean(errors.startTime)}
              helperText={errors.startTime?.message}
              fullWidth
            />
            <TextField
              {...register('endTime')}
              label="Hora de fin (opcional)"
              type="time"
              slotProps={{ inputLabel: { shrink: true } }}
              error={Boolean(errors.endTime)}
              helperText={errors.endTime?.message}
              fullWidth
            />
          </Box>
          <TextField
            {...register('score')}
            select
            label="Puntuación (0 a 5)"
            error={Boolean(errors.score)}
            helperText={errors.score?.message}
            fullWidth
          >
            {SCORE_OPTIONS.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            {...register('generalComment')}
            label="Comentario general"
            multiline
            minRows={3}
            error={Boolean(errors.generalComment)}
            helperText={errors.generalComment?.message}
            fullWidth
          />
          {submitError ? <Alert severity="error">{submitError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

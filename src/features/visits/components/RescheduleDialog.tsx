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
import { visitScheduleSchema } from '@/shared/utils/schemas';
import type { VisitScheduleFormValues } from '@/shared/utils/schemas';
import { VISIT_MODALITIES, VISIT_TYPES, CHARACTERISTICS_BY_MODALITY } from '@/shared/types/domain';
import {
  VISIT_MODALITY_LABELS,
  VISIT_TYPE_LABELS,
  VISIT_CHARACTERISTIC_LABELS,
} from '@/shared/utils/labels';
import { translateError } from '@/services/supabase/errors';
import type { RescheduleVisitInput } from '@/services/supabase/visits';

export interface RescheduleDialogProps {
  open: boolean;
  initialValues: VisitScheduleFormValues;
  onClose: () => void;
  onSubmit: (input: RescheduleVisitInput) => Promise<void>;
}

export function RescheduleDialog({
  open,
  initialValues,
  onClose,
  onSubmit,
}: RescheduleDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<VisitScheduleFormValues>({
    resolver: zodResolver(visitScheduleSchema),
    defaultValues: initialValues,
  });

  const modality = watch('modality');

  const handleClose = () => {
    setSubmitError(null);
    reset(initialValues);
    onClose();
  };

  const submitHandler = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        scheduledDate: values.scheduledDate,
        scheduledTime: values.scheduledTime || null,
        visitType: values.visitType,
        modality: values.modality,
        characteristic: values.characteristic,
      });
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
      <DialogTitle>Reprogramar visita</DialogTitle>
      <Box component="form" onSubmit={handleFormSubmit} noValidate>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              {...register('scheduledDate')}
              label="Fecha programada"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              error={Boolean(errors.scheduledDate)}
              helperText={errors.scheduledDate?.message}
              fullWidth
            />
            <TextField
              {...register('scheduledTime')}
              label="Hora (opcional)"
              type="time"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Box>
          <TextField {...register('visitType')} select label="Tipo de visita" fullWidth>
            {VISIT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {VISIT_TYPE_LABELS[type]}
              </MenuItem>
            ))}
          </TextField>
          <TextField {...register('modality')} select label="Modalidad" fullWidth>
            {VISIT_MODALITIES.map((m) => (
              <MenuItem key={m} value={m}>
                {VISIT_MODALITY_LABELS[m]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            {...register('characteristic')}
            select
            label="Característica"
            error={Boolean(errors.characteristic)}
            helperText={errors.characteristic?.message}
            fullWidth
          >
            {CHARACTERISTICS_BY_MODALITY[modality].map((c) => (
              <MenuItem key={c} value={c}>
                {VISIT_CHARACTERISTIC_LABELS[c]}
              </MenuItem>
            ))}
          </TextField>
          {submitError ? <Alert severity="error">{submitError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Reprogramar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

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
import Typography from '@mui/material/Typography';
import { visitScheduleSchema } from '@/shared/utils/schemas';
import type { VisitScheduleFormValues } from '@/shared/utils/schemas';
import { CHARACTERISTICS_BY_MODALITY, VISIT_MODALITIES, VISIT_TYPES } from '@/shared/types/domain';
import type { AssociationStatus } from '@/shared/types/domain';
import {
  VISIT_CHARACTERISTIC_LABELS,
  VISIT_MODALITY_LABELS,
  VISIT_TYPE_LABELS,
} from '@/shared/utils/labels';
import {
  fetchActiveVisitForAssociation,
  fetchRealizedVisitsInYear,
  scheduleVisit,
} from '@/services/supabase/visits';
import type { VisitWithRelations } from '@/services/supabase/visits';
import { evaluateScheduleGuard } from '@/features/visits/scheduleGuard';
import { translateError } from '@/services/supabase/errors';
import { formatDateEsPE, formatTime, getLimaTodayISODate } from '@/shared/utils/date';

export interface ScheduleVisitDialogProps {
  open: boolean;
  association: { id: string; name: string; status: AssociationStatus; advisorId: string };
  supervisorId: string;
  onClose: () => void;
  onScheduled: () => void;
}

type Phase = 'form' | 'warning' | 'blocked';

export function ScheduleVisitDialog({
  open,
  association,
  supervisorId,
  onClose,
  onScheduled,
}: ScheduleVisitDialogProps) {
  const [phase, setPhase] = useState<Phase>('form');
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [warningVisit, setWarningVisit] = useState<VisitScheduleFormValues | null>(null);
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
    defaultValues: {
      scheduledDate: getLimaTodayISODate(),
      scheduledTime: '',
      visitType: 'ORDINARIA',
      modality: 'PRESENCIAL',
      characteristic: 'ANUNCIADA',
    },
  });

  const modality = watch('modality');

  const resetAll = () => {
    setPhase('form');
    setBlockedMessage(null);
    setWarningVisit(null);
    setSubmitError(null);
    reset();
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  async function performInsert(values: VisitScheduleFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await scheduleVisit({
        associationId: association.id,
        supervisorId,
        currentAdvisorId: association.advisorId,
        visitType: values.visitType,
        modality: values.modality,
        characteristic: values.characteristic,
        scheduledDate: values.scheduledDate,
        scheduledTime: values.scheduledTime || null,
      });
      resetAll();
      onScheduled();
    } catch (error) {
      const translated = translateError(error);
      if (translated.code === 'ACTIVE_VISIT_CONFLICT') {
        setPhase('blocked');
        setBlockedMessage(
          'Esta asociación ya tiene una visita activa. Alguien la programó justo antes que tú; revisa la agenda para ver quién y cuándo.',
        );
      } else {
        setSubmitError(translated.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function describeActiveVisit(visit: VisitWithRelations): string {
    const who = visit.supervisor?.full_name ?? 'otra supervisora';
    const when = formatDateEsPE(visit.scheduled_date);
    const time = formatTime(visit.scheduled_time);
    return `${who} ya programó una visita para el ${when}${visit.scheduled_time ? ` a las ${time}` : ''} (estado: ${visit.status === 'PROGRAMADA' ? 'programada' : 'reprogramada'}).`;
  }

  const submitHandler = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const year = Number(values.scheduledDate.slice(0, 4));
      const [activeVisit, realizedThisYear] = await Promise.all([
        fetchActiveVisitForAssociation(association.id),
        fetchRealizedVisitsInYear(association.id, year),
      ]);

      const guard = evaluateScheduleGuard({
        associationStatus: association.status,
        activeVisit,
        realizedVisitsThisYear: realizedThisYear,
        visitType: values.visitType,
      });

      switch (guard.status) {
        case 'BLOCKED_NOT_SUPERVISABLE':
          setSubmitting(false);
          setPhase('blocked');
          setBlockedMessage('Esta asociación no está en un estado que permita programar visitas.');
          return;
        case 'BLOCKED_ACTIVE_VISIT_EXISTS':
          setSubmitting(false);
          setPhase('blocked');
          setBlockedMessage(describeActiveVisit(guard.activeVisit as VisitWithRelations));
          return;
        case 'BLOCKED_ORDINARIA_ALREADY_DONE_THIS_YEAR':
          setSubmitting(false);
          setPhase('blocked');
          setBlockedMessage(
            'Esta asociación ya tuvo una visita ORDINARIA realizada este año. No se puede programar otra.',
          );
          return;
        case 'WARN_ALREADY_VISITED_THIS_YEAR':
          setSubmitting(false);
          setPhase('warning');
          setWarningVisit(values);
          return;
        case 'OK':
          await performInsert(values);
      }
    } catch (error) {
      setSubmitting(false);
      setSubmitError(translateError(error).message);
    }
  });

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void submitHandler(event);
  };

  const handleConfirmWarning = () => {
    if (warningVisit) void performInsert(warningVisit);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Programar visita — {association.name}</DialogTitle>

      {phase === 'blocked' ? (
        <>
          <DialogContent>
            <Alert severity="error">{blockedMessage}</Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPhase('form')}>Volver</Button>
            <Button onClick={handleClose}>Cerrar</Button>
          </DialogActions>
        </>
      ) : phase === 'warning' ? (
        <>
          <DialogContent>
            <Alert severity="warning">
              Esta asociación ya tuvo al menos una visita realizada este año. ¿Deseas continuar y
              programar esta visita de todas formas?
            </Alert>
            {submitError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {submitError}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPhase('form')} disabled={submitting}>
              Volver
            </Button>
            <Button variant="contained" onClick={handleConfirmWarning} disabled={submitting}>
              {submitting ? 'Guardando…' : 'Confirmar y continuar'}
            </Button>
          </DialogActions>
        </>
      ) : (
        <Box component="form" onSubmit={handleFormSubmit} noValidate>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Asociación: <strong>{association.name}</strong>
            </Typography>
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
              {submitting ? 'Verificando…' : 'Programar'}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}

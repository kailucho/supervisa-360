import { useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { ASSOCIATION_STATUSES } from '@/shared/types/domain';
import type { AdvisorRow, AssociationStatus } from '@/shared/types/domain';
import { ASSOCIATION_STATUS_LABELS } from '@/shared/utils/labels';
import { translateError } from '@/services/supabase/errors';
import type { AssociationUpdateInput } from '@/services/supabase/associations';

interface FormValues {
  status: AssociationStatus;
  advisorId: string;
}

export interface EditAssociationDialogProps {
  open: boolean;
  currentStatus: AssociationStatus;
  currentAdvisorId: string;
  advisors: AdvisorRow[];
  onClose: () => void;
  onSubmit: (changes: AssociationUpdateInput) => Promise<void>;
}

export function EditAssociationDialog({
  open,
  currentStatus,
  currentAdvisorId,
  advisors,
  onClose,
  onSubmit,
}: EditAssociationDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { status: currentStatus, advisorId: currentAdvisorId },
  });

  const handleClose = () => {
    setSubmitError(null);
    reset({ status: currentStatus, advisorId: currentAdvisorId });
    onClose();
  };

  const submitHandler = handleSubmit(async (values) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({ status: values.status, advisor_id: values.advisorId });
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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Editar estado y asesor</DialogTitle>
      <Box component="form" onSubmit={handleFormSubmit} noValidate>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField {...register('status')} select label="Estado" fullWidth>
            {ASSOCIATION_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {ASSOCIATION_STATUS_LABELS[status]}
              </MenuItem>
            ))}
          </TextField>
          <TextField {...register('advisorId')} select label="Asesor actual" fullWidth>
            {advisors.map((advisor) => (
              <MenuItem key={advisor.id} value={advisor.id}>
                {advisor.full_name} ({advisor.code})
              </MenuItem>
            ))}
          </TextField>
          <Alert severity="info">
            El código de banca, el nombre y la región no son editables aquí: solo se actualizan por
            reimportación de CSV.
          </Alert>
          {submitError ? <Alert severity="error">{submitError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { RescheduleDialog } from './RescheduleDialog';
import { VisitResultDialog } from './VisitResultDialog';
import {
  cancelVisit,
  editVisitResult,
  markVisitDone,
  markVisitNotDone,
  rescheduleVisit,
} from '@/services/supabase/visits';
import type { VisitRow } from '@/shared/types/domain';
import { translateError } from '@/services/supabase/errors';

export interface VisitActionsMenuProps {
  visit: VisitRow;
  onChanged: () => void;
}

type DialogKind = null | 'reschedule' | 'cancel' | 'notDone' | 'markDone' | 'editResult';

export function VisitActionsMenu({ visit, onChanged }: VisitActionsMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);

  const isActive = visit.status === 'PROGRAMADA' || visit.status === 'REPROGRAMADA';
  const isDone = visit.status === 'REALIZADA';

  if (!isActive && !isDone) {
    return null;
  }

  const closeMenu = () => setAnchorEl(null);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      setSnackbar({ severity: 'success', message: successMessage });
      setDialog(null);
      onChanged();
    } catch (error) {
      setSnackbar({ severity: 'error', message: translateError(error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <IconButton
        size="small"
        aria-label="Acciones de la visita"
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <Typography component="span" aria-hidden sx={{ fontSize: '1.25rem', lineHeight: 1 }}>
          ⋮
        </Typography>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        {isActive && [
          <MenuItem
            key="reschedule"
            onClick={() => {
              closeMenu();
              setDialog('reschedule');
            }}
          >
            Reprogramar
          </MenuItem>,
          <MenuItem
            key="markDone"
            onClick={() => {
              closeMenu();
              setDialog('markDone');
            }}
          >
            Marcar realizada
          </MenuItem>,
          <MenuItem
            key="notDone"
            onClick={() => {
              closeMenu();
              setDialog('notDone');
            }}
          >
            Marcar no realizada
          </MenuItem>,
          <MenuItem
            key="cancel"
            onClick={() => {
              closeMenu();
              setDialog('cancel');
            }}
          >
            Cancelar visita
          </MenuItem>,
        ]}
        {isDone && (
          <MenuItem
            onClick={() => {
              closeMenu();
              setDialog('editResult');
            }}
          >
            Editar resultado
          </MenuItem>
        )}
      </Menu>

      {dialog === 'reschedule' ? (
        <RescheduleDialog
          open
          initialValues={{
            scheduledDate: visit.scheduled_date,
            scheduledTime: visit.scheduled_time ?? '',
            visitType: visit.visit_type,
            modality: visit.modality,
            characteristic: visit.characteristic,
          }}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            runAction(() => rescheduleVisit(visit.id, input), 'Visita reprogramada.')
          }
        />
      ) : null}

      {dialog === 'markDone' ? (
        <VisitResultDialog
          open
          mode="complete"
          onClose={() => setDialog(null)}
          onSubmit={(result) =>
            runAction(() => markVisitDone(visit.id, result), 'Visita marcada como realizada.')
          }
        />
      ) : null}

      {dialog === 'editResult' ? (
        <VisitResultDialog
          open
          mode="edit"
          initialValues={{
            performedDate: visit.performed_date ?? undefined,
            startTime: visit.start_time ?? '',
            endTime: visit.end_time ?? '',
            score: visit.score ?? undefined,
            generalComment: visit.general_comment ?? '',
          }}
          onClose={() => setDialog(null)}
          onSubmit={(result) =>
            runAction(() => editVisitResult(visit.id, result), 'Resultado actualizado.')
          }
        />
      ) : null}

      <ConfirmDialog
        open={dialog === 'notDone'}
        title="Marcar como no realizada"
        description="La visita quedará como no realizada, sin puntuación ni comentario. Esta acción no se puede deshacer."
        confirmLabel="Marcar no realizada"
        confirmColor="warning"
        loading={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          runAction(() => markVisitNotDone(visit.id), 'Visita marcada como no realizada.')
        }
      />

      <ConfirmDialog
        open={dialog === 'cancel'}
        title="Cancelar visita"
        description="La visita quedará cancelada y la asociación volverá a estar disponible para programar una nueva visita. Esta acción no se puede deshacer."
        confirmLabel="Cancelar visita"
        confirmColor="error"
        loading={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => runAction(() => cancelVisit(visit.id), 'Visita cancelada.')}
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? <Alert severity={snackbar.severity}>{snackbar.message}</Alert> : undefined}
      </Snackbar>
    </>
  );
}

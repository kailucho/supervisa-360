import { useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { fetchAssociations } from '@/services/supabase/associations';
import type { AssociationWithRelations } from '@/services/supabase/associations';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/features/auth/useAuth';
import { ScheduleVisitDialog } from '@/features/visits/components/ScheduleVisitDialog';

export function ScheduleNewVisitButton({ onScheduled }: { onScheduled: () => void }) {
  const { profile } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<AssociationWithRelations | null>(null);
  const { data: associations } = useAsyncData(() => fetchAssociations(), []);

  const options = useMemo(() => associations ?? [], [associations]);

  if (!profile) return null;

  return (
    <>
      <Button variant="contained" onClick={() => setPickerOpen(true)}>
        Programar visita
      </Button>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Elige la asociación a visitar</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={options}
            getOptionLabel={(option) => `${option.name} (${option.bank_code})`}
            onChange={(_event, value) => {
              if (value) {
                setSelected(value);
                setPickerOpen(false);
              }
            }}
            renderInput={(params) => (
              <TextField {...params} label="Buscar asociación" autoFocus margin="normal" />
            )}
          />
        </DialogContent>
      </Dialog>

      {selected ? (
        <ScheduleVisitDialog
          open
          association={{
            id: selected.id,
            name: selected.name,
            status: selected.status,
            advisorId: selected.advisor_id,
          }}
          supervisorId={profile.id}
          onClose={() => setSelected(null)}
          onScheduled={() => {
            setSelected(null);
            onScheduled();
          }}
        />
      ) : null}
    </>
  );
}

import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { EmptyState } from '@/shared/components/EmptyState';
import { saveMonthlyPlan } from '@/services/supabase/monthlyPlans';
import type {
  AdvisorMonthVisitStats,
  RegionPlanAssignment,
} from '@/services/supabase/monthlyPlans';
import type { AssociationWithRelations } from '@/services/supabase/associations';
import { translateError } from '@/services/supabase/errors';
import type { AdvisorRow, MonthlyPlanRow, ProfileRow } from '@/shared/types/domain';
import { getMonthLabel } from '@/shared/utils/date';
import {
  buildAdvisorPlanningItems,
  myActiveAdvisorIds,
  removedAdvisorsWithScheduledVisits,
} from '@/features/associations/planningModel';

export interface MonthlyPlanningPanelProps {
  regionId: string;
  year: number;
  month: number;
  profile: ProfileRow;
  advisors: AdvisorRow[];
  associations: AssociationWithRelations[];
  assignments: RegionPlanAssignment[];
  visitStats: Map<string, AdvisorMonthVisitStats>;
  plan: MonthlyPlanRow | null;
  onSaved: () => void;
}

const MAX_COLLAPSED_CHIPS = 4;

export function MonthlyPlanningPanel({
  regionId,
  year,
  month,
  profile,
  advisors,
  associations,
  assignments,
  visitStats,
  plan,
  onSaved,
}: MonthlyPlanningPanelProps) {
  const savedIds = useMemo(
    () => myActiveAdvisorIds(assignments, profile.id),
    [assignments, profile.id],
  );

  // Primera configuración del periodo: el bloque aparece expandido. El usuario
  // puede forzar la edición (Editar) o cerrarla (guardar/cancelar) mediante el
  // override; null = comportamiento por defecto según configured_at.
  const isFirstConfiguration = plan?.configured_at == null;
  const [editingOverride, setEditingOverride] = useState<boolean | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(savedIds);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemovals, setConfirmRemovals] = useState<AdvisorRow[] | null>(null);

  // Al cambiar de periodo/sede se re-sincroniza el estado local con lo
  // guardado (ajuste de estado durante el render, sin efectos).
  const periodKey = `${regionId}-${year}-${month}`;
  const [lastPeriodKey, setLastPeriodKey] = useState(periodKey);
  if (periodKey !== lastPeriodKey) {
    setLastPeriodKey(periodKey);
    setEditingOverride(null);
    setSelectedIds(savedIds);
    setSearch('');
    setError(null);
  }

  const editing = editingOverride ?? isFirstConfiguration;

  // Mientras no se edita, la selección visible es siempre la guardada.
  const effectiveSelectedIds = editing ? selectedIds : savedIds;

  const items = useMemo(
    () =>
      buildAdvisorPlanningItems({
        advisors,
        associations,
        assignments,
        visitStats,
        myProfileId: profile.id,
        selectedAdvisorIds: effectiveSelectedIds,
      }),
    [advisors, associations, assignments, visitStats, profile.id, effectiveSelectedIds],
  );

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.advisor.full_name.toLowerCase().includes(term));
  }, [items, search]);

  const selectedItems = items.filter((item) => item.selected);

  const toggleAdvisor = (advisorId: string, takenBy: string | null) => {
    if (takenBy) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(advisorId)) next.delete(advisorId);
      else next.add(advisorId);
      return next;
    });
  };

  const doSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveMonthlyPlan(regionId, year, month, [...selectedIds]);
      setConfirmRemovals(null);
      setEditingOverride(false);
      onSaved();
    } catch (err) {
      setError(translateError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    const removals = removedAdvisorsWithScheduledVisits(
      savedIds,
      selectedIds,
      visitStats,
      advisors,
    );
    if (removals.length > 0) {
      setConfirmRemovals(removals);
      return;
    }
    void doSave();
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h6" component="h2">
            Mi planificación del mes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getMonthLabel(year, month)} · Asesores con los que trabajarás este periodo.
          </Typography>
        </Box>
        {!editing ? (
          <Button
            startIcon={<EditRoundedIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              setSelectedIds(savedIds);
              setEditingOverride(true);
            }}
          >
            Editar
          </Button>
        ) : null}
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}

      {!editing ? (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            color={selectedItems.length > 0 ? 'primary' : 'default'}
            label={`${selectedItems.length} ${selectedItems.length === 1 ? 'asesor seleccionado' : 'asesores seleccionados'}`}
          />
          {selectedItems.slice(0, MAX_COLLAPSED_CHIPS).map((item) => (
            <Chip key={item.advisor.id} variant="outlined" label={item.advisor.full_name} />
          ))}
          {selectedItems.length > MAX_COLLAPSED_CHIPS ? (
            <Chip variant="outlined" label={`+${selectedItems.length - MAX_COLLAPSED_CHIPS} más`} />
          ) : null}
          {selectedItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Todavía no has seleccionado asesores para este periodo.
            </Typography>
          ) : null}
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <TextField
            label="Buscar asesor"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="small"
            fullWidth
            sx={{ maxWidth: 420 }}
          />

          {visibleItems.length === 0 ? (
            <EmptyState
              title="No hay asesores para mostrar"
              description="No se encontraron asesores con asociaciones activas en esta sede que coincidan con la búsqueda."
            />
          ) : (
            <List dense sx={{ mt: 1, maxHeight: 360, overflowY: 'auto' }}>
              {visibleItems.map((item) => {
                const labelId = `advisor-option-${item.advisor.id}`;
                const disabled = Boolean(item.takenBy);
                return (
                  <ListItem key={item.advisor.id} disablePadding>
                    <ListItemButton
                      role="checkbox"
                      aria-checked={item.selected}
                      aria-labelledby={labelId}
                      disabled={disabled}
                      onClick={() => toggleAdvisor(item.advisor.id, item.takenBy)}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={item.selected}
                          tabIndex={-1}
                          disableRipple
                          disabled={disabled}
                          slotProps={{ input: { 'aria-labelledby': labelId } }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        id={labelId}
                        primary={item.advisor.full_name}
                        secondary={
                          disabled
                            ? `Asignado a ${item.takenBy} en este periodo`
                            : `${item.activeAssociations} asociaciones activas · ${item.scheduledThisMonth} programadas · ${item.realizedThisMonth} realizadas este mes`
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}

          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={handleSaveClick} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar planificación'}
            </Button>
            {!isFirstConfiguration ? (
              <Button onClick={() => setEditingOverride(false)} disabled={saving}>
                Cancelar
              </Button>
            ) : null}
          </Box>
        </Box>
      )}

      <ConfirmDialog
        open={Boolean(confirmRemovals)}
        title="Retirar asesores con visitas programadas"
        description={`${(confirmRemovals ?? [])
          .map((advisor) => advisor.full_name)
          .join(
            ', ',
          )} tiene(n) visitas programadas este mes. Las visitas se mantendrán en la agenda y el historial se conservará; solo dejarán de aparecer en tu vista planificada. ¿Deseas continuar?`}
        confirmLabel="Retirar y guardar"
        confirmColor="warning"
        loading={saving}
        onCancel={() => setConfirmRemovals(null)}
        onConfirm={() => void doSave()}
      />
    </Paper>
  );
}

/** Vista de solo consulta para la jefatura: selecciones por supervisora. */
export function PlanningReadOnlySummary({
  assignments,
  advisors,
}: {
  assignments: RegionPlanAssignment[];
  advisors: AdvisorRow[];
}) {
  const advisorById = new Map(advisors.map((advisor) => [advisor.id, advisor]));
  const bySupervisor = new Map<string, { name: string; advisorNames: string[] }>();
  for (const assignment of assignments) {
    const supervisorId = assignment.plan?.supervisor_id;
    if (!supervisorId) continue;
    const entry = bySupervisor.get(supervisorId) ?? {
      name: assignment.plan?.supervisor?.full_name ?? 'Supervisora',
      advisorNames: [],
    };
    const advisor = advisorById.get(assignment.advisor_id);
    if (advisor) entry.advisorNames.push(advisor.full_name);
    bySupervisor.set(supervisorId, entry);
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Planificación del mes (consulta)
      </Typography>
      {bySupervisor.size === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ninguna supervisora ha configurado su planificación para este periodo.
        </Typography>
      ) : (
        [...bySupervisor.entries()].map(([supervisorId, entry]) => (
          <Box key={supervisorId} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2">{entry.name}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {entry.advisorNames.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin asesores seleccionados.
                </Typography>
              ) : (
                entry.advisorNames.map((name) => (
                  <Chip key={name} size="small" variant="outlined" label={name} />
                ))
              )}
            </Box>
          </Box>
        ))
      )}
    </Paper>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { fetchAssociations } from '@/services/supabase/associations';
import type { AssociationWithRelations } from '@/services/supabase/associations';
import { fetchAdvisors } from '@/services/supabase/advisors';
import { fetchRegions } from '@/services/supabase/regions';
import {
  addAdvisorToMonthlyPlan,
  fetchAdvisorMonthVisitStats,
  fetchMyPlan,
  fetchRegionActiveAssignments,
} from '@/services/supabase/monthlyPlans';
import {
  fetchActiveVisitsByRegion,
  fetchRealizedVisitSummariesByRegion,
} from '@/services/supabase/visits';
import { translateError } from '@/services/supabase/errors';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useAuth } from '@/features/auth/useAuth';
import { EmptyState } from '@/shared/components/EmptyState';
import { ErrorState } from '@/shared/components/ErrorState';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { MonthNavigator } from '@/shared/components/MonthNavigator';
import { ScheduleVisitDialog } from '@/features/visits/components/ScheduleVisitDialog';
import { isSupervisor } from '@/shared/utils/permissions';
import {
  ASSOCIATION_STATUS_COLORS,
  ASSOCIATION_STATUS_LABELS,
  VISIT_STATUS_LABELS,
} from '@/shared/utils/labels';
import { formatDateEsPE, getLimaNowYearMonth, getLimaTodayISODate } from '@/shared/utils/date';
import {
  DEFAULT_LIST_FILTERS,
  buildAssociationInsights,
  describeEvolution,
  filterAssociations,
  isOutsidePlan,
  sortAssociations,
} from '@/features/associations/associationInsights';
import type { AssociationListFilters } from '@/features/associations/associationInsights';
import { myActiveAdvisorIds } from '@/features/associations/planningModel';
import {
  MonthlyPlanningPanel,
  PlanningReadOnlySummary,
} from '@/features/associations/components/MonthlyPlanningPanel';

type ScheduleFlow =
  | { kind: 'schedule'; association: AssociationWithRelations }
  | { kind: 'confirm-add-advisor'; association: AssociationWithRelations }
  | { kind: 'blocked'; association: AssociationWithRelations; takenBy: string };

export function AssociationsListPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const supervisorMode = isSupervisor(profile);

  const [{ year, month }, setYearMonth] = useState(getLimaNowYearMonth());
  const [regionId, setRegionId] = useState('');
  const [filters, setFilters] = useState<AssociationListFilters>(DEFAULT_LIST_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [scheduleFlow, setScheduleFlow] = useState<ScheduleFlow | null>(null);
  const [addingAdvisor, setAddingAdvisor] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { data: regions } = useAsyncData(fetchRegions, []);
  const { data: advisors } = useAsyncData(fetchAdvisors, []);

  // Sede por defecto: la primera sede activa disponible para el usuario.
  const effectiveRegionId = regionId || regions?.[0]?.id || '';

  const {
    data: associations,
    loading: loadingAssociations,
    error: associationsError,
    reload: reloadAssociations,
  } = useAsyncData(
    () =>
      effectiveRegionId ? fetchAssociations({ regionId: effectiveRegionId }) : Promise.resolve([]),
    [effectiveRegionId],
  );

  const {
    data: assignments,
    loading: loadingAssignments,
    error: assignmentsError,
    reload: reloadAssignments,
  } = useAsyncData(
    () =>
      effectiveRegionId
        ? fetchRegionActiveAssignments(effectiveRegionId, year, month)
        : Promise.resolve([]),
    [effectiveRegionId, year, month],
  );

  const { data: plan, reload: reloadPlan } = useAsyncData(
    () =>
      effectiveRegionId && profile && supervisorMode
        ? fetchMyPlan(profile.id, effectiveRegionId, year, month)
        : Promise.resolve(null),
    [effectiveRegionId, year, month, profile?.id, supervisorMode],
  );

  const { data: visitStats, reload: reloadVisitStats } = useAsyncData(
    () =>
      effectiveRegionId
        ? fetchAdvisorMonthVisitStats(effectiveRegionId, year, month)
        : Promise.resolve(new Map()),
    [effectiveRegionId, year, month],
  );

  const { data: realizedSummaries, reload: reloadRealized } = useAsyncData(
    () =>
      effectiveRegionId
        ? fetchRealizedVisitSummariesByRegion(effectiveRegionId)
        : Promise.resolve([]),
    [effectiveRegionId],
  );

  const { data: activeVisits, reload: reloadActiveVisits } = useAsyncData(
    () => (effectiveRegionId ? fetchActiveVisitsByRegion(effectiveRegionId) : Promise.resolve([])),
    [effectiveRegionId],
  );

  const reloadPlanningData = () => {
    reloadAssignments();
    reloadPlan();
    reloadVisitStats();
  };

  const reloadVisitData = () => {
    reloadActiveVisits();
    reloadRealized();
    reloadVisitStats();
  };

  const insights = useMemo(
    () =>
      buildAssociationInsights(
        (associations ?? []).map((a) => a.id),
        realizedSummaries ?? [],
        activeVisits ?? [],
      ),
    [associations, realizedSummaries, activeVisits],
  );

  // Supervisora: sus asesores planificados. Jefatura: unión de todas las
  // selecciones del periodo (consulta el panorama completo de la sede).
  const plannedAdvisorIds = useMemo(() => {
    if (supervisorMode && profile) return myActiveAdvisorIds(assignments ?? [], profile.id);
    return new Set((assignments ?? []).map((assignment) => assignment.advisor_id));
  }, [assignments, profile, supervisorMode]);

  const filteredSorted = useMemo(() => {
    const applied = { ...filters, search: debouncedSearch };
    const filtered = filterAssociations(
      associations ?? [],
      insights,
      applied,
      plannedAdvisorIds,
      getLimaTodayISODate(),
    );
    return sortAssociations(filtered, insights, filters.sortBy);
  }, [associations, insights, filters, debouncedSearch, plannedAdvisorIds]);

  const advisorOptions = useMemo(() => {
    const ids = new Set((associations ?? []).map((a) => a.advisor_id));
    return (advisors ?? []).filter((advisor) => ids.has(advisor.id));
  }, [advisors, associations]);

  const setFilter = <K extends keyof AssociationListFilters>(
    key: K,
    value: AssociationListFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const hasCustomFilters =
    filters.search !== '' || filters.advisorId !== '' || filters.includeOutsidePlan;

  const findTakenBy = (advisorId: string): string | null => {
    for (const assignment of assignments ?? []) {
      if (
        assignment.advisor_id === advisorId &&
        assignment.plan?.supervisor_id &&
        assignment.plan.supervisor_id !== profile?.id
      ) {
        return assignment.plan.supervisor?.full_name ?? 'otra supervisora';
      }
    }
    return null;
  };

  const handleScheduleClick = (association: AssociationWithRelations) => {
    if (!supervisorMode) return;
    if (!isOutsidePlan(association, plannedAdvisorIds)) {
      setScheduleFlow({ kind: 'schedule', association });
      return;
    }
    const takenBy = findTakenBy(association.advisor_id);
    if (takenBy) {
      setScheduleFlow({ kind: 'blocked', association, takenBy });
      return;
    }
    setScheduleFlow({ kind: 'confirm-add-advisor', association });
  };

  const handleConfirmAddAdvisor = async () => {
    if (scheduleFlow?.kind !== 'confirm-add-advisor') return;
    const association = scheduleFlow.association;
    setAddingAdvisor(true);
    try {
      await addAdvisorToMonthlyPlan(effectiveRegionId, year, month, association.advisor_id);
      reloadPlanningData();
      // Continúa con la programación sin reiniciar el flujo.
      setScheduleFlow({ kind: 'schedule', association });
    } catch (error) {
      const translated = translateError(error);
      if (translated.code === 'ADVISOR_TAKEN') {
        setScheduleFlow({ kind: 'blocked', association, takenBy: translated.message });
      } else {
        setSnackbar(translated.message);
        setScheduleFlow(null);
      }
    } finally {
      setAddingAdvisor(false);
    }
  };

  const loading = loadingAssociations || loadingAssignments;
  const anyError = associationsError ?? assignmentsError;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h1">
          Asociaciones
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <MonthNavigator year={year} month={month} onChange={setYearMonth} />
          <TextField
            select
            label="Sede"
            value={effectiveRegionId}
            onChange={(event) => setRegionId(event.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            {(regions ?? []).map((region) => (
              <MenuItem key={region.id} value={region.id}>
                {region.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      {supervisorMode && profile && effectiveRegionId ? (
        <MonthlyPlanningPanel
          regionId={effectiveRegionId}
          year={year}
          month={month}
          profile={profile}
          advisors={advisors ?? []}
          associations={associations ?? []}
          assignments={assignments ?? []}
          visitStats={visitStats ?? new Map()}
          plan={plan ?? null}
          onSaved={() => {
            reloadPlanningData();
            setSnackbar('Planificación guardada.');
          }}
        />
      ) : null}
      {!supervisorMode ? (
        <PlanningReadOnlySummary assignments={assignments ?? []} advisors={advisors ?? []} />
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            label="Buscar por nombre o código de banca"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            size="small"
            sx={{ minWidth: 240, flexGrow: 1 }}
          />
          <TextField
            select
            label="Asesor"
            value={filters.advisorId}
            onChange={(event) => setFilter('advisorId', event.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {advisorOptions.map((advisor) => (
              <MenuItem key={advisor.id} value={advisor.id}>
                {advisor.full_name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mt: 1,
          }}
        >
          {supervisorMode ? (
            <FormControlLabel
              control={
                <Switch
                  checked={filters.includeOutsidePlan}
                  onChange={(event) => setFilter('includeOutsidePlan', event.target.checked)}
                />
              }
              label="Buscar también fuera de mi planificación"
            />
          ) : (
            <span />
          )}
          <Button onClick={() => setFilters(DEFAULT_LIST_FILTERS)} disabled={!hasCustomFilters}>
            Limpiar filtros
          </Button>
        </Box>
      </Paper>

      {anyError ? (
        <ErrorState
          error={anyError}
          onRetry={() => {
            reloadAssociations();
            reloadAssignments();
          }}
        />
      ) : null}

      {loading && !anyError ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={48} />
          ))}
        </Paper>
      ) : null}

      {!loading && !anyError && filteredSorted.length === 0 ? (
        <EmptyState
          title={
            supervisorMode && !filters.includeOutsidePlan && plannedAdvisorIds.size === 0
              ? 'Tu planificación de este mes está vacía'
              : 'Ninguna asociación coincide con los filtros'
          }
          description={
            supervisorMode && !filters.includeOutsidePlan && plannedAdvisorIds.size === 0
              ? 'Selecciona asesores en "Mi planificación del mes" o activa la búsqueda fuera de tu planificación.'
              : 'Prueba ajustando la búsqueda o los filtros.'
          }
        />
      ) : null}

      {!loading && !anyError && filteredSorted.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
          {filteredSorted.map((association) => {
            const info = insights.get(association.id);
            const outside =
              supervisorMode &&
              filters.includeOutsidePlan &&
              isOutsidePlan(association, plannedAdvisorIds);
            return (
              <Card
                key={association.id}
                variant="outlined"
                sx={{ display: 'flex', flexDirection: 'column' }}
              >
                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {association.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={ASSOCIATION_STATUS_LABELS[association.status]}
                      color={ASSOCIATION_STATUS_COLORS[association.status]}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Código {association.bank_code} · Asesor: {association.advisor?.full_name ?? '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Última visita: {formatDateEsPE(info?.lastVisitDate)}
                    {info?.lastScore != null ? ` · Puntuación: ${info.lastScore}` : ''}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {info ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          info.evolution.kind === 'IMPROVED'
                            ? 'success'
                            : info.evolution.kind === 'DECLINED'
                              ? 'error'
                              : 'default'
                        }
                        label={describeEvolution(info.evolution)}
                      />
                    ) : null}
                    {info?.pendingVisit ? (
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`${VISIT_STATUS_LABELS[info.pendingVisit.status]} para el ${formatDateEsPE(info.pendingVisit.scheduled_date)}`}
                      />
                    ) : null}
                    {outside ? (
                      <Chip size="small" color="warning" label="Fuera de tu planificación" />
                    ) : null}
                  </Box>
                </CardContent>
                <CardActions sx={{ pt: 0 }}>
                  <Button size="small" onClick={() => navigate(`/asociaciones/${association.id}`)}>
                    Ver detalle
                  </Button>
                  {supervisorMode ? (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={Boolean(info?.pendingVisit)}
                      onClick={() => handleScheduleClick(association)}
                      title={
                        info?.pendingVisit
                          ? 'Ya existe una visita pendiente para esta asociación.'
                          : undefined
                      }
                    >
                      Programar visita
                    </Button>
                  ) : null}
                </CardActions>
              </Card>
            );
          })}
        </Box>
      ) : null}

      {scheduleFlow?.kind === 'schedule' && profile ? (
        <ScheduleVisitDialog
          open
          association={{
            id: scheduleFlow.association.id,
            name: scheduleFlow.association.name,
            status: scheduleFlow.association.status,
            advisorId: scheduleFlow.association.advisor_id,
          }}
          supervisorId={profile.id}
          onClose={() => setScheduleFlow(null)}
          onScheduled={() => {
            setScheduleFlow(null);
            reloadVisitData();
            setSnackbar('Visita programada.');
          }}
        />
      ) : null}

      <ConfirmDialog
        open={scheduleFlow?.kind === 'confirm-add-advisor'}
        title="Asociación fuera de tu planificación"
        description={
          scheduleFlow?.kind === 'confirm-add-advisor'
            ? `El asesor ${scheduleFlow.association.advisor?.full_name ?? ''} no está en tu planificación de este mes. ¿Deseas agregarlo y continuar con la programación de la visita?`
            : ''
        }
        confirmLabel="Agregar y continuar"
        loading={addingAdvisor}
        onCancel={() => setScheduleFlow(null)}
        onConfirm={() => void handleConfirmAddAdvisor()}
      />

      {scheduleFlow?.kind === 'blocked' ? (
        <ConfirmDialog
          open
          title="No se puede programar desde tu planificación"
          description={`El asesor de esta asociación está asignado a ${scheduleFlow.takenBy} en esta sede y periodo. Puedes consultar el detalle de la asociación, pero no incorporarlo a tu planificación.`}
          confirmLabel="Ver detalle"
          onCancel={() => setScheduleFlow(null)}
          onConfirm={() => {
            const id = scheduleFlow.association.id;
            setScheduleFlow(null);
            navigate(`/asociaciones/${id}`);
          }}
        />
      ) : null}

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar}
      />
    </Box>
  );
}

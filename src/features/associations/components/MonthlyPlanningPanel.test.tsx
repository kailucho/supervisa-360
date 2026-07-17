import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonthlyPlanningPanel } from './MonthlyPlanningPanel';
import type { MonthlyPlanningPanelProps } from './MonthlyPlanningPanel';
import type { AssociationWithRelations } from '@/services/supabase/associations';
import type {
  AdvisorMonthVisitStats,
  RegionPlanAssignment,
} from '@/services/supabase/monthlyPlans';
import type { AdvisorRow, MonthlyPlanRow, ProfileRow } from '@/shared/types/domain';

const saveMonthlyPlanMock = vi.fn(async () => 'plan-1');

vi.mock('@/services/supabase/monthlyPlans', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/supabase/monthlyPlans')>();
  return {
    ...original,
    saveMonthlyPlan: (...args: unknown[]) =>
      (saveMonthlyPlanMock as unknown as (...a: unknown[]) => Promise<string>)(...args),
  };
});

const me: ProfileRow = {
  id: 'sup-1',
  full_name: 'Supervisora Uno',
  is_active: true,
  role: 'SUPERVISOR',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function advisor(id: string, name: string): AdvisorRow {
  return {
    id,
    code: `ASE-${id}`,
    full_name: name,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function associationFor(advisorId: string, id: string): AssociationWithRelations {
  return {
    id,
    bank_code: '10001',
    name: `Asociación ${id}`,
    region_id: 'region-1',
    status: 'NORMAL',
    advisor_id: advisorId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    region: null,
    advisor: null,
  } as AssociationWithRelations;
}

function assignmentFor(
  advisorId: string,
  supervisorId: string,
  supervisorName: string,
): RegionPlanAssignment {
  return {
    id: `as-${advisorId}`,
    monthly_plan_id: `plan-${supervisorId}`,
    advisor_id: advisorId,
    region_id: 'region-1',
    year: 2026,
    month: 7,
    selected_by: supervisorId,
    selected_at: '2026-07-01T00:00:00Z',
    removed_by: null,
    removed_at: null,
    plan: {
      id: `plan-${supervisorId}`,
      supervisor_id: supervisorId,
      region_id: 'region-1',
      year: 2026,
      month: 7,
      configured_at: '2026-07-01T00:00:00Z',
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      supervisor: { ...me, id: supervisorId, full_name: supervisorName },
    },
  } as RegionPlanAssignment;
}

const configuredPlan: MonthlyPlanRow = {
  id: 'plan-1',
  supervisor_id: 'sup-1',
  region_id: 'region-1',
  year: 2026,
  month: 7,
  configured_at: '2026-07-01T00:00:00Z',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

function renderPanel(overrides: Partial<MonthlyPlanningPanelProps> = {}) {
  const props: MonthlyPlanningPanelProps = {
    regionId: 'region-1',
    year: 2026,
    month: 7,
    profile: me,
    advisors: [advisor('a1', 'Ana Quispe'), advisor('a2', 'Carlos Mamani')],
    associations: [associationFor('a1', 'x1'), associationFor('a2', 'x2')],
    assignments: [],
    visitStats: new Map<string, AdvisorMonthVisitStats>(),
    plan: null,
    onSaved: vi.fn(),
    ...overrides,
  };
  return { ...render(<MonthlyPlanningPanel {...props} />), props };
}

beforeEach(() => {
  saveMonthlyPlanMock.mockClear();
});

describe('MonthlyPlanningPanel', () => {
  it('en la primera configuración del periodo aparece expandido con buscador', () => {
    renderPanel({ plan: null });
    expect(screen.getByLabelText(/buscar asesor/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar planificación/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('permite guardar una planificación vacía (cero asesores)', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ plan: null });
    await user.click(screen.getByRole('button', { name: /guardar planificación/i }));
    await waitFor(() => expect(saveMonthlyPlanMock).toHaveBeenCalledWith('region-1', 2026, 7, []));
    expect(props.onSaved).toHaveBeenCalled();
  });

  it('después de guardar se muestra contraído con cantidad, etiquetas y botón Editar', () => {
    renderPanel({
      plan: configuredPlan,
      assignments: [assignmentFor('a1', 'sup-1', 'Supervisora Uno')],
    });
    expect(screen.getByText('1 asesor seleccionado')).toBeInTheDocument();
    expect(screen.getByText('Ana Quispe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/buscar asesor/i)).not.toBeInTheDocument();
  });

  it('al editar, el asesor asignado a otra supervisora aparece deshabilitado y con su nombre', async () => {
    const user = userEvent.setup();
    renderPanel({
      plan: configuredPlan,
      assignments: [assignmentFor('a2', 'sup-2', 'Supervisora Dos')],
    });
    await user.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByText(/asignado a Supervisora Dos/i)).toBeInTheDocument();
    const takenOption = screen
      .getAllByRole('checkbox')
      .find((el) => el.getAttribute('aria-labelledby') === 'advisor-option-a2');
    expect(takenOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('al retirar un asesor con visitas programadas pide confirmación y no cancela las visitas', async () => {
    const user = userEvent.setup();
    renderPanel({
      plan: configuredPlan,
      assignments: [assignmentFor('a1', 'sup-1', 'Supervisora Uno')],
      visitStats: new Map([['a1', { scheduled: 2, realized: 0 }]]),
    });
    await user.click(screen.getByRole('button', { name: /editar/i }));
    // Desmarcar a Ana (retiro).
    await user.click(screen.getByText('Ana Quispe'));
    await user.click(screen.getByRole('button', { name: /guardar planificación/i }));

    // Aparece la confirmación y todavía no se guardó nada.
    expect(await screen.findByText(/visitas se mantendrán en la agenda/i)).toBeInTheDocument();
    expect(saveMonthlyPlanMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /retirar y guardar/i }));
    await waitFor(() => expect(saveMonthlyPlanMock).toHaveBeenCalledWith('region-1', 2026, 7, []));
  });

  it('retirar un asesor con solo visitas realizadas no requiere confirmación', async () => {
    const user = userEvent.setup();
    renderPanel({
      plan: configuredPlan,
      assignments: [assignmentFor('a1', 'sup-1', 'Supervisora Uno')],
      visitStats: new Map([['a1', { scheduled: 0, realized: 5 }]]),
    });
    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.click(screen.getByText('Ana Quispe'));
    await user.click(screen.getByRole('button', { name: /guardar planificación/i }));
    await waitFor(() => expect(saveMonthlyPlanMock).toHaveBeenCalledWith('region-1', 2026, 7, []));
  });
});

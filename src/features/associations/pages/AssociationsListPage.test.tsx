import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AssociationsListPage } from './AssociationsListPage';
import * as useAuthModule from '@/features/auth/useAuth';
import type { AuthContextValue } from '@/features/auth/authContext';
import type { AppRole, ProfileRow } from '@/shared/types/domain';
import { getLimaNowYearMonth, getMonthLabel } from '@/shared/utils/date';

const region = {
  id: 'region-1',
  code: 'AREQUIPA',
  name: 'Arequipa',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function advisor(id: string, name: string) {
  return {
    id,
    code: `ASE-${id}`,
    full_name: name,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function association(id: string, name: string, advisorId: string) {
  return {
    id,
    bank_code: `100${id.slice(-2)}`,
    name,
    region_id: region.id,
    status: 'NORMAL',
    advisor_id: advisorId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    region,
    advisor: advisor(advisorId, advisorId === 'adv-1' ? 'Ana Quispe' : 'Carlos Mamani'),
  };
}

const myAssignment = {
  id: 'as-1',
  monthly_plan_id: 'plan-1',
  advisor_id: 'adv-1',
  region_id: region.id,
  year: getLimaNowYearMonth().year,
  month: getLimaNowYearMonth().month,
  selected_by: 'sup-1',
  selected_at: '2026-07-01T00:00:00Z',
  removed_by: null,
  removed_at: null,
  plan: {
    id: 'plan-1',
    supervisor_id: 'sup-1',
    region_id: region.id,
    year: getLimaNowYearMonth().year,
    month: getLimaNowYearMonth().month,
    configured_at: '2026-07-01T00:00:00Z',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    supervisor: {
      id: 'sup-1',
      full_name: 'Supervisora Uno',
      is_active: true,
      role: 'SUPERVISOR',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  },
};

const otherAssignment = {
  ...myAssignment,
  id: 'as-2',
  monthly_plan_id: 'plan-2',
  advisor_id: 'adv-2',
  plan: {
    ...myAssignment.plan,
    id: 'plan-2',
    supervisor_id: 'sup-2',
    supervisor: { ...myAssignment.plan.supervisor, id: 'sup-2', full_name: 'Supervisora Dos' },
  },
};

const addAdvisorMock = vi.fn(async () => 'plan-1');

vi.mock('@/services/supabase/regions', () => ({
  fetchRegions: vi.fn(async () => [region]),
}));

vi.mock('@/services/supabase/advisors', () => ({
  fetchAdvisors: vi.fn(async () => [
    advisor('adv-1', 'Ana Quispe'),
    advisor('adv-2', 'Carlos Mamani'),
  ]),
}));

vi.mock('@/services/supabase/associations', () => ({
  fetchAssociations: vi.fn(async () => [
    association('assoc-01', 'Planificada Uno', 'adv-1'),
    association('assoc-02', 'Fuera del Plan', 'adv-2'),
  ]),
}));

vi.mock('@/services/supabase/monthlyPlans', () => ({
  fetchRegionActiveAssignments: vi.fn(async () => [myAssignment, otherAssignment]),
  fetchMyPlan: vi.fn(async () => myAssignment.plan),
  fetchAdvisorMonthVisitStats: vi.fn(async () => new Map()),
  addAdvisorToMonthlyPlan: (...args: unknown[]) =>
    (addAdvisorMock as unknown as (...a: unknown[]) => Promise<string>)(...args),
  saveMonthlyPlan: vi.fn(async () => 'plan-1'),
}));

vi.mock('@/services/supabase/visits', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/supabase/visits')>();
  return {
    ...original,
    fetchActiveVisitsByRegion: vi.fn(async () => []),
    fetchRealizedVisitSummariesByRegion: vi.fn(async () => []),
  };
});

function profileWithRole(role: AppRole): ProfileRow {
  return {
    id: 'sup-1',
    full_name: 'Supervisora Uno',
    is_active: true,
    role,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function mockAuth(overrides: Partial<AuthContextValue>) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'signed-in',
    session: null,
    profile: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/asociaciones']}>
      <AssociationsListPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AssociationsListPage (planificación integrada)', () => {
  it('selecciona por defecto el periodo actual', async () => {
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderPage();
    const { year, month } = getLimaNowYearMonth();
    expect(await screen.findByText(getMonthLabel(year, month))).toBeInTheDocument();
  });

  it('por defecto muestra solo asociaciones de los asesores planificados', async () => {
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderPage();
    expect(await screen.findByText('Planificada Uno')).toBeInTheDocument();
    expect(screen.queryByText('Fuera del Plan')).not.toBeInTheDocument();
  });

  it('con "Buscar también fuera de mi planificación" muestra y distingue las demás', async () => {
    const user = userEvent.setup();
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderPage();
    await screen.findByText('Planificada Uno');
    await user.click(screen.getByRole('switch', { name: /buscar también fuera/i }));
    expect(await screen.findByText('Fuera del Plan')).toBeInTheDocument();
    expect(screen.getByText('Fuera de tu planificación')).toBeInTheDocument();
  });

  it('bloquea programar cuando el asesor pertenece a otra supervisora en el periodo', async () => {
    const user = userEvent.setup();
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderPage();
    await screen.findByText('Planificada Uno');
    await user.click(screen.getByRole('switch', { name: /buscar también fuera/i }));
    await screen.findByText('Fuera del Plan');

    // La tarjeta "Fuera del Plan" (asesor adv-2, tomado por Supervisora Dos).
    const card = screen.getByText('Fuera del Plan').closest('.MuiCard-root') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: /programar visita/i }));
    expect(
      await screen.findByText(/asignado a Supervisora Dos en esta sede y periodo/i),
    ).toBeInTheDocument();
    expect(addAdvisorMock).not.toHaveBeenCalled();
  });

  it('la jefatura consulta sin bloque editable ni botones de programar', async () => {
    mockAuth({ profile: profileWithRole('SUPERVISION_MANAGER') });
    renderPage();
    expect(await screen.findByText('Planificación del mes (consulta)')).toBeInTheDocument();
    expect(screen.queryByText('Mi planificación del mes')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /programar visita/i })).not.toBeInTheDocument();
    // Ve las asociaciones de todas las selecciones del periodo.
    expect(await screen.findByText('Planificada Uno')).toBeInTheDocument();
    expect(screen.getByText('Fuera del Plan')).toBeInTheDocument();
  });
});

describe('AssociationsListPage (incorporación al programar fuera del plan)', () => {
  it('si el asesor está libre, pide confirmación y lo agrega antes de programar', async () => {
    // Sin la asignación de la otra supervisora: adv-2 queda libre.
    const monthlyPlans = await import('@/services/supabase/monthlyPlans');
    vi.mocked(monthlyPlans.fetchRegionActiveAssignments).mockResolvedValue([myAssignment] as never);

    const user = userEvent.setup();
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderPage();
    await screen.findByText('Planificada Uno');
    await user.click(screen.getByRole('switch', { name: /buscar también fuera/i }));
    await screen.findByText('Fuera del Plan');

    const card = screen.getByText('Fuera del Plan').closest('.MuiCard-root') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: /programar visita/i }));

    expect(await screen.findByText(/no está en tu planificación de este mes/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /agregar y continuar/i }));

    const { year, month } = getLimaNowYearMonth();
    await waitFor(() =>
      expect(addAdvisorMock).toHaveBeenCalledWith('region-1', year, month, 'adv-2'),
    );
    // Continúa con la programación sin reiniciar el flujo.
    expect(await screen.findByText(/programar visita — fuera del plan/i)).toBeInTheDocument();
  });
});

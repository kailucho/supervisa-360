import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchedulePage } from './SchedulePage';
import * as useAuthModule from '@/features/auth/useAuth';
import type { AuthContextValue } from '@/features/auth/authContext';
import type { AppRole, ProfileRow } from '@/shared/types/domain';
import type { VisitWithRelations } from '@/services/supabase/visits';

const sampleVisit = {
  id: 'visit-1',
  association_id: 'assoc-1',
  supervisor_id: 'sup-1',
  scheduled_advisor_id: 'adv-1',
  visit_type: 'ORDINARIA',
  modality: 'VIRTUAL',
  characteristic: 'ANUNCIADA',
  scheduled_date: '2026-07-15',
  scheduled_time: '09:00:00',
  status: 'PROGRAMADA',
  performed_date: null,
  start_time: null,
  end_time: null,
  score: null,
  general_comment: null,
  performed_by: null,
  result_updated_at: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  association: {
    id: 'assoc-1',
    bank_code: '10001',
    name: 'Paz y Amor',
    region_id: 'region-aqp',
    status: 'NORMAL',
    advisor_id: 'adv-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    region: {
      id: 'region-aqp',
      code: 'AREQUIPA',
      name: 'Arequipa',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  },
  supervisor: null,
  scheduled_advisor: null,
} as unknown as VisitWithRelations;

vi.mock('@/services/supabase/visits', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/supabase/visits')>();
  return {
    ...original,
    fetchAgendaVisits: vi.fn(async () => [sampleVisit]),
  };
});

vi.mock('@/services/supabase/profiles', () => ({
  fetchActiveSupervisors: vi.fn(async () => []),
  fetchActiveProfiles: vi.fn(async () => []),
  fetchProfile: vi.fn(async () => null),
}));

vi.mock('@/services/supabase/regions', () => ({
  fetchRegions: vi.fn(async () => []),
}));

vi.mock('@/services/supabase/associations', () => ({
  fetchAssociations: vi.fn(async () => []),
}));

function profileWithRole(role: AppRole): ProfileRow {
  return {
    id: 'sup-1',
    full_name: 'Persona de prueba',
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
    <MemoryRouter initialEntries={['/agenda']}>
      <SchedulePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SchedulePage según rol (RN-28)', () => {
  it('la supervisora ve el botón de programar y el menú de acciones', async () => {
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderPage();
    expect(await screen.findByText('Paz y Amor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /programar visita/i })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Acciones de la visita').length).toBeGreaterThan(0);
  });

  it('el jefe no ve botón de programar ni acciones, pero sí consulta las visitas', async () => {
    mockAuth({ profile: profileWithRole('SUPERVISION_MANAGER') });
    renderPage();
    expect(await screen.findByText('Paz y Amor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /programar visita/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Acciones de la visita')).not.toBeInTheDocument();
    expect(screen.queryByText('Acciones')).not.toBeInTheDocument();
  });
});

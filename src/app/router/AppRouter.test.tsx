import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';
import * as useAuthModule from '@/features/auth/useAuth';
import type { ProfileRow } from '@/shared/types/domain';

// Las páginas reales disparan consultas a Supabase: se sustituyen por stubs.
vi.mock('@/features/goals/pages/DashboardPage', () => ({
  DashboardPage: () => <div>Inicio (stub)</div>,
}));
vi.mock('@/app/layout/AppLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { AppLayout: () => <Outlet /> };
});

const supervisor: ProfileRow = {
  id: 'sup-1',
  full_name: 'Supervisora Uno',
  is_active: true,
  role: 'SUPERVISOR',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('AppRouter — /asesores retirado de la navegación', () => {
  it('acceder manualmente a /asesores redirige a /inicio', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'signed-in',
      session: null,
      profile: supervisor,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/asesores']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByText('Inicio (stub)')).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoleRoute } from './RoleRoute';
import { RoleHomeRedirect } from './RoleHomeRedirect';
import * as useAuthModule from './useAuth';
import type { AuthContextValue } from './authContext';
import type { AppRole, ProfileRow } from '@/shared/types/domain';

function profileWithRole(role: AppRole): ProfileRow {
  return {
    id: 'user-1',
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

function renderRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Pantalla de login</div>} />
        <Route path="/" element={<RoleHomeRedirect />} />
        <Route element={<RoleRoute allow={['SUPERVISOR']} />}>
          <Route path="/inicio" element={<div>Dashboard supervisora</div>} />
        </Route>
        <Route element={<RoleRoute allow={['SUPERVISION_MANAGER']} />}>
          <Route path="/jefatura" element={<div>Dashboard jefatura</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleHomeRedirect (redirección por rol en "/")', () => {
  it('envía a la supervisora a /inicio', () => {
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderRoutes('/');
    expect(screen.getByText('Dashboard supervisora')).toBeInTheDocument();
  });

  it('envía al jefe a /jefatura', () => {
    mockAuth({ profile: profileWithRole('SUPERVISION_MANAGER') });
    renderRoutes('/');
    expect(screen.getByText('Dashboard jefatura')).toBeInTheDocument();
  });
});

describe('RoleRoute (RN-28: rutas exclusivas por rol)', () => {
  it('la supervisora no accede a /jefatura: vuelve a su inicio', () => {
    mockAuth({ profile: profileWithRole('SUPERVISOR') });
    renderRoutes('/jefatura');
    expect(screen.getByText('Dashboard supervisora')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard jefatura')).not.toBeInTheDocument();
  });

  it('el jefe no accede a /inicio: vuelve a /jefatura', () => {
    mockAuth({ profile: profileWithRole('SUPERVISION_MANAGER') });
    renderRoutes('/inicio');
    expect(screen.getByText('Dashboard jefatura')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard supervisora')).not.toBeInTheDocument();
  });

  it('sin perfil cargado redirige al login', () => {
    mockAuth({ profile: null });
    renderRoutes('/inicio');
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
  });
});

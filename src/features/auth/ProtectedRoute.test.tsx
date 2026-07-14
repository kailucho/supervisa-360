import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as useAuthModule from './useAuth';
import type { AuthContextValue } from './authContext';

function mockAuth(overrides: Partial<AuthContextValue>) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'signed-out',
    session: null,
    profile: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  });
}

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={['/agenda']}>
      <Routes>
        <Route path="/login" element={<div>Pantalla de login</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/agenda" element={<div>Agenda privada</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute (HU-06)', () => {
  it('redirige a /login cuando no hay sesión', () => {
    mockAuth({ status: 'signed-out' });
    renderWithRoute();
    expect(screen.getByText('Pantalla de login')).toBeInTheDocument();
    expect(screen.queryByText('Agenda privada')).not.toBeInTheDocument();
  });

  it('muestra el contenido privado cuando hay sesión válida', () => {
    mockAuth({ status: 'signed-in' });
    renderWithRoute();
    expect(screen.getByText('Agenda privada')).toBeInTheDocument();
  });

  it('no muestra ni la ruta privada ni el login mientras restaura la sesión', () => {
    mockAuth({ status: 'loading' });
    renderWithRoute();
    expect(screen.queryByText('Agenda privada')).not.toBeInTheDocument();
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument();
  });
});

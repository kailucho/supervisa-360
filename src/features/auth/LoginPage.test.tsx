import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import * as useAuthModule from './useAuth';
import type { AuthContextValue } from './authContext';

function mockAuth(overrides: Partial<AuthContextValue> = {}) {
  const signIn = vi.fn().mockResolvedValue(null);
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'signed-out',
    session: null,
    profile: null,
    signIn,
    signOut: vi.fn(),
    ...overrides,
  });
  return { signIn };
}

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage (HU-06)', () => {
  it('muestra errores de validación al enviar el formulario vacío', async () => {
    mockAuth();
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('El correo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria.')).toBeInTheDocument();
  });

  it('llama a signIn con las credenciales ingresadas', async () => {
    const { signIn } = mockAuth();
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'supervisora1@supervisa360.local');
    await user.type(screen.getByLabelText('Contraseña'), 'Supervisa360!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('supervisora1@supervisa360.local', 'Supervisa360!');
    });
  });

  it('muestra un mensaje genérico cuando las credenciales son inválidas', async () => {
    mockAuth({
      signIn: vi.fn().mockResolvedValue({
        code: 'INVALID_CREDENTIALS',
        message: 'Correo o contraseña incorrectos.',
      }),
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'x@y.com');
    await user.type(screen.getByLabelText('Contraseña'), 'algo');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
  });
});

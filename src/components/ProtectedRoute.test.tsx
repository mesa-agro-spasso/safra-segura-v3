import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('mantém o conteúdo montado durante refresh de token com usuário e profile já carregados', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1', status: 'approved' },
      loading: true,
      isPasswordRecovery: false,
      session: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>conteúdo preservado</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText('conteúdo preservado')).toBeInTheDocument();
    expect(screen.queryByText(/aguardando-aprovacao/i)).not.toBeInTheDocument();
  });

  it('ainda mostra loading quando não há autenticação suficiente', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      isPasswordRecovery: false,
      session: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>conteúdo preservado</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.queryByText('conteúdo preservado')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
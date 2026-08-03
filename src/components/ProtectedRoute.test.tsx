import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-1',
  email: 'user@example.com',
  full_name: 'Usuário Teste',
  status: 'active',
  access_level: 'full',
  is_admin: false,
  theme: 'dark',
  forced_env: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  approved_at: null,
  approved_by: null,
  ...overrides,
});

const mockAuth = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => ({
  user: { id: 'user-1' },
  session: null,
  profile: makeProfile(),
  profileError: null,
  loading: false,
  isPasswordRecovery: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  refreshProfile: vi.fn(),
  ...overrides,
});

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('mantém o conteúdo montado durante refresh de token com usuário e profile já carregados', () => {
    mockedUseAuth.mockReturnValue(mockAuth({
      loading: true,
    }) as any);

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
    mockedUseAuth.mockReturnValue(mockAuth({
      user: null,
      profile: null,
      loading: true,
    }) as any);

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

  it('redireciona para /aguardando-aprovacao quando o perfil não existe', () => {
    mockedUseAuth.mockReturnValue(mockAuth({
      profile: null,
    }) as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/aguardando-aprovacao" element={<div>página de análise</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>conteúdo protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('página de análise')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
  });

  it('redireciona para /aguardando-aprovacao quando o perfil está pendente', () => {
    mockedUseAuth.mockReturnValue(mockAuth({
      profile: makeProfile({ status: 'pending' }),
    }) as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/aguardando-aprovacao" element={<div>página de análise</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>conteúdo protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('página de análise')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
  });

  it('mostra erro técnico e não redireciona para análise quando a consulta falha', () => {
    const refreshProfile = vi.fn();
    mockedUseAuth.mockReturnValue(mockAuth({
      profile: null,
      profileError: new Error('Could not query the database'),
      refreshProfile,
    }) as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/aguardando-aprovacao" element={<div>página de análise</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>conteúdo protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Falha ao carregar perfil')).toBeInTheDocument();
    expect(screen.queryByText('página de análise')).not.toBeInTheDocument();
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /tentar novamente/i });
    fireEvent.click(retryButton);
    expect(refreshProfile).toHaveBeenCalled();
  });

  it('chama signOut ao clicar em Sair na tela de erro técnico', () => {
    const signOut = vi.fn();
    mockedUseAuth.mockReturnValue(mockAuth({
      profile: null,
      profileError: new Error('Could not query the database'),
      signOut,
    }) as any);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/aguardando-aprovacao" element={<div>página de análise</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>conteúdo protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const signOutButton = screen.getByRole('button', { name: /sair/i });
    fireEvent.click(signOutButton);
    expect(signOut).toHaveBeenCalled();
  });
});

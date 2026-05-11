import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProducerFormDialog } from './ProducerFormDialog';

const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();

vi.mock('@/hooks/useWarehouses', () => ({
  useActiveArmazens: () => ({
    data: [
      { id: 'wh-1', display_name: 'Lucas do Rio Verde' },
      { id: 'wh-2', display_name: 'Sorriso' },
    ],
  }),
}));

vi.mock('@/hooks/useProducers', () => ({
  useCreateProducer: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateProducer: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProducerFormDialog', () => {
  beforeEach(() => {
    mockCreateMutateAsync.mockReset();
    mockUpdateMutateAsync.mockReset();
    mockCreateMutateAsync.mockResolvedValue({ id: 'producer-1' });
    mockUpdateMutateAsync.mockResolvedValue(undefined);
  });

  it('permite definir a nota do produtor e envia o valor no cadastro', async () => {
    render(
      <ProducerFormDialog
        open
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Nome do produtor ou empresa'), {
      target: { value: 'Produtor Teste' },
    });

    fireEvent.click(screen.getByRole('button', { name: '2 estrelas' }));

    expect(screen.getByText('2 estrelas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Produtor Teste',
          credit_rating: 2,
        }),
      );
    });
  });
});
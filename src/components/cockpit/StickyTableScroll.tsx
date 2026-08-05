import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Container ÚNICO de rolagem das tabelas do cockpit.
 *
 * `position: sticky` se ancora no ancestral de scroll mais próximo. O wrapper
 * padrão do componente `Table` cria um `overflow-auto` sem altura limitada, que
 * roubava essa âncora do cabeçalho — por isso o `sticky top-0` não segurava.
 * Aqui a rolagem dos dois eixos pertence a este elemento, e a tabela interna é
 * renderizada com `unstyledWrapper` para não criar um segundo contexto.
 */
export function StickyTableScroll({
  maxHeightClass,
  className,
  children,
}: {
  /** Limite de altura já existente no card, ex.: `max-h-[560px]`. */
  maxHeightClass: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('w-full min-w-0 overflow-auto', maxHeightClass, className)}>{children}</div>
  );
}

/** Camadas: canto (40) > cabeçalho (30) > coluna congelada do corpo (20). */
export const STICKY_HEAD = 'sticky top-0 z-30 bg-card';
export const STICKY_HEAD_CORNER = 'sticky top-0 z-40 bg-card';

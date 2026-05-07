import { useOutlet, useLocation } from 'react-router-dom';
import { useRef } from 'react';

/**
 * Outlet "keep-alive": mantém todas as páginas já visitadas montadas
 * em segundo plano, escondendo-as via CSS quando não estão ativas.
 * Preserva todo o estado local (modais, sub-abas, formulários, scroll).
 */
export function KeepAliveOutlet() {
  const element = useOutlet();
  const location = useLocation();
  const cacheRef = useRef<Map<string, React.ReactNode>>(new Map());

  // Atualiza/insere a entrada da rota atual
  if (element) {
    cacheRef.current.set(location.pathname, element);
  }

  return (
    <>
      {Array.from(cacheRef.current.entries()).map(([path, node]) => {
        const isActive = path === location.pathname;
        return (
          <div
            key={path}
            style={{ display: isActive ? 'contents' : 'none' }}
            aria-hidden={!isActive}
          >
            {node}
          </div>
        );
      })}
    </>
  );
}

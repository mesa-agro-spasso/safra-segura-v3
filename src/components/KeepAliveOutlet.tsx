import { useLocation, matchPath } from 'react-router-dom';
import { useRef, ReactNode } from 'react';

export interface KeepAliveRoute {
  path: string;
  element: ReactNode;
  /** se true, faz match exato (usar para "/") */
  end?: boolean;
}

interface Props {
  routes: KeepAliveRoute[];
  fallback?: ReactNode;
}

/**
 * Renderiza TODAS as páginas já visitadas mantidas montadas em segundo plano,
 * escondendo as inativas via CSS. Diferente de <Outlet />, NÃO depende de
 * <Routes>, então o React Router não desmonta as páginas ao trocar de rota.
 * Preserva 100% do estado local (modais, sub-abas, formulários, scroll).
 */
export function KeepAliveOutlet({ routes, fallback = null }: Props) {
  const location = useLocation();
  const visitedRef = useRef<Set<string>>(new Set());

  const activeRoute = routes.find((r) =>
    matchPath({ path: r.path, end: r.end ?? true }, location.pathname),
  );

  if (activeRoute) {
    visitedRef.current.add(activeRoute.path);
  }

  const visited = routes.filter((r) => visitedRef.current.has(r.path));

  if (visited.length === 0) return <>{fallback}</>;

  return (
    <>
      {visited.map((r) => {
        const isActive = r.path === activeRoute?.path;
        return (
          <div
            key={r.path}
            style={{ display: isActive ? 'contents' : 'none' }}
            aria-hidden={!isActive}
          >
            {r.element}
          </div>
        );
      })}
    </>
  );
}

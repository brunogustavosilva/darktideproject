import { lazy, Suspense, useCallback, useEffect, useState, useTransition } from 'react';
import Login from './Login.jsx';

const Dashboard = lazy(() => import('./Dashboard.jsx'));

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback((nextPath, { replace = false } = {}) => {
    if (window.location.pathname === nextPath && !replace) return;
    if (replace) window.history.replaceState({}, '', nextPath);
    else window.history.pushState({}, '', nextPath);
    startTransition(() => setPath(nextPath));
  }, []);

  useEffect(() => {
    const handlePopState = () => startTransition(() => setPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showDashboard = path === '/dashboard' || path === '/welcome';

  return (
    <div className={isPending ? 'app-root is-navigating' : 'app-root'}>
      {showDashboard ? (
        <Suspense fallback={<main className="app-loading" aria-label="Carregando painel"><span className="loading-indicator" /></main>}>
          <Dashboard navigate={navigate} />
        </Suspense>
      ) : (
        <Login navigate={navigate} />
      )}
    </div>
  );
}
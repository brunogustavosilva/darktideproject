import { useEffect, useRef, useState } from 'react';
import Brand from './Brand.jsx';
import { apiRequest, postJSON } from './api.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialPeriod() {
  const now = new Date();
  return {
    from: localISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${value}T12:00:00Z`));
}

function RollingCurrency({ value, className = 'metric-value' }) {
  const previousValue = useRef(0);
  const amount = Number(value || 0);
  const formatted = currency.format(amount);
  const previousDigits = currency.format(previousValue.current).match(/\d/g) || [];
  const nextDigits = formatted.match(/\d/g) || [];
  const canRoll = amount > previousValue.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let digitIndex = 0;
  let rollIndex = 0;

  useEffect(() => {
    previousValue.current = amount;
  }, [amount]);

  return (
    <p className={className} role="img" aria-label={formatted}>
      {[...formatted].map((character, characterIndex) => {
        if (!/\d/.test(character)) {
          return <span className="odometer-literal" aria-hidden="true" key={`${formatted}-literal-${characterIndex}`}>{character}</span>;
        }

        const positionFromRight = nextDigits.length - digitIndex - 1;
        const previousDigit = Number(previousDigits[previousDigits.length - positionFromRight - 1] || 0);
        const nextDigit = Number(character);
        const shouldRoll = canRoll && previousDigit !== nextDigit;
        const steps = shouldRoll ? (nextDigit - previousDigit + 10) % 10 || 10 : 0;
        const faces = shouldRoll
          ? Array.from({ length: steps + 1 }, (_, step) => (previousDigit + step) % 10)
          : [nextDigit];
        const animationDelay = shouldRoll ? `${rollIndex++ * 28}ms` : undefined;
        const currentDigit = digitIndex++;

        return (
          <span className="odometer-window" aria-hidden="true" key={`${amount}-${currentDigit}`}>
            <span
              className={shouldRoll ? 'odometer-reel is-rolling' : 'odometer-reel'}
              style={shouldRoll ? { '--roll-distance': `-${steps}em`, animationDelay } : undefined}
            >
              {faces.map((face, index) => <span className="odometer-face" key={`${face}-${index}`}>{face}</span>)}
            </span>
          </span>
        );
      })}
    </p>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" /></svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>;
}

function EntryRow({ entry, onConfirm, onDelete, pendingId }) {
  const isReceived = entry.status === 'received';
  return (
    <article className={`entry-row ${isReceived ? 'is-received' : 'is-planned'}`}>
      <div className="entry-description">
        <span className="entry-name">{entry.description}</span>
        <span className="entry-subtitle">{isReceived ? 'Entrada confirmada' : 'Previsão de entrada'}</span>
      </div>
      <time className="entry-date" dateTime={entry.received_at || entry.due_date}>{formatDate(entry.received_at || entry.due_date)}</time>
      <span className={`entry-status ${entry.status}`}>{isReceived ? 'Recebido' : 'A receber'}</span>
      <span className="entry-amount">{currency.format(Number(entry.amount))}</span>
      <div className="entry-actions">
        {!isReceived && (
          <button className="confirm-entry" type="button" disabled={pendingId === entry.id} onClick={() => onConfirm(entry)}>
            {pendingId === entry.id ? 'Confirmando...' : 'Confirmar recebimento'}
          </button>
        )}
        <button
          className="delete-entry"
          type="button"
          aria-label={`Remover ${isReceived ? 'recebimento' : 'previsão'}: ${entry.description}`}
          title={`Remover: ${entry.description}`}
          onClick={() => onDelete(entry)}
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

function EntryDialog({ onClose, onSave, saving, message }) {
  const [status, setStatus] = useState('received');

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSave({
      description: formData.get('description'),
      amount: Number(formData.get('amount')),
      status,
      date: formData.get('date')
    });
  }

  return (
    <div className="react-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="entry-dialog react-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-dialog-title" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
        <form className="entry-form" onSubmit={handleSubmit}>
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">NOVO REGISTRO</p>
              <h2 id="entry-dialog-title">Adicionar entrada</h2>
            </div>
            <button className="dialog-close" type="button" aria-label="Fechar" onClick={onClose}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <label className="form-label" htmlFor="entry-description">Descrição</label>
          <input className="form-control" id="entry-description" name="description" maxLength="140" placeholder="Ex.: Projeto de identidade visual" required autoFocus />

          <div className="form-grid">
            <div>
              <label className="form-label" htmlFor="entry-amount">Valor</label>
              <div className="amount-control"><span>R$</span><input className="form-control" id="entry-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" required /></div>
            </div>
            <div>
              <label className="form-label" htmlFor="entry-date">{status === 'received' ? 'Data do recebimento' : 'Data prevista'}</label>
              <input className="form-control" id="entry-date" name="date" type="date" defaultValue={localISODate()} required />
            </div>
          </div>

          <fieldset className="status-fieldset">
            <legend className="form-label">Tipo de entrada</legend>
            <div className="entry-type-options">
              <label><input type="radio" name="status" value="received" checked={status === 'received'} onChange={() => setStatus('received')} /><span>Recebido</span></label>
              <label><input type="radio" name="status" value="planned" checked={status === 'planned'} onChange={() => setStatus('planned')} /><span>Previsto para receber</span></label>
            </div>
          </fieldset>

          <p className="form-message" role="alert" aria-live="polite">{message}</p>
          <div className="dialog-actions">
            <button className="secondary-action" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action" type="submit" disabled={saving}><span>{saving ? 'Salvando...' : 'Salvar lançamento'}</span></button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteDialog({ entry, onClose, onDelete, deleting, message }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !deleting) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleting, onClose]);

  if (!entry) return null;
  return (
    <div className="react-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleting && onClose()}>
      <section className="entry-dialog delete-dialog react-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title">
        <div className="delete-confirmation">
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">REMOVER REGISTRO</p>
              <h2 id="delete-dialog-title">Excluir lançamento?</h2>
            </div>
            <button className="dialog-close" type="button" aria-label="Fechar" disabled={deleting} onClick={onClose}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <p className="delete-dialog-copy">O lançamento <strong>“{entry.description}”</strong> será removido permanentemente.</p>
          <p className="form-message" role="alert" aria-live="polite">{message}</p>
          <div className="dialog-actions">
            <button className="secondary-action" type="button" disabled={deleting} onClick={onClose}>Cancelar</button>
            <button className="delete-confirm-action" type="button" disabled={deleting} onClick={() => onDelete(entry)}>
              <TrashIcon />
              <span>{deleting ? 'Removendo...' : 'Remover lançamento'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Dashboard({ navigate }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState(initialPeriod);
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({ received: 0, planned: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [loadingError, setLoadingError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/api/session', { signal: controller.signal })
      .then(({ user: activeUser }) => setUser(activeUser))
      .catch((error) => {
        if (error.name !== 'AbortError') navigate('/', { replace: true });
      });
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    const query = new URLSearchParams({ status, from: period.from, to: period.to });
    setIsLoading(true);
    setLoadingError('');
    apiRequest(`/api/entries?${query}`, { signal: controller.signal })
      .then((result) => {
        setEntries(result.entries);
        setTotals({ received: Number(result.totals.received), planned: Number(result.totals.planned) });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadingError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [user, status, period, revision]);

  async function handleCreate(data) {
    setIsSaving(true);
    setEntryError('');
    setNotice('');
    try {
      await postJSON('/api/entries', data);
      setIsSaving(false);
      setRevision((value) => value + 1);
      setEntryError('');
      return true;
    } catch (error) {
      setEntryError(error.message);
      setIsSaving(false);
      return false;
    }
  }

  async function handleConfirm(entry) {
    setPendingId(entry.id);
    setNotice('');
    try {
      await postJSON(`/api/entries/${entry.id}/confirm`, {});
      setRevision((value) => value + 1);
    } catch (error) {
      setLoadingError(error.message);
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(entry) {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await apiRequest(`/api/entries/${entry.id}`, { method: 'DELETE' });
      setDeleteEntry(null);
      setRevision((value) => value + 1);
      setNotice('Lançamento removido.');
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
    } finally {
      navigate('/', { replace: true });
    }
  }

  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Brand href="/dashboard" onClick={(event) => { event.preventDefault(); navigate('/dashboard'); }} />
        <div className="dashboard-account">
          <span className="account-avatar">{(user?.name || user?.username || 'A').slice(0, 1).toUpperCase()}</span>
          <span className="account-name">{user?.name || user?.username || '...'}</span>
          <button className="logout-button" type="button" aria-label="Encerrar sessão" title="Encerrar sessão" onClick={handleLogout}>
            <LogoutIcon />
          </button>
        </div>
      </header>

      <section className="dashboard-heading">
        <div>
          <p className="eyebrow"><span className="status-dot" /> VISÃO FINANCEIRA</p>
          <h1>Entradas<span>, em foco.</span></h1>
          <p className="dashboard-subtitle">Acompanhe o que chegou e o que ainda está a caminho.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => { setEntryError(''); setNotice(''); setIsSaving(false); setShowEntryDialog(true); }}>
          <ArrowIcon /><span>Novo lançamento</span>
        </button>
      </section>

      <section className="money-summary" aria-label="Resumo financeiro do período">
        <article className="money-metric received-metric">
          <div className="metric-label"><span className="metric-symbol received-symbol">↓</span> RECEBIDO</div>
          <RollingCurrency value={totals.received} />
          <p className="metric-footnote">Valor que já entrou</p>
        </article>
        <article className="money-metric planned-metric">
          <div className="metric-label"><span className="metric-symbol planned-symbol">↗</span> PREVISTO PARA RECEBER</div>
          <RollingCurrency value={totals.planned} />
          <p className="metric-footnote">Valor ainda esperado</p>
        </article>
        <div className="summary-period">{monthLabel.toUpperCase()}</div>
      </section>

      <section className="feed-section" aria-labelledby="feed-title">
        <div className="feed-toolbar">
          <div className="feed-title-group">
            <h2 id="feed-title">Movimentações</h2>
            <span className="entry-count">{entries.length} {entries.length === 1 ? 'registro' : 'registros'}</span>
          </div>
          <div className="filter-controls">
            <div className="status-tabs" role="group" aria-label="Filtrar movimentações por status">
              {[
                ['all', 'Todos'],
                ['planned', 'A receber'],
                ['received', 'Recebidos']
              ].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
              ))}
            </div>
            <label className="date-filter"><span>De</span><input type="date" aria-label="Data inicial" value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} /></label>
            <label className="date-filter"><span>Até</span><input type="date" aria-label="Data final" value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} /></label>
          </div>
        </div>

        <div className="feed-columns" aria-hidden="true"><span>DESCRIÇÃO</span><span>DATA</span><span>STATUS</span><span>VALOR</span><span /></div>
        <div className="entry-list" aria-busy={isLoading}>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onConfirm={handleConfirm} onDelete={(selected) => { setDeleteError(''); setDeleteEntry(selected); }} pendingId={pendingId} />
          ))}
        </div>
        {loadingError && <p className="feed-message" role="alert">{loadingError}</p>}
        {notice && <p className="feed-message is-success" role="status">{notice}</p>}
        {!isLoading && !loadingError && entries.length === 0 && (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">＋</span>
            <p className="empty-title">Nenhuma movimentação por aqui</p>
            <p className="empty-copy">Ajuste o período ou cadastre seu primeiro lançamento.</p>
          </div>
        )}
      </section>

      <footer className="dashboard-footer">
        <span>© 2026 DARKTIDE</span>
        <span><span className="footer-indicator" /> REGISTROS REMOVIDOS TODO DIA 05</span>
      </footer>

      {showEntryDialog && (
        <EntryDialog onClose={() => setShowEntryDialog(false)} onSave={async (data) => {
          if (await handleCreate(data)) setShowEntryDialog(false);
        }} saving={isSaving} message={entryError} />
      )}
      <DeleteDialog entry={deleteEntry} onClose={() => setDeleteEntry(null)} onDelete={handleDelete} deleting={isDeleting} message={deleteError} />
    </main>
  );
}
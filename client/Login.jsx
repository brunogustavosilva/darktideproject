import { useState } from 'react';
import Brand from './Brand.jsx';
import { postJSON } from './api.js';

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      <path className="eye-slash" d="m4 4 16 16" />
    </svg>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export default function Login({ navigate }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);
    try {
      await postJSON('/api/login', { username, password });
      navigate('/dashboard');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-panel" aria-labelledby="page-title">
        <Brand />
        <div className="panel-copy">
          <p className="eyebrow"><span className="status-dot" /> ACESSO RESTRITO</p>
          <h1 id="page-title">Bom ter você<br /><span>de volta.</span></h1>
          <p className="intro">Entre no seu espaço e continue de onde parou.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Usuário</label>
          <div className="input-wrap">
            <span className="field-icon" aria-hidden="true">◎</span>
            <input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="Seu usuário"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="label-row">
            <label htmlFor="password">Senha</label>
            <span className="secure-note">CONEXÃO SEGURA</span>
          </div>
          <div className="input-wrap">
            <span className="field-icon lock-icon" aria-hidden="true">⌑</span>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className="reveal-button"
              type="button"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <EyeIcon />
            </button>
          </div>

          <p className="form-message" role="alert" aria-live="polite">{message}</p>
          <button className="submit-button" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'Entrando...' : 'Entrar no painel'}</span>
            <ArrowIcon />
          </button>
        </form>

        <footer className="panel-footer">
          <span>© 2026 DARKTIDE</span>
          <span className="footer-right"><span className="footer-indicator" /> AMBIENTE LOCAL</span>
        </footer>
      </section>

      <aside className="visual-panel" aria-label="Arte abstrata Darktide">
        <div className="visual-topline"><span>DT / 001</span><span>EST. 2026</span></div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="sun-core"><span /><span /><span /><span /></div>
        <div className="visual-caption"><span>01 — 03</span><span>EXPLORE O DESCONHECIDO</span></div>
        <div className="vertical-label">DARKTIDE / PRIVATE ACCESS</div>
      </aside>
    </main>
  );
}
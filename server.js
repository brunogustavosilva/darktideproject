const path = require('node:path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const { pool, ensureDatabaseSchema } = require('./src/db');
const { runMonthlyCleanup, listEntries, createEntry, confirmEntry, deleteEntry } = require('./src/finance');

const app = express();
const port = Number(process.env.PORT) || 3000;
const distDirectory = path.join(__dirname, 'dist');

app.use(express.json());
app.use(session({
  name: 'darktide.sid',
  secret: process.env.SESSION_SECRET || 'darktide-local-development-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

function requireLogin(request, response, next) {
  if (!request.session.user) {
    if (request.path.startsWith('/api/')) {
      return response.status(401).json({ message: 'Sua sessão expirou. Entre novamente.' });
    }
    return response.redirect('/');
  }
  next();
}

async function requireDatabaseUser(request, response, next) {
  if (!pool) {
    return response.status(503).json({ message: 'Configure a conexão do Neon para usar os lançamentos.' });
  }

  try {
    let userId = request.session.user.id;
    if (!userId) {
      const result = await pool.query('SELECT id FROM users WHERE username = $1', [request.session.user.username]);
      userId = result.rows[0]?.id;
    }
    if (!userId) return response.status(401).json({ message: 'Usuário não encontrado no banco.' });
    request.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
}

function validISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validEntryId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

async function authenticate(username, password) {
  if (pool) {
    const result = await pool.query(
      'SELECT username, display_name, password_hash FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return null;
    }
    return { id: user.id, username: user.username, name: user.display_name };
  }

  const demoUsername = process.env.DEMO_USERNAME || 'root';
  const demoPassword = process.env.DEMO_PASSWORD || 'administrator';
  if (username !== demoUsername || password !== demoPassword) {
    return null;
  }
  return { username, name: 'Administrador' };
}

app.post('/api/login', async (request, response, next) => {
  const { username, password } = request.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return response.status(400).json({ message: 'Preencha usuário e senha.' });
  }

  try {
    const user = await authenticate(username.trim(), password);
    if (!user) {
      return response.status(401).json({ message: 'Usuário ou senha incorretos.' });
    }
    request.session.user = user;
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/logout', (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie('darktide.sid');
    response.sendStatus(204);
  });
});

app.post('/logout', (request, response, next) => {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie('darktide.sid');
    response.redirect('/');
  });
});

app.get('/api/session', (request, response) => {
  if (!request.session.user) {
    return response.status(401).json({ message: 'Sua sessão expirou. Entre novamente.' });
  }
  const { username, name } = request.session.user;
  response.json({ user: { username, name } });
});

app.get('/api/entries', requireLogin, requireDatabaseUser, async (request, response, next) => {
  const status = request.query.status || 'all';
  const from = request.query.from || '';
  const to = request.query.to || '';
  if (!['all', 'received', 'planned'].includes(status)) {
    return response.status(400).json({ message: 'Filtro de status inválido.' });
  }
  if ((from && !validISODate(from)) || (to && !validISODate(to)) || (from && to && from > to)) {
    return response.status(400).json({ message: 'O período informado é inválido.' });
  }

  try {
    response.json(await listEntries({ userId: request.userId, status, from, to }));
  } catch (error) {
    next(error);
  }
});

app.post('/api/entries', requireLogin, requireDatabaseUser, async (request, response, next) => {
  const { description, amount, status, date } = request.body || {};
  const cleanDescription = typeof description === 'string' ? description.trim() : '';
  if (!cleanDescription || cleanDescription.length > 140) {
    return response.status(400).json({ message: 'Informe uma descrição de até 140 caracteres.' });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999) {
    return response.status(400).json({ message: 'Informe um valor válido maior que zero.' });
  }
  if (!['received', 'planned'].includes(status) || !validISODate(date)) {
    return response.status(400).json({ message: 'Informe o tipo e a data do lançamento.' });
  }

  try {
    const entry = await createEntry({
      userId: request.userId,
      description: cleanDescription,
      amount: amount.toFixed(2),
      status,
      date
    });
    response.status(201).json({ entry });
  } catch (error) {
    next(error);
  }
});

app.post('/api/entries/:id/confirm', requireLogin, requireDatabaseUser, async (request, response, next) => {
  if (!validEntryId(request.params.id)) return response.status(400).json({ message: 'Lançamento inválido.' });
  try {
    const entry = await confirmEntry({ userId: request.userId, entryId: request.params.id });
    if (!entry) return response.status(404).json({ message: 'Previsão não encontrada.' });
    response.json({ entry });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/entries/:id', requireLogin, requireDatabaseUser, async (request, response, next) => {
  if (!validEntryId(request.params.id)) return response.status(400).json({ message: 'Lançamento inválido.' });
  try {
    const deleted = await deleteEntry({ userId: request.userId, entryId: request.params.id });
    if (!deleted) return response.status(404).json({ message: 'Lançamento não encontrado.' });
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(distDirectory, { index: false, maxAge: '1y', immutable: true }));

app.get('/welcome', requireLogin, (request, response) => {
  response.redirect('/dashboard');
});

app.get('/dashboard', requireLogin, requireDatabaseUser, (request, response) => {
  response.sendFile(path.join(distDirectory, 'index.html'));
});

app.get('/', (request, response) => {
  if (request.session.user) return response.redirect('/dashboard');
  response.sendFile(path.join(distDirectory, 'index.html'));
});

app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ message: 'Ocorreu um erro interno.' });
});

async function startServer() {
  if (pool) {
    await ensureDatabaseSchema();
    const removed = await runMonthlyCleanup();
    if (removed) console.log(`Limpeza mensal: ${removed} lançamento(s) removido(s).`);
    cron.schedule('0 0 5 * *', () => {
      runMonthlyCleanup().catch((error) => console.error('Monthly cleanup failed:', error.code || error.message));
    }, { timezone: 'America/Sao_Paulo' });
  }

  app.listen(port, () => {
    console.log(`Darktide disponível em http://localhost:${port}`);
    console.log(pool ? 'Autenticação: PostgreSQL' : 'Autenticação: demonstração local');
  });
}

startServer().catch((error) => {
  console.error('Startup failed:', error.code || error.message);
  process.exitCode = 1;
});
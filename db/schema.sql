CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description VARCHAR(140) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(12) NOT NULL CHECK (status IN ('received', 'planned')),
  due_date DATE NOT NULL,
  received_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'planned' AND received_at IS NULL)
    OR (status = 'received' AND received_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS financial_entries_user_date_idx
  ON financial_entries (user_id, due_date DESC);

CREATE TABLE IF NOT EXISTS app_maintenance (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  last_cleared_month DATE NOT NULL
);

INSERT INTO app_maintenance (id, last_cleared_month)
VALUES (1, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date)
ON CONFLICT (id) DO NOTHING;
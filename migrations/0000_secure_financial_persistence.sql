CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE connection_status AS ENUM ('pending', 'active', 'error', 'revoked');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_active_lookup_idx ON sessions(token_hash, expires_at);

CREATE TABLE financial_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(64) NOT NULL,
  provider_item_id varchar(255) NOT NULL,
  encrypted_access_token text NOT NULL,
  encryption_key_version varchar(32) NOT NULL,
  status connection_status NOT NULL DEFAULT 'pending',
  cursor text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_connections_owner_item_unique UNIQUE (user_id, provider_item_id)
);
CREATE INDEX financial_connections_owner_idx ON financial_connections(user_id);

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES financial_connections(id) ON DELETE CASCADE,
  provider_account_id varchar(255) NOT NULL,
  display_name varchar(255) NOT NULL,
  account_type varchar(100) NOT NULL,
  currency varchar(3) NOT NULL,
  current_balance_minor bigint,
  available_balance_minor bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_connection_provider_unique UNIQUE (connection_id, provider_account_id)
);
CREATE INDEX accounts_owner_idx ON accounts(user_id);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_transaction_id varchar(255) NOT NULL,
  merchant varchar(255) NOT NULL,
  merchant_normalized varchar(255),
  amount_minor bigint NOT NULL,
  currency varchar(3) NOT NULL,
  occurred_on date NOT NULL,
  category varchar(100) NOT NULL,
  pending boolean NOT NULL DEFAULT false,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_account_provider_unique UNIQUE (account_id, provider_transaction_id)
);
CREATE INDEX transactions_owner_date_idx ON transactions(user_id, occurred_on);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category varchar(100) NOT NULL,
  budgeting_month date NOT NULL,
  monthly_limit_minor bigint NOT NULL,
  currency varchar(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_owner_category_month_unique UNIQUE (user_id, category, budgeting_month)
);
CREATE INDEX budgets_owner_month_idx ON budgets(user_id, budgeting_month);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE users FROM anon, authenticated;
REVOKE ALL ON TABLE sessions FROM anon, authenticated;
REVOKE ALL ON TABLE financial_connections FROM anon, authenticated;
REVOKE ALL ON TABLE accounts FROM anon, authenticated;
REVOKE ALL ON TABLE transactions FROM anon, authenticated;
REVOKE ALL ON TABLE budgets FROM anon, authenticated;

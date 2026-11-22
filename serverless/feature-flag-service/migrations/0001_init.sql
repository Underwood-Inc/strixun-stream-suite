CREATE TABLE IF NOT EXISTS flag_state (
  flag_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  catalog_revision TEXT NOT NULL,
  PRIMARY KEY (flag_id, environment)
);
CREATE TABLE IF NOT EXISTS identity_override (
  flag_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  value_json TEXT NOT NULL,
  expires_at TEXT,
  reason TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (flag_id, customer_id, environment)
);
CREATE TABLE IF NOT EXISTS audit_event (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_customer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  flag_id TEXT,
  target_customer_id TEXT,
  old_json TEXT,
  new_json TEXT,
  reason TEXT,
  origin TEXT
);
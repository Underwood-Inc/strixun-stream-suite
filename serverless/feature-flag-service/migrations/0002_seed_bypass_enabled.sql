-- Optional dev seed: enable global auth rate-limit bypass kill switch (per-user grant still required).
INSERT INTO flag_state (flag_id, environment, value_json, updated_at, updated_by, catalog_revision)
VALUES ('auth.rate-limit.bypass-enabled', 'production', 'true', datetime('now'), 'migration', '1')
ON CONFLICT(flag_id, environment) DO NOTHING;
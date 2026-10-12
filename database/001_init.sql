CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY CHECK (id=1), data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  name text NOT NULL, password_hash text, role text NOT NULL CHECK (role IN ('owner','manager','viewer')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('invite','reset')), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, hits integer NOT NULL, resets_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY, reference text NOT NULL UNIQUE,
  request_key uuid NOT NULL UNIQUE, request_hash text NOT NULL,
  start_date date NOT NULL, end_date date NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','completed','cancelled')),
  occupied boolean NOT NULL DEFAULT true, data jsonb NOT NULL, quote jsonb NOT NULL,
  terms_snapshot jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
  notes text NOT NULL DEFAULT '', payment_status text NOT NULL DEFAULT 'open' CHECK (payment_status IN ('open','paid')),
  payment_note text NOT NULL DEFAULT '', google_event_id text, google_calendar_id text,
  calendar_synced_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(end_date>=start_date AND end_date<=start_date+13),
  CONSTRAINT no_double_booking EXCLUDE USING gist (daterange(start_date,end_date,'[]') WITH &&) WHERE (occupied)
);
CREATE TABLE IF NOT EXISTS integrations (
  id text PRIMARY KEY, encrypted_value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES staff(id), verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unique_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('calendar','email')), booking_id uuid REFERENCES bookings(id),
  payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz, lock_token uuid, last_error text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs(status,available_at);
CREATE TABLE IF NOT EXISTS audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES staff(id),
  action text NOT NULL, booking_id uuid REFERENCES bookings(id), details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);

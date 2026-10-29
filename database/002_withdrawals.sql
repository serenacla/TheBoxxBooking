CREATE TABLE IF NOT EXISTS withdrawals (
 id uuid PRIMARY KEY, request_key uuid NOT NULL UNIQUE, request_hash text NOT NULL,
 name text NOT NULL, email text NOT NULL, contract text NOT NULL, declaration text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reviewed_at timestamptz, reviewed_by uuid REFERENCES staff(id)
);
CREATE INDEX IF NOT EXISTS withdrawals_received_idx ON withdrawals(received_at DESC);

-- order_claims
CREATE TABLE IF NOT EXISTS order_claims (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  claim_amount NUMERIC(78,0) NOT NULL,
  claim_tx_hash VARCHAR(66) DEFAULT NULL,
  claimer_address VARCHAR(42) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'success',
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_claim_status CHECK (status IN ('success','failed','pending'))
);
CREATE INDEX IF NOT EXISTS idx_order_claims_order ON order_claims(order_id);
CREATE INDEX IF NOT EXISTS idx_order_claims_claimer ON order_claims(claimer_address);
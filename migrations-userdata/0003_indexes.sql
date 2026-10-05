CREATE INDEX wb_accounts_created ON wb_accounts(created_at,locale,is_test);
CREATE INDEX wb_operations_completed ON wb_operations(owner,completed_at);
CREATE INDEX wb_mutations_created ON wb_mutations(created_at);
CREATE INDEX session_expiry_idx ON session(expiresAt);
CREATE INDEX verification_expiry_idx ON verification(expiresAt);

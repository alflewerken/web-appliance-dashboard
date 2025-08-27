-- Add ping status fields to hosts table
ALTER TABLE hosts 
ADD COLUMN IF NOT EXISTS ping_status VARCHAR(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS ping_response_time FLOAT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_ping_check DATETIME DEFAULT NULL;

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_hosts_ping_status ON hosts(ping_status);

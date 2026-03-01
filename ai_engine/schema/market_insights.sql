-- market_insights table — stores AI-generated market intelligence
-- Run this migration in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS market_insights (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title       text NOT NULL,
    text        text NOT NULL,
    insight_type text NOT NULL DEFAULT 'general',   -- trending | declining | surge | general
    severity    text NOT NULL DEFAULT 'medium',     -- high | medium | low
    market_summary text DEFAULT '',
    raw_trends  jsonb DEFAULT '{}',
    created_at  timestamptz DEFAULT now()
);

-- Index for fast recent-first queries
CREATE INDEX IF NOT EXISTS idx_insights_created
    ON market_insights (created_at DESC);

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_insights_type
    ON market_insights (insight_type);

-- Auto-cleanup: keep only last 30 days of insights (optional)
-- Uncomment if you want automatic pruning:
-- CREATE OR REPLACE FUNCTION prune_old_insights() RETURNS trigger AS $$
-- BEGIN
--   DELETE FROM market_insights WHERE created_at < NOW() - INTERVAL '30 days';
--   RETURN NULL;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER prune_insights_trigger
--   AFTER INSERT ON market_insights
--   EXECUTE FUNCTION prune_old_insights();

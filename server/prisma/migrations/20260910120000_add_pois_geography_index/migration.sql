-- Accessibility scoring asks "which POIs lie within 50 m of this route?" via
-- ST_DWithin with both sides cast to geography (metre distances). The existing
-- GIST index is on the raw `geometry` column, which that cast cannot use, so
-- every scored route fell back to a sequential scan of the POI table.
--
-- Invisible at five seeded routes; once the generated catalogue took the table
-- past a hundred it made a single Home-screen list response cost ~2.8 s
-- (one full scan per route). With this expression index the same response is
-- ~0.22 s.
CREATE INDEX IF NOT EXISTS idx_pois_geography ON pois USING GIST((geometry::geography));

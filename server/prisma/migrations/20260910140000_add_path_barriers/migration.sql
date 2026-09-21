-- Walking-surface data, kept separate from `pois`.
--
-- `pois` stores destinations as POINTs. A staircase or a cobblestone street is
-- not a destination and is not a point: it is a LINE the route either runs
-- along or does not. Collapsing it to a centroid (as osmSyncService did) makes
-- the only question that matters — "does this path cross steps?" — unanswerable,
-- and forces the scorer to fall back on proximity, which measures POI density
-- rather than accessibility.
--
-- Geometry is intentionally generic: steps and cobblestone arrive as LINESTRING,
-- kerbs and benches as POINT.
CREATE TABLE IF NOT EXISTS path_barriers (
  id             SERIAL PRIMARY KEY,
  osm_id         BIGINT,
  osm_type       TEXT NOT NULL,
  kind           TEXT NOT NULL,
  has_ramp       BOOLEAN NOT NULL DEFAULT FALSE,
  kerb_type      TEXT,
  surface        TEXT,
  tactile_paving BOOLEAN NOT NULL DEFAULT FALSE,
  step_count     INTEGER,
  updated_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

SELECT AddGeometryColumn('public', 'path_barriers', 'geometry', 4326, 'GEOMETRY', 2);

CREATE UNIQUE INDEX IF NOT EXISTS idx_path_barriers_osm ON path_barriers(osm_type, osm_id);
CREATE INDEX IF NOT EXISTS idx_path_barriers_kind ON path_barriers(kind);

-- The scorer asks "within N metres of this route" in metres, so the index has
-- to be on the geography cast — the same lesson as idx_pois_geography.
CREATE INDEX IF NOT EXISTS idx_path_barriers_geography ON path_barriers USING GIST((geometry::geography));

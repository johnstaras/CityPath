CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE routes ADD COLUMN geometry geometry(LineString, 4326);
ALTER TABLE pois ADD COLUMN geometry geometry(Point, 4326);

CREATE INDEX idx_routes_geometry ON routes USING GIST(geometry);
CREATE INDEX idx_pois_geometry ON pois USING GIST(geometry);

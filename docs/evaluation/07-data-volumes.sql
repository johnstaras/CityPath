-- 6. Data volumes (read-only).
-- Usage: docker exec -i citypaths-db psql -U citypaths -d citypaths < 07-data-volumes.sql
SELECT count(*) AS routes,
       count(*) FILTER (WHERE created_by = 'admin') AS admin,
       count(*) FILTER (WHERE created_by = 'ai') AS ai_curated,
       count(*) FILTER (WHERE generated_live) AS live_ai
FROM routes;
SELECT min(distance_meters), percentile_cont(0.5) WITHIN GROUP (ORDER BY distance_meters) AS median, max(distance_meters) FROM routes;
SELECT data_source, count(*) FROM pois GROUP BY 1 ORDER BY 2 DESC;
SELECT wheelchair, count(*) FROM pois GROUP BY 1 ORDER BY 2 DESC;
SELECT kind, count(*), count(*) FILTER (WHERE has_ramp) AS with_ramp FROM path_barriers GROUP BY 1 ORDER BY 2 DESC;
SELECT kerb_type, count(*) FROM path_barriers WHERE kind = 'kerb' GROUP BY 1 ORDER BY 2 DESC;
SELECT count(*) AS route_pois FROM route_pois;
SELECT min(c), percentile_cont(0.5) WITHIN GROUP (ORDER BY c) AS median, max(c), round(avg(c), 2) AS avg
FROM (SELECT route_id, count(*) AS c FROM route_pois GROUP BY 1) z;
SELECT id, name, avoid_stairs, avoid_cobblestone, requires_ramps, max_route_distance_km, rest_stop_interval_meters
FROM mobility_profiles ORDER BY id;
SELECT (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM route_sessions) AS sessions,
       (SELECT count(*) FROM favorites) AS favorites,
       (SELECT count(*) FROM poi_ratings) AS ratings;

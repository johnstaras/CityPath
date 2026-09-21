-- One rating per (user, POI). Re-rating a place updates the existing row
-- (poiRepository.addRating upserts on this key) instead of stacking a new one,
-- which previously let quick star taps inflate a POI's rating count.
--
-- Existing duplicates must go first or the unique index cannot be created.
-- Per (user_id, poi_id) the NEWEST row wins (created_at, then id). Quick taps
-- never carry a comment, so the newest row is often comment-less while an
-- older one holds the written review — carry the most recent non-empty
-- comment over before deleting the rest.

-- 1) Survivor inherits the most recent non-empty comment of its group.
WITH ranked AS (
  SELECT id, user_id, poi_id, comment,
         ROW_NUMBER() OVER (PARTITION BY user_id, poi_id ORDER BY created_at DESC, id DESC) AS rn
  FROM poi_ratings
),
latest_comment AS (
  SELECT DISTINCT ON (user_id, poi_id) user_id, poi_id, comment
  FROM ranked
  WHERE NULLIF(BTRIM(comment), '') IS NOT NULL
  ORDER BY user_id, poi_id, rn
)
UPDATE poi_ratings r
SET comment = lc.comment
FROM ranked k
JOIN latest_comment lc ON lc.user_id = k.user_id AND lc.poi_id = k.poi_id
WHERE r.id = k.id
  AND k.rn = 1
  AND NULLIF(BTRIM(r.comment), '') IS NULL;

-- 2) Drop every non-newest row.
DELETE FROM poi_ratings
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, poi_id ORDER BY created_at DESC, id DESC) AS rn
    FROM poi_ratings
  ) ranked
  WHERE rn > 1
);

-- 3) Enforce it from now on. Name matches Prisma's @@unique([userId, poiId]).
CREATE UNIQUE INDEX "poi_ratings_user_id_poi_id_key" ON "poi_ratings"("user_id", "poi_id");

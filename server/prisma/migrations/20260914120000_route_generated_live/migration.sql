-- Provenance marker for routes composed live by the LLM.
--
-- Both the curated 100-route catalogue (static data seeded by
-- scripts/seed-ai-routes.js, no model involved) and routes generated on request
-- by services/aiRouteService.js are stored with created_by = 'ai', so the two
-- were indistinguishable. Only the live pipeline sets this to TRUE; every
-- existing row is catalogue or admin content, hence the FALSE default.
-- The API exposes it as `isLiveAi`.
ALTER TABLE "routes" ADD COLUMN "generated_live" BOOLEAN NOT NULL DEFAULT false;

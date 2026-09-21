# CityPaths — Backend Setup

## Prerequisites

- **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop/)
- **Node.js** 22.12+ (Prisma 7 requires 20.19+ / 22.12+; the API container uses `node:22-alpine`). Needed on the host for `npx prisma …` and the data scripts — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)

## Quick Start (Docker — Recommended)

### Option A: Run everything in Docker

```bash
cd server
cp .env.example .env    # dev values work as-is (DB, JWT secret, Google client ID, public OSRM)
docker compose up -d    # Starts DB + API
npm install
npx prisma migrate dev  # Create schema
npx prisma db seed      # Seed data (needs internet: routes are snapped via public OSRM)
```

This starts:
- PostgreSQL 16 + PostGIS 3.4 on port 5432 (`citypaths-db`)
- Node.js API on port 3000 (`citypaths-api`, runs `npm run dev` = `nodemon -L`, with `server/` mounted)

The seed only creates the mobility profiles, 5 original routes and a handful of
places. Load the real data with `node scripts/syncOsmData.js`,
`node scripts/syncPathBarriers.js` and `node scripts/seed-ai-routes.js` — see
the root `README.md`.

### Option B: Run only DB in Docker, API locally

```bash
cd server
docker compose up -d db    # Only database
npm install                # Install Node.js deps
cp .env.example .env       # dev values work as-is
npx prisma migrate dev     # Run migrations
npx prisma db seed         # Seed data
npm run dev                # Start API with hot reload
```

## Database

Database credentials (for local development):
- Host: `localhost`
- Port: `5432`
- User: `citypaths`
- Password: `citypaths_dev`
- Database: `citypaths`

## Manual steps (Option B in detail)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

`.env.example` already contains the Docker database URL:
```
DATABASE_URL=postgresql://citypaths:citypaths_dev@localhost:5432/citypaths
```

Other variables: `PORT`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `OSRM_URL` (read in
one place, `config/osrmConfig.js`, by the detour client `utils/osrmClient.js`,
the seed snapper `scripts/snap-routes.js` and live AI generation; default when
unset: public FOSSGIS foot instance `https://routing.openstreetmap.de/routed-foot`;
8 s timeout per OSRM request),
and the optional AI route generation settings `AI_ROUTE_GENERATION` (default
`off` in code; a local `.env` may switch it `on`) and `AI_ROUTE_API_KEY` (a Groq
key), with optional `AI_ROUTE_MODEL` / `AI_ROUTE_BASE_URL` overrides — see comments in
`.env.example` and `config/aiConfig.js`.

### 3. Run database migrations

```bash
npx prisma migrate dev
```

### 4. Seed the database

```bash
npx prisma db seed
```

### 5. Start the server

```bash
npm run dev
```

Server runs on http://localhost:3000

### 6. Verify

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

## API

All routes are mounted under `/api` in `app.js`:
`/auth` (rate-limited), `/profile`, `/mobility-profiles`, `/pois`, `/routes`
(including `/routes/ai/status` and `/routes/ai/generate`), `/favorites`,
`/sessions`, plus `/health`.

Auth: Google ID token → JWT access token (7 days) + refresh token (30 days)
(`services/authService.js`).

- `POST /auth/google` `{ idToken }`: `400` without `idToken`; `401` only when
  Google rejects the token; `500` for any later failure (database, token issue).
- `POST /auth/refresh` `{ refreshToken }`: `200 { token, refreshToken }` and the
  old refresh token is deleted (rotation); `400` without `refreshToken`; `401`
  only when the token does not exist, has expired or was already rotated by a
  concurrent request; `500` for server errors. The mobile client signs the user
  out only on `400`/`401` from this endpoint — a network error, timeout or `5xx`
  keeps the session. Issuing a refresh token also deletes that user's expired ones.
- `POST /auth/logout` `{ refreshToken }` (no `authMiddleware`): the user is taken
  from a valid `Authorization: Bearer` token if present, otherwise from the owner
  of `refreshToken`, and ALL of that user's refresh tokens are revoked. Works with
  an expired access token. `400` when neither is given; an unknown refresh token
  still returns `200`. The access token itself stays valid until it expires.

`PUT /profile` `{ ageGroup?, mobilityProfileIds? }`: age group and mobility
selection are written in one transaction; any array (also `[]`) replaces the
selection. `400 { errors }` for invalid types or mobility profile ids that do
not exist.

`PUT /sessions/:id/pause` and `PUT /sessions/:id/resume` (auth): set the session
status to `paused` / `active` and return the session; `400` for a non-numeric id,
pausing a session that is not active, or resuming one that is not paused. The app
calls them on Pause/Resume.

Route JSON (`GET /routes`, `GET /routes/:id`, `GET /favorites`,
`GET /routes/:id/alternatives`) carries `isLiveAi`: `true` only for a route
composed live by the language model (column `routes.generated_live`, migration
`20260914120000_route_generated_live`). The curated catalogue is also
`createdBy: 'ai'` but has `isLiveAi: false`; detour alternatives are always
`false`. `accessibilityScore` is `null` when the scorer could not measure the
path (shown as unknown by the app).

`GET /routes/:id` also returns `pathAccessibility`, measured along the WHOLE
path from `path_barriers` (`utils/accessibilityScorer.js` `summarizePath`):
`{ measured, stepsMeters, rampedStepsMeters, cobblestonePercent, raisedKerbs,
loweredKerbs, lengthMeters }`, or `{ measured: false }`. `stepsMeters` counts
steps WITHOUT a ramp; the app shows "no steps on the route" only when it is 0.

`GET /routes/:id/alternatives`: `remaining_time` is the remaining WALKING time
in whole seconds (no stop visit time); `0` returns `200 []` without any DB/OSRM
work, missing/negative/non-numeric values return `400` (`utils/queryParsers.js`).
The detour budget compares plain walking time on both sides (no `speedFactor`).
Each alternative's `estimatedDurationMinutes` is the time to finish via that POI:
`distance / 1.2 m/s + 15 min` for the POI visit — the same model as a route's
`estimatedDurationMinutes` (`round(distance / 72) + 15 × stops`,
`scripts/snap-routes.js`). The app waits up to 30 s for this endpoint.

`POST /routes/ai/generate` `{ lat, lng, mobilityProfileId?, prompt? }` errors:
`400` for invalid `lat`/`lng`/`prompt`, and `INVALID_MOBILITY_PROFILE` 400 when
`mobilityProfileId` is not a positive integer or matches no profile (absent =
default profile); `NO_CANDIDATES` 404; `NO_SUITABLE_ROUTE` 422 (every attempt
was rejected by the distance or accessibility gate, or OSRM failed);
`INVALID_PROPOSAL` 502 (last attempt had fewer than 3 or more than 6 valid
unique stops); `PROVIDER_ERROR` 502 (the provider failed: 408/429/5xx, timeout
or empty reply on every attempt, or a non-retryable error such as a bad key;
30 s per call); `AI_DISABLED` 503. Anything else (e.g. a database error) is 500.
If the client disconnects before the answer, the server cancels the model call,
rolls the transaction back and sends nothing. The app waits up to 90 s.

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with hot reload (`nodemon -L`, polling) |
| `npm start` | Start server (production) |
| `docker compose up -d` | Start database + API |
| `docker compose up -d db` | Start database only |
| `docker compose down` | Stop containers |
| `docker compose down -v` | Stop containers and delete data |
| `npx prisma studio` | Open database GUI in browser |
| `npx prisma migrate dev` | Run pending migrations |
| `npx prisma db seed` | Seed database with initial data |
| `npx prisma generate` | Regenerate Prisma client |
| `npm test` | Unit tests (`node --test`, 62 tests in `test/`, no DB or network) |

`npm test` covers the pure decision rules: AI stop-count validation, route
category derivation, the accessibility gate on a failed score, provider-error
retry classification, `remaining_time` parsing, AI and auth controller status
codes, refresh/logout token handling, profile id validation, favorites scoring
and the detour duration/wheelchair constants (dependencies stubbed). `node scripts/verify-ai-pipeline.js`
checks the full AI pipeline (DB + OSRM) with a stubbed model.

Migrations with PostGIS columns: `prisma migrate dev` diffs `schema.prisma`
against the database and, because geometry columns live only in raw SQL, would
generate `DROP COLUMN geometry`. Write the migration SQL by hand (check it with
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`)
and apply it with `npx prisma migrate deploy`.

## Project Structure

```
server/
├── app.js                  Express app entry point
├── Dockerfile              API image (node:22-alpine)
├── docker-compose.yml      PostgreSQL + PostGIS container and API container
├── package.json
├── prisma.config.ts        Prisma 7 config (schema, migrations, seed command)
├── .env.example            Environment variables template
├── .env                    Local environment variables (git-ignored)
├── prisma/
│   ├── schema.prisma       Database schema
│   ├── seed.js             Seed data (mobility profiles, 5 routes, demo POIs; snaps routes via OSRM)
│   ├── data/               Curated Athens landmarks + 100-route catalogue (used by scripts/seed-ai-routes.js)
│   └── migrations/         Database migrations
├── controllers/            HTTP request handlers
├── services/               Business logic (incl. routingEngine, aiRouteService, OSM sync)
├── repositories/           Database queries
├── middleware/              Auth, error handling, validation
├── routes/                 Express route definitions
├── config/                 Prisma client (database.js), AI switch (aiConfig.js), OSRM URL/timeout (osrmConfig.js)
├── scripts/                Data sync, catalogue seeding, route snapping, GPX and AI check scripts
├── test/                   Unit tests for `npm test` (node:test)
└── utils/                  Helpers (OSRM client, Overpass client, accessibility scorer, AI route rules, query parsers)
```

## Troubleshooting

### Docker database won't start
- Make sure Docker Desktop is running
- Check if port 5432 is already in use: `docker ps` or `netstat -an | grep 5432`
- If another PostgreSQL is using the port, stop it or change the port in docker-compose.yml

### Prisma migration fails
- Make sure the database is running: `docker compose ps`
- Check DATABASE_URL in .env matches docker-compose credentials
- Try resetting: `npx prisma migrate reset` (WARNING: deletes all data)

### PostGIS extension not found
- The `postgis/postgis` Docker image includes PostGIS automatically
- If using a non-Docker PostgreSQL, install PostGIS manually: `CREATE EXTENSION postgis;`

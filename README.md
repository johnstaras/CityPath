# CityPath

Mobile app for personalized, accessible walking routes in Athens.

A route is not equally walkable for everyone. A single flight of steps or a high
kerb is enough to make a path impassable for a wheelchair user or a parent with
a pushchair. CityPath scores every path against the user's mobility profile,
measures the obstacles along the **whole** path from OpenStreetMap data, and
suggests detours during the walk that still fit the time left.

React Native (Android-first) + Node/Express + PostgreSQL/PostGIS, with
pedestrian routing via OSRM. Personalization and accessibility scoring are
profile-based and deterministic. A language model is used in one separate,
optional place — it *composes* routes (which places, in what order, the
wording) while OSRM builds the real path and the accessibility scorer checks it.
See [Route composition with a language model](#route-composition-with-a-language-model).

| Part | Stack | Where |
|------|-------|-------|
| Mobile app | React Native 0.84.1, TypeScript, MVVM, TanStack Query, MapLibre React Native | `mobile/` |
| API | Node.js + Express, 3-layer (controller → service → repository), Prisma + raw PostGIS SQL | `server/` |
| Database | PostgreSQL 16 + PostGIS 3.4 (Docker) | `server/docker-compose.yml` |
| Routing | OSRM foot profile, public FOSSGIS instance by default | `OSRM_URL`, read only in `server/config/osrmConfig.js` |
| Technical docs | Use cases, suggestion engine, map & navigation | `docs/analysis/` |

---

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| [Git](https://git-scm.com/) | any recent | |
| [Node.js](https://nodejs.org/) | 22.12+ | mobile `engines` needs ≥ 22.11; Prisma 7 needs 20.19+ / 22.12+ |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent | PostgreSQL + PostGIS, and optionally the API |
| [JDK](https://adoptium.net/) | 17 | required by React Native 0.84 / Gradle |
| [Android Studio](https://developer.android.com/studio) | latest | SDK + emulator |

In Android Studio's SDK Manager install **Android SDK Platform 36**,
**Build-Tools**, **NDK 27.1.12297006**, **CMake** and platform tools, then set
`ANDROID_HOME` and put `platform-tools` on your `PATH`.

Create an emulator (Device Manager) with a **Google Play** system image — the
app uses Play-Services location, and plain AOSP images do not deliver GPS to
it. Give it **16 GB internal storage**; the default 6 GB fills up after a few
reinstalls and installs start failing.

An internet connection is needed for the first build, for the OpenStreetMap
data import and for routing.

---

## 1. Google sign-in and Firebase (do this first)

The app signs users in with Google, so it needs a Firebase project of your own.
No credentials are included in this repository.

1. Create a project at the [Firebase console](https://console.firebase.google.com/).
2. Add an **Android** app with package name **`com.app.citypath`**.
3. Add the SHA-1 of your debug keystore, so Google sign-in works on the
   emulator. Android Studio creates the keystore on first build; read the SHA-1
   with:

   ```powershell
   keytool -list -v -alias androiddebugkey -keystore $env:USERPROFILE\.android\debug.keystore -storepass android -keypass android
   ```

4. Download `google-services.json` and put a copy in **both** places:

   ```
   mobile/google-services.json
   mobile/android/app/google-services.json
   ```

   `mobile/google-services.json.example` shows the expected shape. Both files
   are git-ignored on purpose.

5. From **Project settings → General → Your apps → Web client**, copy the
   **Web client ID**. It goes into two environment files in the next step —
   the mobile app uses it to request an ID token, and the server uses it to
   verify that token.

---

## 2. Backend

```powershell
git clone https://github.com/johnstaras/CityPath.git
cd CityPath\server

copy .env.example .env
```

Open `server/.env` and set `GOOGLE_CLIENT_ID` to your Web client ID. The
database URL, port and the development JWT secret work as they are — replace
the secret before deploying anywhere real.

```powershell
docker compose up -d          # PostGIS on :5432 and the API on :3000
npm install
npx prisma generate           # build the Prisma client from the schema
npx prisma migrate deploy     # create the schema
npx prisma db seed            # mobility profiles, 5 starter routes, a few places
```

`prisma generate` is easy to skip and nothing obvious breaks until something
imports the client — `npm test` fails with `Cannot find module
'.prisma/client/default'`. Run it once after `npm install` and after any change
to `prisma/schema.prisma`.

Check it:

```powershell
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

### Load the real data

`db seed` only creates the five starter routes and a handful of places. The
rest comes from three scripts, in this order, run from `server/` (all need
internet):

```powershell
node scripts/syncOsmData.js        # ~7,800 Athens places from OpenStreetMap, via Overpass
node scripts/syncPathBarriers.js   # ~5,900 steps, kerbs, cobblestone and benches
node scripts/seed-ai-routes.js     # the 100-route Athens catalogue, snapped to real streets via OSRM
```

**Do not skip `syncPathBarriers`.** Without it the scorer finds no steps,
cobblestone or kerbs, so routes score far higher than they should, and profiles
that need rest stops lose points because no benches exist. Without
`seed-ai-routes` the "Curated routes" strip on the home screen is empty.

After all three the database holds 105 routes: the 100-route catalogue plus the
5 starter ones.

> The API container mounts `server/`, so code edits hot-reload through
> `nodemon -L` (polling — plain nodemon cannot see Windows bind-mount events).
> If the API seems to run stale code, `docker restart citypaths-api`.

Prefer to run only the database in Docker? `docker compose up -d db`, then
`npm run dev` in `server/`.

---

## 3. Mobile app

```powershell
cd CityPath\mobile
copy .env.example .env
npm install
```

Open `mobile/.env` and set `GOOGLE_WEB_CLIENT_ID` to the same Web client ID.
`API_URL` is already `http://10.0.2.2:3000/api`, which is how the Android
emulator reaches the host. For a physical device on the same network, use
`http://<your LAN IP>:3000/api`.

`.env` is read by `react-native-config` at **build time** — changing it needs a
rebuild, not a Metro reload.

```powershell
npx react-native start               # Metro, keep it running in its own terminal
```

In a second terminal, with the emulator booted:

```powershell
cd CityPath\mobile\android
.\gradlew.bat app:installDebug
```

Then launch **CityPath** from the emulator's app drawer. The first build
downloads Gradle and its dependencies — expect 10–20 minutes.

(`npx react-native run-android` also works but sometimes stalls on an
interactive port prompt; `gradlew app:installDebug` is the reliable path.)

---

## Day-to-day commands

| What | Where | Command |
|------|-------|---------|
| Start database + API | `server/` | `docker compose up -d` |
| API logs | anywhere | `docker logs citypaths-api -f` |
| Reset and reseed the database | `server/` | `npx prisma migrate reset` (destroys data) |
| Database GUI | `server/` | `npx prisma studio` |
| Server tests | `server/` | `npm test` — 62 unit tests, `node --test`, no database or network |
| Metro | `mobile/` | `npx react-native start` |
| Install on the emulator | `mobile/android/` | `.\gradlew.bat app:installDebug` |
| Type-check the app | `mobile/` | `npx tsc --noEmit` |
| Lint | `mobile/` | `npm run lint` |
| Mobile tests | `mobile/` | `npx jest` (`App.test.tsx` fails to load — pre-existing, AsyncStorage is not mocked) |
| Re-snap route geometry | `server/` | `node scripts/snap-routes.js` (runs inside the seed) |
| Check the composition pipeline without a key | `server/` | `node scripts/verify-ai-pipeline.js` (stubbed model, leaves the database unchanged) |
| Walk a route from the terminal | repo root | `node tools/simulate-walk.js <routeId> [stepSeconds]` (start the route in the app first) |
| Replay a GPX track | repo root | `node tools/play-gpx.js tools/gpx/<file>.gpx [speed]` |
| Release APK | `mobile/android/` | `.\gradlew.bat app:assembleRelease` → `app/build/outputs/apk/release/app-release.apk` |

---

## Testing GPS features on the emulator

Recorded tracks of the seeded routes live in `tools/gpx/` (walking pace, with
30 s pauses at each stop) and `tools/gpx/fast/` (5× speed, for demos only).

Emulator → **⋯ Extended Controls → Location → Routes → Import GPX/KML** → pick
a track → **Play route**. The app receives it as real GPS: the marker moves,
the camera follows, progress accumulates, checkpoint suggestions fire at 25, 50
and 75 %, and the route completes on arrival within 40 m of the end.

A single position: `adb emu geo fix 23.7348 37.9755` — **longitude first**.

**Play the demo tracks at 1× only.** The app measures walking pace on the wall
clock, so emulator speed multipliers (and the `fast/` tracks) inflate the
measured speed, collapse the remaining-time budget, and the engine then returns
no detour suggestions.

`tools/gpx/demo-route-<id>-checkpoint-suggestion.gpx` demonstrates the 25 %
checkpoint: the track walks at natural pace, stands still at the 25 % mark
while the suggestion sheet appears — tap the first suggestion there — then
walks that detour's real geometry to the end. Which suggestion comes first is
personalised and changes with your history, so it will not always match a
previous run; tap whichever you get.

---

## Route composition with a language model

Design, measurements and limitations (in Greek):
`docs/analysis/07-ai-route-generation.md`.

**The model decides:** which places, in what order, and the title and
description. **It never decides:** the walking path, distances, times, or
anything about accessibility.

There are two modes.

**The catalogue — 100 Athens routes.** The stop lists, titles and descriptions
are static, curated data in `server/prisma/data/athens-routes.js`.
`scripts/seed-ai-routes.js` makes no model call at all: it snaps each stop list
through OSRM and stores the result. No key, no cost. These appear in the
**Curated routes** strip on the home screen and carry no badge.

**Live generation — "Create a route with AI"**, off by default:

1. The app asks the user to confirm, because the next step calls an external
   provider and saves a new route, then sends the GPS position and the mobility
   profile.
2. The server gathers up to 40 places within 1.2 km that suit the profile.
3. The model picks and orders 3–6 of them. Unknown and duplicate ids are
   dropped; anything outside 3–6 valid stops is rejected. The route category is
   derived by the server from the stops, by majority.
4. OSRM builds the real walking path, with distance, duration and per-stop
   arrival times.
5. The accessibility scorer checks it. A score of 0, a score that could not be
   measured, or more than 7 km means rejection. There is one retry, with the
   reason sent back to the model.
6. The route, its stops and geometry are written in a single database
   transaction, so a rejected attempt leaves nothing behind.

The provider is [Groq](https://console.groq.com), through its OpenAI-compatible
endpoint — its free tier covers this use and it answers in about two seconds.
To switch it on, add to `server/.env`:

```env
AI_ROUTE_GENERATION=on
AI_ROUTE_API_KEY=gsk_...
```

then `docker restart citypaths-api` and check
`curl http://localhost:3000/api/routes/ai/status`. These variables are not in
`docker-compose.yml`: the API reads them from the mounted `server/.env`, and
nodemon does not reload on `.env` changes, so it needs a restart.

Only routes composed live carry the **AI** badge in the app (`generated_live`
in the database, `isLiveAi` in the API). The curated catalogue never does.

**Current limitations.** Live generation uses the device position, but when
location is denied or GPS fails the app falls back to Syntagma Square. Only
Athens places are in the database, so generation elsewhere fails with "not
enough places near you". The catalogue strip is listed in database order, not
by distance from the user.

---

## Architecture

### Mobile — MVVM

```
View (screen) ←→ ViewModel (custom hook) ←→ Model (service + types)
```

- **Views** render and call ViewModel actions. No business logic, no axios, no
  data layer.
- **ViewModels** are custom hooks named `useXxxViewModel`. They use TanStack
  Query for server data, hold local UI state, and return a flat object — data,
  `isLoading`, `error`, and the actions. They import no React Native
  components.
- **Services** are plain API calls over the shared axios instance in
  `services/api.ts`, one per domain. They return raw data and hold no state.
- **Models** are TypeScript interfaces only.

Imports are relative, at most `../../` deep; no path aliases are configured.
Text always comes from `src/components/AppText`, never from `react-native` —
Android's default line breaking hides the last word of nearly-full lines, and
an ESLint rule enforces this.

### Server — three layers

```
HTTP request → controller → service → repository → PostgreSQL
```

Controllers handle HTTP only, services hold the business rules, repositories
hold database queries. The Prisma client is always imported from
`config/database.js`. Spatial queries use `prisma.$queryRawUnsafe()` with
parameter placeholders, because Prisma has no schema types for PostGIS
geometry.

Migrations that touch PostGIS columns need care: `prisma migrate dev` diffs the
schema against the database and, since geometry columns exist only in raw SQL,
would generate `DROP COLUMN geometry`. Write that migration SQL by hand and
apply it with `npx prisma migrate deploy`.

### Design system

Colours live in `LIGHT_COLORS` / `DARK_COLORS` in
`mobile/src/utils/constants.ts` and reach components through
`useTheme().colors`. Dark is the primary theme. Corner radius: 12 for inputs,
16 for cards, 24 for sheets, full pill for buttons. Touch targets are at least
44×44 pt, screen padding 16, body line height 1.5. Headings use Space Grotesk;
body text uses the system font.

Accessibility badges always combine **colour, text and icon** — never colour
alone. `__tests__/contrast.test.ts` checks the body-text and badge colour pairs
for a 4.5:1 contrast ratio in both themes.

### Key design decisions

- **Detour suggestions are not machine-learned.** They are ranked by a
  deterministic, explainable multi-criteria formula in
  `services/routingEngine.js`. Identical inputs give identical results, and
  every score is returned broken down into its four terms.
- **Accessibility is measured along the whole path**, not around the stops. Any
  unramped steps on the path mean a score of 0 for profiles that avoid stairs.
- **Mobility profiles live in the database**, not in code, so a new profile
  needs no code change.
- **OSRM is read from one place only**, `server/config/osrmConfig.js`, so
  switching from the public instance to a self-hosted one is a configuration
  change.
- **Offline use is out of scope.** The path and the accessibility score are
  always computed on the server, so the same route always scores the same on
  every screen.

---

## Documentation

| Document | Content |
|----------|---------|
| `docs/analysis/03-use-cases.md` | Use cases UC-01…UC-12 |
| `docs/analysis/06-suggestion-engine.md` | Detour ranking formula and measurements |
| `docs/analysis/07-ai-route-generation.md` | Route composition: design, cost, limitations |
| `docs/analysis/08-map-navigation-ui.md` | Map and navigation UI, MapLibre workarounds |
| `docs/analysis/01-related-apps.md` · `02-comparison-table.md` | Comparison with existing apps |
| `docs/analysis/photo-credits.md` | Photo sources and licences |
| `server/README.md` | API endpoints, error codes, database details |
| `mobile/README.md` | App structure, scripts, conventions |

The analysis documents are written in Greek.

---

## Gotchas

- **`mobile/.env` is baked in at build time.** Changing `API_URL` needs a
  rebuild and reinstall, not a Metro reload. On the emulator prefer `10.0.2.2`
  over your LAN IP, which changes with DHCP.
- **Release APK on a phone:** the phone must reach the PC on port 3000. If the
  app shows a loading error, allow it through the firewall (admin PowerShell):
  `New-NetFirewallRule -DisplayName "CityPath API" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private`.
- **Emulator storage:** `INSTALL_FAILED_INSUFFICIENT_STORAGE` → `adb uninstall
  com.app.citypath` first (this wipes the login), or enlarge the AVD.
- **Docker and nodemon:** environment changes in `docker-compose.yml` need
  `docker compose up -d` to recreate the container, not a restart.
- **The LogBox toast eats taps.** In development builds the yellow "Open
  debugger…" toast at the bottom silently swallows touches on buttons above it.
  Dismiss it if a button seems dead.
- **Metro serving corrupted bundles:** a random `Compiling JS failed` at a
  different line on each reload means Metro's cache is broken — kill it and
  start it again.
- **Public OSRM dependency:** route snapping, live composition and checkpoint
  suggestions all call `routing.openstreetmap.de` by default. They need
  internet and degrade to empty suggestions without it. The public instance
  also rate-limits the distance-table service to roughly one request per 10 s
  per address, which shows up as slow detour suggestions.
- **MapLibre v11 alpha fails silently** in several ways, listed in full in
  `docs/analysis/08-map-navigation-ui.md`: only one GeoJSON line source paints,
  layers with a `filter` never paint, symbol `text-field` never paints, and the
  user-location marker must stay `animated={false}` or it crashes on RN 0.84.
- **Location fallback:** with no GPS fix the home screen silently uses Syntagma
  Square. Set a position with `adb emu geo fix` before testing anything "near
  you".

---

## Licence

[MIT](LICENSE).

Map data © OpenStreetMap contributors, under the
[ODbL](https://www.openstreetmap.org/copyright). Place photographs come from
Wikimedia Commons and Unsplash — per-photo credits are in
`docs/analysis/photo-credits.md`.

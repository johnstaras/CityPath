# Evaluation scripts

Every number reported in the project's evaluation comes from one of these
scripts. They are read-only: they call the running API, query the database or
parse the app's own source, and they never write to it.

Run them from this folder unless a script says otherwise. Output goes to
`$OUT` (default: a `citypaths-eval` folder in the system temp directory).

| Script | Measures | Needs |
|--------|----------|-------|
| `01-latency.js` | Response time of the local endpoints, 5 warm-up + 30 timed requests each | server, `TOKEN` |
| `02-alternatives.js` | Detour suggestions at a checkpoint: time, count, rejections (calls the public OSRM, so 20 requests spaced ≥ 3 s) | server, `TOKEN` |
| `03-scorer-consistency.js` | Accessibility score and path labels for every route × every mobility profile, list against details | server |
| `04-walk-sim.js` | Walk simulation over every catalogue route against the app's own progress code, with and without GPS noise | server |
| `05-contrast.js` | Contrast ratio of every text/background colour pair of the design system, both themes | — |
| `06-touch-targets.js` | Declared touch-target sizes of the interactive elements in `mobile/src` | — |
| `07-data-volumes.sql` | Row counts: routes, stops, points of interest, path obstacles | database |
| `08-code-size.sh` | Files and lines per folder, git-tracked only | git |
| `09-tests.sh` | The automated checks: jest, tsc, ESLint, server unit tests | both apps installed |

`TOKEN` is a JWT of a signed-in user — sign in on the app and copy it from the
request headers, or issue one against your own database. `API_BASE` overrides
the API address (default `http://localhost:3000/api`).

```sh
OUT=./out TOKEN=<jwt> node 01-latency.js
docker exec -i citypaths-db psql -U citypaths -d citypaths < 07-data-volumes.sql
sh 09-tests.sh            # from the repository root
```

Timings depend on the machine, and anything that goes through the public OSRM
instance also depends on its load and on its rate limit for the `/table`
service. The counts are reproducible.

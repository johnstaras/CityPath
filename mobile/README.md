# CityPaths — Mobile App

React Native 0.84.1 app (TypeScript, MVVM, TanStack Query, MapLibre React
Native v11 alpha) for accessible walking routes in Athens. Android is the
developed and tested platform (package `com.app.citypath`); an `ios/` project
exists but is not part of the documented workflow.

The New Architecture is always on (mandatory since RN 0.82). The
`newArchEnabled=false` line still in `android/gradle.properties` is ignored —
the Gradle plugin only prints a warning.

Full machine setup (JDK 17, Android SDK 36, NDK 27.1.12297006, emulator with a
Google Play image, backend + data) and the architecture rules and design tokens
are in the root [`README.md`](../README.md).

## Setup

Requires Node.js ≥ 22.11 (`engines` in `package.json`) and the backend running
(`server/`, port 3000).

```powershell
cd mobile
copy .env.example .env      # API_URL=http://10.0.2.2:3000/api reaches the host from the emulator
npm install
```

`.env` is read by `react-native-config` at **build time**: changing `API_URL`
or `GOOGLE_WEB_CLIENT_ID` needs a rebuild, not a Metro reload.

## Run

```powershell
npx react-native start               # Metro (npm start), keep it running
cd android
.\gradlew.bat app:installDebug       # build + install on the booted emulator
```

`npm run android` (`react-native run-android`) also works but can stall on an
interactive port prompt.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Metro bundler |
| `npm run android` | Build and run on Android |
| `npm run ios` | Build and run on iOS (not maintained) |
| `npm test` / `npx jest` | Jest: 15 suites / 115 tests in `__tests__/`; 14 suites pass, `App.test.tsx` fails to load (pre-existing — AsyncStorage is not mocked) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `.\gradlew.bat app:assembleRelease` (in `android/`) | Release APK → `android/app/build/outputs/apk/release/app-release.apk` |

## Structure

```
mobile/
├── App.tsx               Providers (TanStack Query, SafeArea, Theme, Dialog, Auth) + navigator
├── __tests__/            Jest tests
├── assets/fonts/         Space Grotesk (headings)
├── android/  ios/        Native projects
└── src/
    ├── models/           TypeScript interfaces
    ├── services/         API calls (axios instance in api.ts with JWT refresh), Firebase
    ├── viewmodels/       Custom hooks (useXxxViewModel)
    ├── views/            Screens: auth, onboarding, home, favorites, profile, shared
    ├── components/       Reusable UI components (MapView, RouteCard, AiRoutesSection = the "Curated routes" strip, …)
    ├── navigation/       React Navigation stacks and tabs
    ├── context/          AuthContext, ThemeContext, DialogContext
    ├── i18n/             i18next with en.json / el.json
    ├── types/            Global type declarations
    └── utils/            Design tokens (constants.ts), formatters, geometry, progress, permissions
```

Imports are relative (no `@/` path aliases are configured).

## Conventions worth knowing

- **AI badge:** only `route.isLiveAi === true` (a route composed live by the
  language model) shows the «AI» badge (`RouteCard.tsx`, `AiRoutesSection.tsx`).
  `createdBy === 'ai'` also covers the curated catalogue, which no model wrote.
- **Screens call no services:** Home favourites go through
  `viewmodels/useHomeFavoritesViewModel.ts`, which shares the Favorites tab's
  cache entry `['favorites', profileId]`.
- **Profile stats** (`['profileStats']`) are invalidated after route completion,
  POI rating and every favourite add/remove.
- **401 handling** (`services/api.ts`): a 401 from `/auth/google`,
  `/auth/refresh` or `/auth/logout`, or any 401 with no refresh token stored,
  rejects with the original error instead of trying a refresh.

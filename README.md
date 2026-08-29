# @metasyncsite/translations-client-ts

TypeScript client for pushing and pulling i18n translations to/from the Translation Manager. Works with any Node.js project: Vue, React, Next.js, Nuxt, etc.

Translations themselves are edited in the Translation Manager UI — **[translation.metasync.site](https://translation.metasync.site/)**. Translators work there, this package moves the result in and out of your `locales/` directory. No hosting required to try it.

---

## Requirements

- Node.js >= 18
- TypeScript >= 5.0 (dev dependency)

---

## Installation

```bash
npm install @metasyncsite/translations-client-ts
# or
pnpm add @metasyncsite/translations-client-ts
# or
yarn add @metasyncsite/translations-client-ts
```

---

## Local Installation (without npm registry)

For working against an unreleased build — a fix you are testing, or a fork — there are
three options:

### Option 1 — file path in package.json (recommended)

Build the package first, then reference it by path in your project's `package.json`:

```json
{
  "dependencies": {
    "@metasyncsite/translations-client-ts": "file:../path/to/translations-client-node-ts"
  }
}
```

Then run:

```bash
npm install
# or
pnpm install
```

> The path must point to the package root (where `package.json` lives). Use a relative or absolute path.

---

### Option 2 — npm pack (portable tarball)

Build and pack the package into a `.tgz` file, then install that file in any project:

```bash
# Inside the package directory
cd packages/translations-client-node-ts
npm run build
npm pack
# → creates metasyncsite-translations-client-ts-1.0.0.tgz
```

Then install the tarball in your project:

```bash
npm install /path/to/metasyncsite-translations-client-ts-1.0.0.tgz
# or
pnpm add /path/to/metasyncsite-translations-client-ts-1.0.0.tgz
```

> Good when you want to share the package without a registry — just copy the `.tgz` file.

---

### Option 3 — npm link (symlink, for active development)

Use this when you're actively editing the package and want changes to reflect immediately:

```bash
# 1. Inside the package directory — register a global symlink
cd packages/translations-client-node-ts
npm run build
npm link

# 2. Inside your consuming project — link to it
cd /path/to/your-project
npm link @metasyncsite/translations-client-ts
```

To unlink when done:

```bash
# Inside your project
npm unlink @metasyncsite/translations-client-ts

# Inside the package directory
npm unlink
```

> With `npm link`, you must re-run `npm run build` (or `npm run dev` for watch mode) after each source change.

---

## Build (if working from source)

```bash
cd packages/translations-client-node-ts
npm install
npm run build   # compiles src/ → dist/
```

---

## Configuration

The client reads credentials from environment variables or CLI flags.

### Environment variables

Add to your project's `.env`:

```env
TRANSLATIONS_URL=https://translations.example.com
TRANSLATIONS_TOKEN=your-api-token
TRANSLATIONS_LOCALES_PATH=src/locales   # optional, default: src/locales
```

---

## CLI Usage

After installing the package, two CLI commands are available:

### Push (upload local translations → Translation Manager)

```bash
npx translations-push
```

With explicit flags:

```bash
npx translations-push \
  --url https://translations.example.com \
  --token your-api-token \
  --path src/locales \
  --locale en \          # push only this locale (optional)
  --overwrite true \     # overwrite existing keys (default: true)
  --dry-run \            # preview without sending
  --exclude i18n.json,test.json  # comma-separated files to skip
```

### Pull (download translations from Translation Manager → local files)

```bash
npx translations-pull
```

With explicit flags:

```bash
npx translations-pull \
  --url https://translations.example.com \
  --token your-api-token \
  --path src/locales \
  --locale de \          # pull only this locale (optional)
  --layout grouped \     # force layout: flat | grouped (optional, auto-detected)
  --dry-run              # preview without writing files
```

### Add to package.json scripts

```json
{
  "scripts": {
    "translations:push": "translations-push",
    "translations:pull": "translations-pull"
  }
}
```

---

## Exit codes

Both commands are meant to run in CI and deploy steps, so they only exit `0` when the
work they were asked to do actually happened:

| Situation | Exit code |
|---|---|
| Everything pushed / pulled | `0` |
| A locale failed to fetch, write or upload | `1`, and the locale is named |
| `--locale=xx` names a locale that does not exist | `1` |
| Push finds no locale files at `--path` | `1` |
| Credentials missing | `1` |

A locale that fails does not abort the run — the remaining locales are still processed,
and the failures are listed together at the end.

---

## Write safety

Pull writes each file to a temporary name and renames it into place. `rename()` within a
directory is atomic, so an interrupted pull leaves the previous file intact instead of a
truncated one that no longer parses.

Locale codes and group names arrive in the API response and become path segments, so they
are validated before use: anything containing a path separator, or equal to `.` or `..`,
is refused rather than written outside your locales directory.

---

## Testing

```bash
npm test   # builds, then runs node --test
```

---

## Locale Layouts

The client auto-detects which layout your project uses:

| Layout | Structure | Example |
|--------|-----------|---------|
| `flat` | One JSON file per locale | `locales/en.json`, `locales/de.json` |
| `grouped` | One subdirectory per locale | `locales/en/auth.json`, `locales/de/auth.json` |

---

## Programmatic API

Import and use the client functions directly in TypeScript:

```ts
import {
  readLocales,
  detectLayout,
  pushLocale,
  writeGroupedLocale,
  writeFlatLocale,
} from '@metasyncsite/translations-client-ts'

import type {
  LocaleData,
  LocaleGroups,
  PushLocaleParams,
  PushResult,
} from '@metasyncsite/translations-client-ts'

// Read all locales from disk
const locales: LocaleData[] = readLocales('./src/locales')

// Push a single locale
const result: PushResult = await pushLocale({
  url: 'https://translations.example.com',
  token: 'your-api-token',
  locale: 'en',
  groups: locales[0].groups,
  overwrite: true,
})

console.log(`${result.new} new, ${result.updated} updated, ${result.total} total`)

// Detect layout
const layout = detectLayout('./src/locales')  // 'flat' | 'grouped' | null

// Write pulled translations to disk
const groups: LocaleGroups = { auth: { 'login': 'Login', 'logout': 'Logout' } }
writeGroupedLocale('./src/locales', 'en', groups)
```

---

## API Reference

### `readLocales(localesPath, excludeFiles?)`

Auto-detects layout and reads all locale files.

| Param | Type | Description |
|-------|------|-------------|
| `localesPath` | `string` | Absolute or relative path to locales directory |
| `excludeFiles` | `string[]` | Filenames to skip (e.g. `['index.json']`) |

Returns: `LocaleData[]`

---

### `detectLayout(localesPath)`

Returns `'flat'`, `'grouped'`, or `null` if the directory doesn't exist or is empty.

---

### `pushLocale(params)`

Pushes one locale's groups to the Translation Manager API.

| Param | Type | Default |
|-------|------|---------|
| `url` | `string` | — |
| `token` | `string` | — |
| `locale` | `string` | — |
| `groups` | `LocaleGroups` | — |
| `overwrite` | `boolean` | `true` |

Returns: `Promise<PushResult>`

---

### `writeGroupedLocale(localesPath, locale, groups)`

Writes translations in grouped layout (`locales/{locale}/{group}.json`).  
The special `_json` group is written as `locales/{locale}.json`.

Returns: `string[]` — paths of written files.

---

### `writeFlatLocale(localesPath, locale, groups)`

Merges all groups and writes `locales/{locale}.json`.

Returns: `string[]` — paths of written files.

---

### `assertSafeSegment(segment, kind)`

Throws if `segment` cannot be used as a single path segment — empty, `.`, `..`, or
containing `/`, `\\` or a null byte. Returns the segment unchanged otherwise. Used
internally on locale codes and group names before they reach the filesystem.

---

### `unflatten(flat)`

Converts dot-notation keys back to a nested object.

```ts
unflatten({ 'auth.login': 'Login' })
// → { auth: { login: 'Login' } }
```

---

## Types

All exported types are available from the main entry point:

```ts
import type {
  FlatKeys,        // Record<string, string>
  LocaleGroups,    // Record<string, FlatKeys>
  LocaleLayout,    // 'flat' | 'grouped'
  LocaleData,      // { locale: string, groups: LocaleGroups }
  PushLocaleParams,
  PushResult,      // { new: number, updated: number, total: number }
  PullOptions,
  PushOptions,
} from '@metasyncsite/translations-client-ts'
```

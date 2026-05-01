import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import type { FlatKeys, LocaleData, LocaleGroups, LocaleLayout } from './types.js'

/**
 * Flatten a nested object into dot-notation keys.
 * { auth: { login: 'Login' } } → { 'auth.login': 'Login' }
 */
function flatten(obj: Record<string, unknown>, prefix = ''): FlatKeys {
  const result: FlatKeys = {}

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = String(value ?? '')
    }
  }

  return result
}

/**
 * Read and parse a JSON file. Returns an empty object on failure.
 */
function readJson(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Detect which locale layout the locales directory uses.
 *
 * Layout `flat`    — one file per locale: locales/en.json, locales/de.json
 * Layout `grouped` — one subdirectory per locale: locales/en/auth.json, locales/de/auth.json
 */
export function detectLayout(localesPath: string): LocaleLayout | null {
  if (!existsSync(localesPath)) {
    return null
  }

  const entries = readdirSync(localesPath, { withFileTypes: true })

  const hasJsonFiles = entries.some((e: import('node:fs').Dirent) => e.isFile() && e.name.endsWith('.json'))
  const hasDirs = entries.some((e: import('node:fs').Dirent) => e.isDirectory())

  if (hasDirs) {
    return 'grouped'
  }

  if (hasJsonFiles) {
    return 'flat'
  }

  return null
}

/**
 * Read translations in flat layout (one JSON per locale).
 * All keys are placed in the `_json` group to match Laravel's JSON translation convention.
 */
export function readFlatLayout(localesPath: string, excludeFiles: string[] = []): LocaleData[] {
  const entries = readdirSync(localesPath, { withFileTypes: true })
  const result: LocaleData[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }

    if (excludeFiles.includes(entry.name)) {
      continue
    }

    const locale = basename(entry.name, '.json')
    const filePath = join(localesPath, entry.name)
    const parsed = readJson(filePath)

    result.push({
      locale,
      groups: { _json: flatten(parsed) },
    })
  }

  return result
}

/**
 * Read translations in grouped layout (subdirectory per locale, multiple group files).
 */
export function readGroupedLayout(localesPath: string, excludeFiles: string[] = []): LocaleData[] {
  const entries = readdirSync(localesPath, { withFileTypes: true })
  const result: LocaleData[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const locale = entry.name
    const localePath = join(localesPath, locale)
    const groups: LocaleGroups = {}

    for (const file of readdirSync(localePath)) {
      if (extname(file) !== '.json') {
        continue
      }

      if (excludeFiles.includes(file)) {
        continue
      }

      const groupName = basename(file, '.json')
      const parsed = readJson(join(localePath, file))
      groups[groupName] = flatten(parsed)
    }

    if (Object.keys(groups).length > 0) {
      result.push({ locale, groups })
    }
  }

  return result
}

/**
 * Auto-detect layout and read all locales from the given path.
 */
export function readLocales(localesPath: string, excludeFiles: string[] = []): LocaleData[] {
  const layout = detectLayout(localesPath)

  if (!layout) {
    return []
  }

  return layout === 'grouped'
    ? readGroupedLayout(localesPath, excludeFiles)
    : readFlatLayout(localesPath, excludeFiles)
}
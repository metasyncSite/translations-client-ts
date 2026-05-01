import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { FlatKeys, LocaleGroups } from './types.js'

/**
 * Restore dot-notation flat keys back to a nested object.
 * { 'auth.login': 'Login' } → { auth: { login: 'Login' } }
 */
export function unflatten(flat: FlatKeys): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [dotKey, value] of Object.entries(flat)) {
    const parts = dotKey.split('.')
    let cursor = result

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!

      if (typeof cursor[part] !== 'object' || cursor[part] === null) {
        cursor[part] = {}
      }

      cursor = cursor[part] as Record<string, unknown>
    }

    cursor[parts[parts.length - 1]!] = value
  }

  return result
}

/**
 * Write a JSON file, creating parent directories as needed.
 */
function writeJson(filePath: string, data: Record<string, unknown>): void {
  const dir = dirname(filePath)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

/**
 * Write translations for a single locale in grouped layout.
 *
 * Each group becomes its own file: locales/{locale}/{group}.json
 * The special `_json` group is written as locales/{locale}.json (root-level).
 */
export function writeGroupedLocale(
  localesPath: string,
  locale: string,
  groups: LocaleGroups,
): string[] {
  const written: string[] = []

  for (const [groupName, flatKeys] of Object.entries(groups)) {
    const nested = unflatten(flatKeys)

    if (groupName === '_json') {
      const filePath = join(localesPath, `${locale}.json`)
      writeJson(filePath, nested)
      written.push(filePath)
    } else {
      const filePath = join(localesPath, locale, `${groupName}.json`)
      writeJson(filePath, nested)
      written.push(filePath)
    }
  }

  return written
}

/**
 * Write translations for a single locale in flat layout.
 *
 * All groups are merged into a single locales/{locale}.json file.
 */
export function writeFlatLocale(
  localesPath: string,
  locale: string,
  groups: LocaleGroups,
): string[] {
  const merged: FlatKeys = {}

  for (const flatKeys of Object.values(groups)) {
    Object.assign(merged, flatKeys)
  }

  const nested = unflatten(merged)
  const filePath = join(localesPath, `${locale}.json`)
  writeJson(filePath, nested)

  return [filePath]
}
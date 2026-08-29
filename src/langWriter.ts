import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
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
 * Reject a locale code or group name that would escape the locales directory.
 *
 * Both values come straight from the API response and are used to build a file path,
 * so a name like `../../package` would write outside the folder the caller chose.
 */
export function assertSafeSegment(segment: string, kind: string): string {
  if (segment === '' || segment === '.' || segment === '..') {
    return failSegment(segment, kind)
  }

  if (segment.includes('/') || segment.includes('\\') || segment.includes('\0')) {
    return failSegment(segment, kind)
  }

  return segment
}

function failSegment(segment: string, kind: string): never {
  throw new Error(`Refusing to write: ${kind} ${JSON.stringify(segment)} is not a safe path segment.`)
}

/**
 * Write a JSON file through a temporary file, then rename it into place.
 *
 * Locale files are read by the application at build or run time. A direct write that is
 * cut short — killed process, full disk — leaves a truncated file that no longer parses.
 * rename() within the same directory is atomic, so a reader sees the old file or the new
 * one, never half of either.
 */
function writeJson(filePath: string, data: Record<string, unknown>): void {
  const dir = dirname(filePath)

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const temporary = `${filePath}.${process.pid}.tmp`

  try {
    writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8')
    renameSync(temporary, filePath)
  } catch (error) {
    try {
      unlinkSync(temporary)
    } catch {
      // The temporary file may never have been created; nothing to clean up.
    }

    throw error
  }
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
  const safeLocale = assertSafeSegment(locale, 'locale')

  for (const [groupName, flatKeys] of Object.entries(groups)) {
    const nested = unflatten(flatKeys)

    if (groupName === '_json') {
      const filePath = join(localesPath, `${safeLocale}.json`)
      writeJson(filePath, nested)
      written.push(filePath)
    } else {
      const safeGroup = assertSafeSegment(groupName, 'group name')
      const filePath = join(localesPath, safeLocale, `${safeGroup}.json`)
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
  const filePath = join(localesPath, `${assertSafeSegment(locale, 'locale')}.json`)
  writeJson(filePath, nested)

  return [filePath]
}

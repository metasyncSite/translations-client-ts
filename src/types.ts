/** Flat map of dot-notation keys to string values. */
export type FlatKeys = Record<string, string>

/** A locale's translations grouped by file/group name. */
export type LocaleGroups = Record<string, FlatKeys>

/** Detected directory layout of the locales folder. */
export type LocaleLayout = 'flat' | 'grouped'

/** A single locale's data as returned by readLocales(). */
export interface LocaleData {
  locale: string
  groups: LocaleGroups
}

/** Parameters for pushLocale(). */
export interface PushLocaleParams {
  /** Base URL of the Translation Manager (e.g. https://translations.example.com). */
  url: string
  /** API bearer token. */
  token: string
  /** Locale code, e.g. 'en', 'de'. */
  locale: string
  /** Translation groups to push. */
  groups: LocaleGroups
  /** When true, existing keys will be overwritten. Defaults to true. */
  overwrite?: boolean
}

/** Response from the Translation Manager import endpoint. */
export interface PushResult {
  new: number
  updated: number
  total: number
}

/** Parameters for pullLocale() / the pull CLI. */
export interface PullOptions {
  /** Base URL of the Translation Manager. */
  url: string
  /** API bearer token. */
  token: string
  /** Absolute path to the locales directory. */
  localesPath: string
  /** Restrict pull to a single locale code. */
  locale?: string | null
  /** Force layout instead of auto-detecting. */
  layout?: LocaleLayout | null
  /** Dry-run: report what would be written without writing. */
  dryRun?: boolean
}

/** Parameters for pushAll() / the push CLI. */
export interface PushOptions {
  /** Base URL of the Translation Manager. */
  url: string
  /** API bearer token. */
  token: string
  /** Absolute path to the locales directory. */
  localesPath: string
  /** Restrict push to a single locale code. */
  locale?: string | null
  /** When true, existing keys will be overwritten. Defaults to true. */
  overwrite?: boolean
  /** Dry-run: report what would be sent without sending. */
  dryRun?: boolean
  /** JSON filenames to exclude from reading. */
  excludeFiles?: string[]
}
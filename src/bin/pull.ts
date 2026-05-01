#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { detectLayout } from '../langReader.js'
import { writeGroupedLocale, writeFlatLocale } from '../langWriter.js'
import { fetchJson } from '../apiClient.js'
import type { LocaleLayout, LocaleGroups } from '../types.js'

interface ParsedArgs {
  flags: Record<string, string | boolean>
}

interface LanguagesResponse {
  data: Array<{ code: string }>
}

interface TranslationsResponse {
  data: LocaleGroups
}

function loadDotEnv(cwd: string): void {
  const envPath = join(cwd, '.env')

  if (!existsSync(envPath)) {
    return
  }

  const lines = readFileSync(envPath, 'utf8').split('\n')

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const eqIndex = trimmed.indexOf('=')

    if (eqIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, eqIndex).trim()
    const rawValue = trimmed.slice(eqIndex + 1).trim()
    const value = rawValue.replace(/^["']|["']$/g, '')

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { flags: {} }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      const rawKey = eqIdx === -1 ? arg.slice(2) : arg.slice(2, eqIdx)
      const key = rawKey.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

      if (eqIdx !== -1) {
        args.flags[key] = arg.slice(eqIdx + 1)
      } else if (argv[i + 1] && !argv[i + 1]!.startsWith('--')) {
        args.flags[key] = argv[i + 1]!
        i++
      } else {
        args.flags[key] = true
      }
    }
  }

  return args
}

async function main(): Promise<void> {
  const cwd = process.cwd()
  loadDotEnv(cwd)

  const { flags } = parseArgs(process.argv.slice(2))

  const url = (flags['url'] as string | undefined) ?? process.env['TRANSLATIONS_URL']
  const token = (flags['token'] as string | undefined) ?? process.env['TRANSLATIONS_TOKEN']
  const localesPath = resolve(
    cwd,
    (flags['path'] as string | undefined) ??
      process.env['TRANSLATIONS_LOCALES_PATH'] ??
      'src/locales',
  )
  const onlyLocale = (flags['locale'] as string | undefined) ?? null
  const dryRun = flags['dryRun'] === true || flags['dryRun'] === 'true'
  const forcedLayout = (flags['layout'] as LocaleLayout | undefined) ?? null

  if (!url || !token) {
    console.error('Error: TRANSLATIONS_URL and TRANSLATIONS_TOKEN are required.')
    process.exit(1)
  }

  const base = url.replace(/\/$/, '')

  const langData = await fetchJson<LanguagesResponse>(`${base}/api/v1/languages`, token)
  let locales = langData.data.map((l) => l.code)

  if (onlyLocale) {
    locales = locales.filter((c) => c === onlyLocale)

    if (locales.length === 0) {
      console.warn(`Locale "${onlyLocale}" not found in Translation Manager.`)
      process.exit(0)
    }
  }

  const layout: LocaleLayout = forcedLayout ?? detectLayout(localesPath) ?? 'grouped'

  const prefix = dryRun ? '[DRY RUN] ' : ''
  console.log(
    `${prefix}Pulling ${locales.length} locale(s) [${layout} layout]: ${locales.join(', ')}`,
  )

  for (const locale of locales) {
    const data = await fetchJson<TranslationsResponse>(
      `${base}/api/v1/translations/${locale}?format=nested`,
      token,
    )

    const groups: LocaleGroups = data.data ?? {}

    const keyCount = Object.values(groups).reduce((sum, g) => sum + Object.keys(g).length, 0)

    if (dryRun) {
      console.log(`  ${locale}: ${keyCount} keys across ${Object.keys(groups).length} group(s).`)
      continue
    }

    const written =
      layout === 'grouped'
        ? writeGroupedLocale(localesPath, locale, groups)
        : writeFlatLocale(localesPath, locale, groups)

    console.log(`  ✓ ${locale}: ${keyCount} keys → ${written.length} file(s) written.`)
  }

  if (!dryRun) {
    console.log('\nDone.')
  }
}

main()

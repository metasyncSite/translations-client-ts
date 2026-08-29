#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { readLocales } from '../langReader.js'
import { pushLocale } from '../apiClient.js'

interface ParsedArgs {
  flags: Record<string, string | boolean>
  positional: string[]
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
  const args: ParsedArgs = { flags: {}, positional: [] }

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
    } else {
      args.positional.push(arg)
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
  const overwrite = flags['overwrite'] !== 'false' && flags['overwrite'] !== false
  const dryRun = flags['dryRun'] === true || flags['dryRun'] === 'true'
  const excludeFiles =
    typeof flags['exclude'] === 'string' ? flags['exclude'].split(',') : []

  if (!url || !token) {
    console.error('Error: TRANSLATIONS_URL and TRANSLATIONS_TOKEN are required.')
    console.error('Set them in .env or pass --url and --token flags.')
    process.exit(1)
  }

  let locales = readLocales(localesPath, excludeFiles)

  if (locales.length === 0) {
    // Asked to push and pushed nothing — usually a wrong --path, so do not call it a success.
    console.error(`Error: no locale files found in: ${localesPath}`)
    process.exit(1)
  }

  if (onlyLocale) {
    locales = locales.filter((l) => l.locale === onlyLocale)

    if (locales.length === 0) {
      console.error(`Error: locale "${onlyLocale}" not found in: ${localesPath}`)
      process.exit(1)
    }
  }

  const prefix = dryRun ? '[DRY RUN] ' : ''
  console.log(
    `${prefix}Pushing ${locales.length} locale(s): ${locales.map((l) => l.locale).join(', ')}`,
  )

  let totalNew = 0
  let totalUpdated = 0
  let totalKeys = 0
  const failed: string[] = []

  for (const { locale, groups } of locales) {
    const keyCount = Object.values(groups).reduce((sum, g) => sum + Object.keys(g).length, 0)

    if (dryRun) {
      console.log(`  ${locale}: ${keyCount} keys across ${Object.keys(groups).length} group(s).`)
      continue
    }

    try {
      const data = await pushLocale({ url, token, locale, groups, overwrite })
      totalNew += data.new ?? 0
      totalUpdated += data.updated ?? 0
      totalKeys += data.total ?? keyCount
      console.log(
        `  ✓ ${locale}: ${data.total ?? keyCount} keys — ${data.new ?? 0} new, ${data.updated ?? 0} updated.`,
      )
    } catch (err) {
      // Keep going so the remaining locales still get a chance, but remember the
      // failure: exiting 0 here would let a CI step report a push that never landed.
      console.error(`  ✗ ${locale}: ${err instanceof Error ? err.message : String(err)}`)
      failed.push(locale)
    }
  }

  if (failed.length > 0) {
    console.error(`\nFailed locale(s): ${failed.join(', ')}. Nothing was pushed for them.`)
    process.exit(1)
  }

  if (!dryRun) {
    console.log(`\nDone. Total: ${totalKeys} keys — ${totalNew} new, ${totalUpdated} updated.`)
  }
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

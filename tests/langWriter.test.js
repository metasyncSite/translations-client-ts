import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  unflatten,
  writeGroupedLocale,
  writeFlatLocale,
  assertSafeSegment,
} from '../dist/langWriter.js'

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'locales-'))

  try {
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('unflatten restores dot-notation keys', () => {
  assert.deepEqual(unflatten({ 'auth.login': 'Login', 'auth.out': 'Out', plain: 'Plain' }), {
    auth: { login: 'Login', out: 'Out' },
    plain: 'Plain',
  })
})

test('grouped layout writes one file per group', () => {
  withTempDir((dir) => {
    const written = writeGroupedLocale(dir, 'uk', {
      site: { reviews: 'Відгуки' },
      nova: { widgets: 'Віджети' },
    })

    assert.equal(written.length, 2)
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'uk', 'site.json'), 'utf8')), {
      reviews: 'Відгуки',
    })
  })
})

test('the _json group lands at the locale root', () => {
  withTempDir((dir) => {
    writeGroupedLocale(dir, 'uk', { _json: { Hello: 'Привіт' } })

    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'uk.json'), 'utf8')), { Hello: 'Привіт' })
  })
})

test('flat layout merges every group into one file', () => {
  withTempDir((dir) => {
    writeFlatLocale(dir, 'en', { site: { a: '1' }, nova: { b: '2' } })

    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8')), { a: '1', b: '2' })
  })
})

test('quotes, backslashes and multibyte text survive a round trip', () => {
  withTempDir((dir) => {
    const values = {
      markup: 'Натисніть <a class="btn" href="/x">тут</a>',
      quoted: "It's here",
      escaped: 'C:\\temp\\file',
      service: 'Лазерная эпиляция бедер',
      emoji: '🚀',
    }

    writeFlatLocale(dir, 'uk', { site: values })

    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'uk.json'), 'utf8')), values)
  })
})

test('a group name that would escape the directory is refused', () => {
  withTempDir((dir) => {
    assert.throws(
      () => writeGroupedLocale(dir, 'uk', { '../../escaped': { a: '1' } }),
      /not a safe path segment/,
    )

    assert.equal(existsSync(join(dir, 'uk')), false)
  })
})

test('a locale code that would escape the directory is refused', () => {
  withTempDir((dir) => {
    assert.throws(() => writeFlatLocale(dir, '../escaped', { site: { a: '1' } }), /not a safe path segment/)
  })
})

test('assertSafeSegment rejects separators and traversal, accepts normal names', () => {
  for (const bad of ['', '.', '..', 'a/b', 'a\\b']) {
    assert.throws(() => assertSafeSegment(bad, 'group name'), /not a safe path segment/)
  }

  assert.equal(assertSafeSegment('site', 'group name'), 'site')
  assert.equal(assertSafeSegment('uk-UA', 'locale'), 'uk-UA')
})

test('no temporary files are left behind after a write', () => {
  withTempDir((dir) => {
    writeGroupedLocale(dir, 'uk', { site: { a: '1' } })

    const leftovers = readdirSync(join(dir, 'uk')).filter((name) => name.endsWith('.tmp'))
    assert.deepEqual(leftovers, [])
  })
})

import type { PushLocaleParams, PushResult } from './types.js'

/**
 * Push a single locale's translations to the Translation Manager API.
 */
export async function pushLocale({
  url,
  token,
  locale,
  groups,
  overwrite = true,
}: PushLocaleParams): Promise<PushResult> {
  const endpoint = `${url.replace(/\/$/, '')}/api/v1/import`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ locale, groups, overwrite }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body}`)
  }

  return response.json() as Promise<PushResult>
}

/**
 * Fetch JSON from a Translation Manager API endpoint.
 */
export async function fetchJson<T = unknown>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}
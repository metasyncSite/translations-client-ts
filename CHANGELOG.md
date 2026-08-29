# Changelog

All notable changes to this package are documented here.

## 1.1.0

Translations are edited in the Translation Manager UI — **[translation.metasync.site](https://translation.metasync.site/)**.

Both commands are built to run unattended in CI and deploy steps. This release is about
making them tell the truth when something goes wrong, instead of exiting `0` on work that
never happened.

### Fixed

- **A failed push reported success.** `translations-push` caught the error for a locale,
  printed it, and still exited `0` — so a CI step went green on translations that never
  reached the Translation Manager. Failed locales are now listed and the command exits `1`.
- **A failed pull aborted the run and crashed.** `translations-pull` had no error handling
  at all: the first unreachable locale became an unhandled rejection, so later locales were
  never attempted while earlier ones were already on disk. Each locale is now handled on its
  own, failures are collected, and the command exits `1` naming them.
- **`--locale=xx` for an unknown locale exited `0`.** Both commands reported success after
  doing nothing. They now exit `1`. Push does the same when `--path` contains no locale
  files at all, which in practice means the path is wrong.
- **A malformed response crashed mid-run.** A group that came back as `null` or a string
  threw a `TypeError` inside `Object.keys()`. The response shape is validated first and the
  locale is reported as failed.

### Changed

- Locale files are written to a temporary file and renamed into place, so an interrupted
  pull leaves the previous file intact instead of a truncated one.
- Locale codes and group names from the API are validated before becoming path segments.
  A group named `../../something` is refused instead of writing outside the locales
  directory. Exported as `assertSafeSegment()` for callers using the programmatic API.

### Added

- Test suite: `npm test`. Uses the built-in `node --test`, no new dependencies.

## 1.0.0

- Initial release: `translations-push` and `translations-pull`.

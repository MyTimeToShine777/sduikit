# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/),
and the packages use [semantic versioning](https://semver.org/). The format itself has its own
`schema` number (currently 1); a change that would break old apps needs a new widget version
(`v`), and old versions keep working.

## [Unreleased]

### Added
- The format: JSON Schema files for pages, screens, building blocks, the app manifest, actions,
  rules and the 12 starter widgets (`text`, `image`, `button`, `spacer`, `divider`,
  `section_header`, `card`, `banner`, `carousel`, `list`, `grid`, `tabs`).
- `sduikit` for JavaScript: `validate` (errors in plain words with the path of the wrong
  field), `filterForClient` (country, app version, audience, schedule, supported widgets,
  fallbacks), `createSdui` for an app's own widgets, token lists and types.
- `sduikit/vue`: `SduiForm`, `SduiPreview` and reorder helpers for building a dashboard.
- An example server and an end-to-end test.

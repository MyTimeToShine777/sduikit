# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/),
and the packages use [semantic versioning](https://semver.org/). The format itself has its own
`schema` number (currently 1); a change that would break old apps needs a new widget version
(`v`), and old versions keep working.

## [Unreleased]

### Added (live data, drafts and a saved copy)
- `data_list` widget (v1): the app loads rows from its own API and the page repeats a template
  once per row, filling `{{field}}` placeholders. `validate` understands templates (placeholders
  are allowed inside them only), and `createSdui` accepts a `templates` list for your own widgets.
- Flutter: `SduiDataLoader`, `fillTemplate`, and `FileSduiCache` (`package:sduikit/io.dart`) that
  keeps the last good copy on disk.
- Example server: `/data/:name`, drafts, publish, history and rollback.

### Added
- The format: JSON Schema files for pages, screens, building blocks, the app manifest, actions,
  rules and the 12 starter widgets (`text`, `image`, `button`, `spacer`, `divider`,
  `section_header`, `card`, `banner`, `carousel`, `list`, `grid`, `tabs`).
- `sduikit` for JavaScript: `validate` (errors in plain words with the path of the wrong
  field), `filterForClient` (country, app version, audience, schedule, supported widgets,
  fallbacks), `createSdui` for an app's own widgets, token lists and types.
- `sduikit/vue`: `SduiForm`, `SduiPreview` and reorder helpers for building a dashboard.
- An example server and an end-to-end test.

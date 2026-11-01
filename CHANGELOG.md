# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/),
and the packages use [semantic versioning](https://semver.org/). The format itself has its own
`schema` number (currently 1); a change that would break old apps needs a new widget version
(`v`), and old versions keep working.

## [Unreleased]

### Changed (the preview, again)
- Page content now has a side margin of 16, except pictures, banners, carousels and other full-width widgets
  (`FULL_BLEED_WIDGETS` in JavaScript, `SduiRender.pageChildren` in Flutter).
- The preview is walled off from the page it is shown in (a dashboard's own heading, button and table styles no longer leak in),
  has a single scroll bar, and a failed picture keeps the size of the picture.
- The sample pages use real placeholder photos (picsum.photos) so a preview does not look broken.

### Added (a preview that looks like the app)
- `SduiPreview` now draws all 38 widgets in a Material style with the app's theme (`theme`), light or dark mode (`dark`)
  and example rows for live-data lists (`dataSamples`). `fillTemplate` is exported for dashboards.

### Added (exact preview)
- Flutter: `SduiContent` draws a page or screen that is already in hand (no loading), and `examples/preview`
  is a Flutter web page a dashboard can show in a frame to preview a page exactly like the app draws it.
- Example server accepts whatever extra headers a dashboard sends (CORS).

### Added (38 widgets in total, live data, drafts and a saved copy)
- 26 more widgets: `data_list`, `form`, `rich_text`, `quote`, `icon`, `avatar`, `badge`, `alert`,
  `progress`, `stat`, `key_value`, `list_item`, `empty_state`, `steps`, `accordion`, `table`,
  `countdown`, `gallery`, `video_card`, `hero`, `pricing_card`, `search_bar`, `chips`,
  `quick_actions`, `rating`, `container`. New icon, tone and size token lists.
- `data_list` widget (v1): the app loads rows from its own API and the page repeats a template
  once per row, filling `{{field}}` placeholders. `validate` understands templates (placeholders
  are allowed inside them only), and `createSdui` accepts a `templates` list for your own widgets.
- Flutter: `SduiDataLoader`, `fillTemplate`, and `FileSduiCache` (`package:sduikit/io.dart`) that
  keeps the last good copy on disk.
- Example server: `/data/:name`, drafts, publish, history and rollback.

### Added
- The format: JSON Schema files for pages, screens, building blocks, the app manifest, actions,
  rules and the first 12 widgets (`text`, `image`, `button`, `spacer`, `divider`,
  `section_header`, `card`, `banner`, `carousel`, `list`, `grid`, `tabs`).
- `sduikit` for JavaScript: `validate` (errors in plain words with the path of the wrong
  field), `filterForClient` (country, app version, audience, schedule, supported widgets,
  fallbacks), `createSdui` for an app's own widgets, token lists and types.
- `sduikit/vue`: `SduiForm`, `SduiPreview` and reorder helpers for building a dashboard.
- An example server and an end-to-end test.

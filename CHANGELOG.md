# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/),
and the packages use [semantic versioning](https://semver.org/). The format itself has its own
`schema` number (currently 1); a change that would break old apps needs a new widget version
(`v`), and old versions keep working.

## [Unreleased]

### Added (every widget's own options)
- **Every original widget now has the full set of options its Flutter counterpart has**, all optional so old pages keep working.
  A few examples: `button` (icon and where it goes, size, full width, disabled, loading, tonal and elevated looks), `image` (every fit,
  alignment, repeat, grayscale, loading and error looks), `card` (elevation, outline, picture size and place), `banner` and `hero`
  (height, overlay colour and strength, where the text sits, picture fit), `carousel` (height, dots, space, centre enlarged,
  timing), `tabs` (start tab, underline or segmented look, icons), `accordion` (open to begin, arrow side, subtitles),
  `table` (stripes, borders, column widths and alignment), `steps` (numbers, connecting line, horizontal), `rating` (any number
  of marks, symbol, colours), `countdown` (clock or long form, seconds), `form` (helper text, limits, patterns, field looks), and
  many more. The full list is in `docs/widgets.md`.
- A size can now be a name or any number (`spacer`, `icon`, `avatar`), and colours inside widgets can be any `#RRGGBB`.
- The edit form draws the new kinds of option (colour picker, name-or-number box).
- Tests check that every option of every widget is accepted by the schema, drawn by the preview, and read by the Flutter code.

### Added (every widget, every piece)
- **`style.parts`: a look for each named piece of a widget.** A card's `title`, `subtitle`, `image` and `body`, a button's `button`,
  an alert's `icon`, `title` and `message`, a stat's `value`... (31 widgets, listed in `docs/widgets.md` and in
  `listWidgets()[n].parts`). Each piece takes every style option. Drawn in the JavaScript preview and in Flutter.
  The style editor has a "Change the look of" picker.
- **Text options in the shared style:** `textDecoration`, `letterSpacing`, `lineHeight`, `maxLines`, `textOverflow` (clip, ellipsis,
  fade, visible), `softWrap`, and `overflow` (visible or hidden) for content bigger than its widget.
- The widget reference (`docs/widgets.md`) now lists all 66 widgets, the style options, and each widget's parts.

### Added (full control)
- **Exact styling.** `style` still takes theme names, and now also exact values: any `#RRGGBB` or `#RRGGBBAA` colour, numbers for
  space, corners and text size, `padding` and `margin` per side, `width`, `height` (a number or `"fill"`), `borderWidth`,
  `borderColor`, `shadow`, `opacity`, `fontWeight` and `italic`. Old pages are unchanged. Done in the schema, the JavaScript
  preview and the Flutter app.
- **28 building blocks named after Flutter's widgets** (`row`, `column`, `stack`, `positioned`, `padding`, `align`, `box` and more;
  see the README). 66 built-in widgets in all.
- **Edit forms for everything.** `SduiForm` now edits lists (add, remove, move), groups of fields, and tap actions. New
  `SduiStyleEditor`, `SduiActionEditor`, `SduiColorInput`, `SduiValueInput` and `SduiJsonBox`.
- **The preview is a design canvas.** `SduiPreview` takes `editable` and `selectedId`, and sends `select`, `edit` (text retyped in place)
  and `move` (dragged before or after another widget).
- `parentWidgetPointer` and the pointer helpers (`getAt`, `setAt`, `moveAt`, `duplicateAt`...) edit a widget at any depth.

### Changed (breaking for custom code that read the old types)
- In the TypeScript types, `Style` values are now `token | number` (or `token | "#RRGGBB"` for colours).
- `SduiForm` no longer reports lists as "unsupported"; `FieldKind` has new kinds (`longtext`, `action`, `group`, `list`, `json`).

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

# sduikit: design

Date: 2026-11-01
Status: draft, waiting for user review

## 1. Goal

Build **sduikit**, an open-source (MIT) toolkit for server-driven UI. A server describes
pages, tabs, navigation, whole screens and the app theme as JSON. A Flutter app draws that
JSON. Staff change the JSON from a dashboard and every installed app updates with no new
app release.

Anyone can use it for their own app. Medivoy is the first real user, not the only one.

Two packages share one set of schema files:

- **`sduikit`** (npm, JavaScript/TypeScript): schemas, validation, version and rule
  filtering, types, token definitions, and Vue pieces for building a dashboard editor.
- **`sduikit`** (pub.dev, Flutter): theme and tokens, widget registry, page renderer,
  building blocks, action handler, skeleton loaders, offline copy.

(Both registries accept the name `sduikit`; checked 2026-11-01, not reserved. If the Flutter
name is taken at publish time the fallback is `sduikit_flutter`.)

## 2. Decisions already made

| Decision | Choice |
|---|---|
| What the dashboard controls | Widgets inside pages, pages/tabs/bottom bar, whole new screens, look and feel (theme) |
| Approach | Hybrid: a catalogue of ready-made widgets, plus a small set of building blocks for custom screens |
| Stays built into the app | Login and OTP, payment and checkout, consent and medical forms, chat/calls/video |
| Audience | Anyone. Open source, MIT licence |
| Where it lives | A new repo, `sduikit`, holding both packages and the schemas |
| Name | `sduikit` |

## 3. Non-goals

- No hosted service and no ready-made dashboard product. The package gives the dashboard
  its building pieces (Vue). A complete admin app is built by each user.
- No domain widgets (doctor card, pharmacy, labs, shop) in the packages. Apps write and
  register their own.
- No React, Angular or native iOS/Android renderer in version 1. The schema is neutral, so
  other renderers can come later.
- No code from Zepto. Only the general idea of server-driven screens is used.

## 4. The shared format (the contract)

### 4.1 App setup (`manifest`)

Fetched at launch and saved on the device.

- `theme`: tokens for colours, fonts, text sizes, spacing scale, corner sizes, light and
  dark.
- `navigation`: bottom bar items and the list of pages, each with its tabs, icon and the
  page id to load.
- `killSwitches`: widget types or action types that must be treated as off.
- `minAppVersion` and `schema`: the schema version of the format.

### 4.2 Page

```json
{
  "schema": 1,
  "id": "home",
  "revision": "2026-11-01.3",
  "sections": [
    {
      "id": "hero",
      "widgets": [
        {
          "id": "w_banner_1",
          "type": "banner",
          "v": 1,
          "data": { "imageUrl": "https://example.com/a.jpg", "title": "Welcome" },
          "style": { "spacing": "md", "radius": "lg", "color": "primary" },
          "action": { "type": "open_screen", "screenId": "offers" },
          "analytics": { "event": "home_banner_tap" },
          "rules": {
            "countries": ["AE"],
            "minAppVersion": "1.2.0",
            "from": "2026-11-01T00:00:00Z",
            "to": "2026-12-01T00:00:00Z"
          },
          "fallback": null
        }
      ]
    }
  ]
}
```

- `type` + `v` select the widget and the version of its shape.
- `data` is the content. `style` holds token names only, never pixels or hex codes.
- `rules` supports country, a free-form `audience` map that the host app defines (for
  example care type or membership), a schedule, and a minimum app version.
- `fallback` is an optional widget to draw when this one cannot be drawn.

### 4.3 Custom screens (building blocks)

A screen has a `root` block tree instead of sections. Blocks: `column`, `row`, `stack`,
`grid`, `scroll`, `text`, `image`, `button`, `spacer`, `divider`. A block tree can embed any
catalogue widget with `{ "block": "widget", "widget": { ... } }`. Blocks use the same
`style` tokens and `action` as widgets.

### 4.4 Actions

A small fixed set: `open_screen`, `open_sheet`, `open_url`, `open_native` (a named built-in
screen the app registered), `call_api`, `share`, `dismiss`. The host app registers the named
native screens and handles `call_api`; the package does not know what an API is.

### 4.5 Schemas

One JSON Schema file per widget type and version, plus files for blocks, actions, page,
screen and manifest. A `catalogue.json` lists every type, its versions and the first package
version that supports it. These files are the single source of truth: the server validates
with them, the dashboard builds its edit forms from them, and the app reads data in that
shape.

## 5. Package: JavaScript (`sduikit` on npm)

Works in Node and browsers with no database or framework dependency.

- `validate(document)`: checks a page, screen or manifest and returns errors in plain words,
  each with the path of the field that is wrong.
- `filterForClient(document, client)`: removes widgets the client must not receive. The
  client object has app version, supported widget types and versions, country, audience,
  and the current time. Anything unknown to that client is removed.
- Types and token definitions generated from the schemas.
- `sduikit/vue`: `SduiForm` (builds an edit form from any widget schema), `SduiPreview`
  (draws a page the way the app would, approximately), and helpers for reordering.

## 6. Package: Flutter (`sduikit` on pub.dev)

- **Theme:** turns manifest tokens into a Flutter `ThemeData` and a theme extension.
- **Registry:** maps `type` + `v` to a builder. Apps add their own domain widgets here.
- **Page widget:** takes an app-provided `SduiClient` (how to fetch), draws the page, shows
  skeletons while loading, and keeps the last good copy for offline or failure.
- **Building blocks and v1 catalogue:** text, image, button, spacer, divider, section
  header, card, banner, carousel, list, grid, tabs. Lottie is an optional add-on package so
  the core stays small.
- **Actions:** a handler with a registry of named native screens.
- **Hooks:** analytics events and error reports are callbacks the app supplies.
- Unknown types, bad data and failed actions never crash the app (see section 7).

What each host app supplies: how to call its API, its named native screens, its own domain
widgets, and its analytics sink.

## 7. Errors and safety

- **Server down or slow:** show the last good copy; if none, a friendly retry screen. Every
  request has a time limit.
- **Broken widget:** the server rejects it on save. If one still reaches the app, that
  widget is skipped, the rest of the page is drawn, and the error hook is called.
- **Unknown type or version:** skip it, or draw its `fallback` if the page names one.
- **Missing required data:** skip the widget. The package never fills in invented values.
- **Failed image or action:** show a placeholder or call the error hook. No crash.
- **Kill switch:** the manifest can switch off any widget type or action at once.
- **Old apps:** the app sends its version and supported types; the server filters with
  `filterForClient`, so an old install only receives what it can draw.
- **Things that stay native** are not described by the format. The `open_native` action can
  open them but cannot restyle or replace them.

## 8. Testing

- Shared sample pages in `fixtures/` are tested by both packages: the JS side checks each
  is valid, the Flutter side checks each can be read and drawn (screenshot tests).
- JS unit tests for `validate` and `filterForClient`: version, country, audience, schedule,
  unknown types.
- Flutter widget tests for every built-in widget, the registry, skipping, the offline copy
  and actions.
- An example app and an example server run together in the build checks. The test changes
  the server page and confirms the app changes with no new app release.
- A compatibility test confirms that old sample pages still draw after any schema change.
- Medivoy adoption test: the migrated patient app screens are compared with today's.

## 9. Open-source readiness

- MIT `LICENSE`, `README` with a 5-minute quick start, a guide to writing a custom widget,
  `CONTRIBUTING`, `CHANGELOG`, and GitHub Actions build checks.
- Semantic version numbers for the packages. The format has its own `schema` number. A
  change that would break old apps needs a new widget `v`; old versions keep working for a
  stated period, written in the README.
- Publishing to npm and pub.dev, and making the GitHub repo public, happen only after the
  owner approves each one.

## 10. Build order

| Step | Work | Check |
|---|---|---|
| 1 | Repo, schemas, fixtures, `catalogue.json` | Every fixture validates against its schema |
| 2 | JavaScript package | Its unit tests pass |
| 3 | Flutter package with the v1 catalogue | Its tests pass and the sample page draws |
| 4 | Example app and example server | The end-to-end test passes |
| 5 | Medivoy patient app moves over one widget at a time | Each screen matches today's |
| 6 | Medivoy API serves the new format beside the old one | API tests pass |
| 7 | Medivoy internal dashboard uses the Vue pieces | Publish a change and see it in the app with no release |
| 8 | Docs and first release | Owner approves each publish |

Steps 1 to 4 are the sduikit repo. Steps 5 to 7 are separate work in the Medivoy repos, each
with its own plan, and each done on that repo's `dev` branch.

## 11. Medivoy specifics (not part of the packages)

Found by reading the code on 2026-11-01; not run:

- The patient app is Flutter (`medivoy-patient.app-dev`). It already has about 30 widget
  types drawn by one large `switch` in `lib/widgets/dynamic_widget.dart`, and a hardcoded
  page list in `lib/providers/page_provider.dart`.
- It invents values when data is missing (rating `4.5`, review count `127`, a testimonial
  name). The migration removes this.
- The API stores layouts in the `appconfig` table (per app type, page, tab, with an
  optional country and an on/off flag) and serves them from `/home/tabs`, `/home/widgets`
  and `/widgets/:page/:tab`.
- The internal dashboard already has a widget editor (`AddWidget.vue`,
  `EditCountryWidget.vue`, `CountryWidgetManager.vue`, `MobilePreview.vue`). It is updated
  to use sduikit rather than rebuilt.
- The old format keeps working while both are served.
- `medivoy.api` was on branch `features` when checked. Medivoy work goes on `dev`.

## 12. Known limits of what this design is based on

- Zepto's real server messages were never observed. Its app strings and endpoint names
  suggested the general approach; the JSON in section 4 is this project's own design.
- Nothing here has been built or run yet.

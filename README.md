# sduikit

**Change your app's screens from a dashboard, without releasing a new app.**

sduikit is a toolkit for *server-driven UI*. Your server describes pages, screens and the app's
look as JSON. The app reads that JSON and draws it. Staff edit the JSON in a dashboard, press
Publish, and every installed app shows the change the next time it asks the server. No app store
review, no update for the user.

It is open source (MIT) and made for any app, not for one company.

> **Status: early development.** Nothing is published to npm or pub.dev yet. The JavaScript side
> (format, checker, filter, dashboard pieces) is built and tested (285 tests). The Flutter package
> is fully written with 94 tests, but **those tests have not been run yet** because the
> author had no Flutter SDK at hand; the first job for a Flutter developer is described in
> [packages/flutter/README.md](packages/flutter/README.md).

---

## How it fits together

```
 staff ──► Dashboard ──► Your server ──► sduikit JSON ──► Your app (Flutter) draws it
            (Vue)         (Node, or any     pages, screens,    ▲
                           language)         theme, rules      └─ asks again each time it opens
```

1. **The format** (`schemas/`): JSON Schema files that describe what a page, a screen, a widget or
   the app theme may contain. Everything else follows these files.
2. **The checker and filter** (`sduikit` on npm): your server uses it to refuse broken pages (with
   errors in plain words that name the exact field) and to send each app only what it can draw and
   may show (its country, app version, language group, dates).
3. **The drawing code** (`sduikit` for Flutter): turns the JSON into real widgets. A broken or
   unknown widget is skipped (or replaced by its fallback) and reported; the rest of the page still
   draws. It keeps the last good copy so the app works offline.
4. **Dashboard pieces** (`sduikit/vue`): an edit form for any widget, a preview, and helpers for
   drag-and-drop. A complete example dashboard screen lives in the Medivoy internal dashboard.

| Part | Where | Status |
|---|---|---|
| Format (schemas, 38 widgets) | [`schemas/`](schemas) | Built, tested |
| JavaScript package | [`packages/js`](packages/js) | Built, 285 tests pass |
| Vue dashboard pieces | `packages/js/src/vue` | Built, tested |
| Flutter package | [`packages/flutter`](packages/flutter) | Written, **tests not run yet** |
| Example server | [`examples/server`](examples/server) | Built, 26 tests pass |
| Example Flutter app | [`examples/app`](examples/app) | Written, not run |

---

## A page, in 30 seconds

```json
{
  "schema": 1,
  "id": "home",
  "revision": "2026-11-02.1",
  "sections": [
    {
      "id": "hero",
      "widgets": [
        {
          "id": "w_banner_1",
          "type": "banner",
          "v": 1,
          "data": { "imageUrl": "https://example.com/spring.jpg", "title": "Spring sale" },
          "style": { "spacing": "md", "radius": "lg" },
          "action": { "type": "open_screen", "screenId": "sale" },
          "rules": { "countries": ["AE"], "from": "2026-11-01T00:00:00Z", "to": "2026-12-01T00:00:00Z" },
          "fallback": { "id": "w_banner_1_fb", "type": "text", "v": 1, "data": { "text": "Spring sale" } }
        }
      ]
    }
  ]
}
```

| Field | What it does |
|---|---|
| `type` + `v` | Which widget, and which version of its shape. A change that would break old apps becomes a new `v`, and old versions keep working. |
| `data` | The content. Checked against that widget's own schema. |
| `style` | **Names only** (`"md"`, `"primary"`), never pixels or hex colours. The app's theme decides what they look like, so dark mode and re-branding need no page edits. |
| `action` | What a tap does (see below). |
| `rules` | Who may see it: `countries`, `minAppVersion`, `from`/`to` dates, and `audience` (any groups your app defines, for example a plan or care type). |
| `analytics` | An event name (and values) the app reports when the widget is tapped. |
| `fallback` | A simpler widget to draw when this one cannot be drawn (an old app, a failure). |

**Actions** are a small fixed set: `open_screen`, `open_sheet`, `open_url`, `open_native` (a named
built-in screen of your app), `call_api` (a named call your app handles), `share`, `dismiss`. The
package never knows what your API is; your app supplies the handlers.

**Screens** are built from *blocks* (`column`, `row`, `stack`, `grid`, `scroll`, `text`, `image`,
`button`, `spacer`, `divider`, and `widget` to embed any widget) when a page of ready-made widgets
is not enough.

**The manifest** holds the theme (light and dark colours, fonts, text sizes, spacing, corner
sizes), the bottom bar and pages, and *kill switches* that switch a widget or action off in every
app at once.

---

## 38 built-in widgets

Full table of every field: **[docs/widgets.md](docs/widgets.md)** (generated from the schemas).

| Group | Widgets |
|---|---|
| **Basics** | `text` `image` `button` `spacer` `divider` `icon` `badge` `rich_text` |
| **Layout** | `section_header` `container` `list` `grid` `carousel` (can autoplay) `tabs` `accordion` `card` |
| **Media** | `banner` `hero` `gallery` `video_card` |
| **Content** | `avatar` `alert` `progress` `stat` `key_value` `list_item` `empty_state` `rating` `quote` `table` `steps` `countdown` `pricing_card` |
| **Interactive** | `search_bar` `chips` `quick_actions` `form` (text, email, number, date, select, checkbox, switch, with checks) |
| **Live data** | `data_list` (rows from your own API, drawn through a template) |

Your app adds its own widgets (a product tile, a map, a chart) next to these. They are checked and
drawn the same way (see "Your own widgets").

### Live data

A `data_list` asks the app for rows and repeats a template once per row. `{{field}}` is replaced by
that row's value. A field the row does not have is left out, never invented.

```json
{
  "id": "products", "type": "data_list", "v": 1,
  "data": {
    "source": { "name": "featured_products", "params": { "category": "shoes" } },
    "layout": "grid", "columns": 2, "emptyText": "Nothing here yet",
    "template": [{
      "id": "row", "type": "card", "v": 1,
      "data": { "title": "{{name}}", "subtitle": "{{price}} USD", "imageUrl": "{{photoUrl}}" },
      "action": { "type": "open_native", "name": "product", "params": { "productId": "{{id}}" } }
    }]
  }
}
```

### Forms

A `form` widget draws its fields, checks them when the person presses the button (required fields,
email and number formats), then runs its `action` with everything typed added to the action's
`params`. Values left empty are not sent.

---

## Use it on your server (Node, TypeScript or JavaScript)

```sh
npm install sduikit        # once it is published; until then see "Developing"
```

```js
import { validate, filterForClient } from "sduikit";

// 1. When staff save a page: refuse it if it has problems.
const result = validate(page);
if (!result.valid) {
  // [{ path: "sections[0].widgets[0].data.imageUrl", message: "This field is required." }]
  return res.status(422).json({ errors: result.errors });
}

// 2. When an app asks for a page: send only what that app can draw and may show.
res.json(filterForClient(page, {
  appVersion: "1.2.0",                       // from the request
  country: "AE",
  supportedWidgets: { text: [1], banner: [1] },   // the app sends its registry.supported
  audience: { plan: "gold" },                // any groups your rules use
}));
```

* `validate` finds **every** problem, not just the first, and names each field by its path.
  Inside a `data_list` template, `{{placeholders}}` are allowed (and only there).
* `filterForClient` never changes the page you pass in. It removes widgets whose rules do not
  match, replaces widgets the app cannot draw with their `fallback` (or drops them), and drops
  sections that end up empty.
* Not on Node? The schemas are plain JSON Schema, so any language can validate with its own
  library. `filterForClient` is a few dozen lines to port.

### Your own widgets

```js
import { createSdui } from "sduikit";

const { validate, filterForClient, listWidgets, sampleWidget } = createSdui({
  extraWidgets: {
    product_tile: {
      1: {
        schema: { type: "object", properties: { sku: { type: "string", minLength: 1 } }, required: ["sku"], additionalProperties: false },
        children: [],   // where it holds other widgets, if it does, e.g. ["items"]
      },
    },
  },
});
```

## Use it in a dashboard (Vue 3)

```js
import { SduiForm, SduiPreview, moveItem } from "sduikit/vue";
import { listWidgets, sampleWidget, widgetDataSchema, addWidget, moveWidget, validate } from "sduikit";

// <SduiForm :schema="widgetDataSchema('banner', 1)" v-model="widget.data" />
// <SduiPreview :document="page" />
```

* `listWidgets()` gives the "add a widget" list (grouped, with one-line descriptions).
* `sampleWidget(type, 1)` makes a new widget whose data is already valid.
* `addSection`, `addWidget`, `moveWidget`, `duplicateWidget`, `removeWidget`, `nextRevision` edit a
  page without changing the one you pass in (easy undo).

## Use it in a Flutter app

> Written, not yet run. See [packages/flutter/README.md](packages/flutter/README.md).

```dart
final registry = SduiWidgetRegistry.withBuiltIns()
  ..register('product_tile', 1, (context, node, render) => ProductTile(sku: node.requireString('sku')));

final render = SduiRender(
  registry: registry,
  actions: SduiActionHandler(
    onOpenScreen: (context, id) => Navigator.pushNamed(context, '/$id'),
    onCallApi: (name, params) => myApi.call(name, params),
    nativeScreens: {'product': (context, params) => openProduct(params['productId'])},
  ),
  dataLoader: (name, params) => myApi.rows(name, params),   // for data_list
  onError: reportToMyErrorTracker,
  onAnalytics: reportToMyAnalytics,
);

MaterialApp(theme: sduiThemeData(manifest['theme']), home: Scaffold(body: SduiView(
  kind: SduiDocumentKind.page, id: 'home', client: myClient, render: render,
  cache: FileSduiCache(dir),          // package:sduikit/io.dart; keeps the last good copy
)));
```

What the app gets for free: grey placeholders while loading, the saved copy when the server is
slow or down, a friendly "Try again" screen when there is nothing saved, a time limit on every
request, right-to-left layout, and no crash from a bad widget, bad data or a failed action.

---

## The server side of editing: drafts, publishing and going back

The example server ([`examples/server`](examples/server)) shows the routes a dashboard needs. Any
server can offer the same:

| Route | What it does |
|---|---|
| `GET /pages/:id?appVersion=…&country=…&widgets=text:1,…` | What an app asks for (filtered for that app). Same for `/screens/:id`, `/manifest`. |
| `GET /admin/pages` and `/admin/pages/:id` | List, and `{ live, draft }` for one. |
| `PUT /admin/drafts/pages/:id` | Save a draft. Apps do not see it. Refused with plain errors if it is broken. |
| `POST /admin/publish/pages/:id` | Make the draft live. The version it replaces goes into the history. |
| `GET /admin/history/pages/:id`, `POST /admin/rollback/pages/:id?revision=…` | See earlier versions and put one back. |

It also supports a staff token (`ADMIN_TOKEN`) and a saved file (`DATA_FILE`) so changes survive a
restart. A real server would use its own database and staff login.

Try it:

```sh
npm install
npm run build --workspace sduikit
npm start --workspace sduikit-example-server      # http://localhost:3000
```

---

## Safety and compatibility

* **Old apps keep working.** The app tells the server which widgets (and versions) it can draw;
  the server sends only those, or the fallback.
* **Unknown or broken widget:** skipped or replaced by its fallback, reported to your error hook;
  the rest of the page draws.
* **Missing data:** the widget is skipped. Values are never invented.
* **Kill switches:** the manifest can switch off any widget type or action everywhere at once.
* **Things that must stay in your app's own code** (login, payment, anything that needs native
  security) are not described by the format. `open_native` can open them but never restyle them.

## Repository layout

```
schemas/             the format (single source of truth) + catalogue.json
fixtures/valid/      sample pages, screen and manifest; every package tests against them
packages/js/         npm package "sduikit" (+ "sduikit/vue")
packages/flutter/    Flutter package "sduikit"
examples/server/     example server with drafts, publish, history, rollback
examples/app/        example Flutter app
docs/widgets.md      widget reference (generated)
docs/superpowers/    design document and implementation plans
```

## Developing

```sh
npm ci                   # use ci, not install (see CONTRIBUTING.md)
npm run schemas          # after changing anything in /schemas
npm run docs             # after changing a widget schema or the catalogue
npm test                 # the JavaScript package (285 tests)
npm run test:example     # the example server (26 tests)
```

Flutter: `cd packages/flutter && flutter pub get && flutter analyze && flutter test`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a widget, and [CHANGELOG.md](CHANGELOG.md).

## Not built yet

* Maps and in-app video playback (the `video_card` hands the video to your app). These need native
  plugins, so the plan is separate add-on packages.
* A ready-made dashboard product. The pieces exist and a complete screen is in the Medivoy internal
  dashboard; a standalone admin app is for each team to build.
* A database and staff login in the example server (it has a token and a saved file only).
* Publishing to npm and pub.dev.

## Licence

MIT. See [LICENSE](LICENSE).

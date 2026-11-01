# sduikit

Server-driven UI toolkit. A server describes pages, screens, navigation and theme as JSON;
a Flutter app draws it. Staff change the JSON and every installed app updates with no new
release.

Status: early development (nothing is published yet). Design:
`docs/superpowers/specs/2026-11-01-sduikit-design.md`.

## What is in this repo today

- `schemas/` is the format. JSON Schema files for pages, screens, building blocks, the
  manifest, actions and **38 built-in widgets** (text, image, button, card, banner, carousel, tabs,
  forms, live-data lists, rating, progress, accordion, countdown, gallery, pricing card and more).
  Everything else follows these files.
- `fixtures/` is a set of valid sample documents that every package tests against.
- `packages/js/` is the `sduikit` npm package: `validate`, `filterForClient`, token lists
  and a way to register your app's own widgets.

## Quick look (JavaScript)

```js
import { validate, filterForClient } from "sduikit";

const result = validate(page);
if (!result.valid) console.log(result.errors); // [{ path: "sections[0].widgets[0].data.title", message: "This field is required." }]

// Send each app only what it can draw and may show:
const forThisApp = filterForClient(page, {
  appVersion: "1.2.0",
  supportedWidgets: { banner: [1], text: [1] },
  country: "AE",
});
```

Your app's own widgets:

```js
import { createSdui } from "sduikit";

const { validate, filterForClient } = createSdui({
  extraWidgets: { doctor_card: { 1: { schema: { /* JSON Schema for its data */ } } } },
});
```

## Pieces for a dashboard (Vue)

```js
import { SduiForm, SduiPreview, moveItem } from "sduikit/vue";
import { widgetDataSchema } from "sduikit";

// <SduiForm :schema="widgetDataSchema('banner', 1)" v-model="widget.data" />
// <SduiPreview :document="page" />   // a quick look at how the app will draw the page
```

`SduiForm` builds an edit form for any widget from its schema. `SduiPreview` draws a page or
screen approximately the way the app will. `moveItem`, `insertItem` and `removeItem` help with
reordering. Vue 3 is an optional dependency: you only need it if you import `sduikit/vue`.

## Working on it

```
npm install
npm run schemas   # after changing anything in /schemas
npm test
```

Licence: MIT.

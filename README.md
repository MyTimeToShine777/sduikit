# sduikit

Server-driven UI toolkit. A server describes pages, screens, navigation and theme as JSON;
a Flutter app draws it. Staff change the JSON and every installed app updates with no new
release.

Status: early development (nothing is published yet). Design:
`docs/superpowers/specs/2026-11-01-sduikit-design.md`.

## What is in this repo today

- `schemas/` is the format. JSON Schema files for pages, screens, building blocks, the
  manifest, actions and the 12 starter widgets. Everything else follows these files.
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

## Working on it

```
npm install
npm run schemas   # after changing anything in /schemas
npm test
```

Licence: MIT.

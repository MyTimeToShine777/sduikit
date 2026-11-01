# sduikit: Schemas and JavaScript Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared JSON schemas, the sample files (fixtures) and the `sduikit` npm package core: `validate`, `filterForClient`, custom-widget support, types and token lists.

**Architecture:** The JSON Schema files in `/schemas` are the single source of truth. A small script copies them into one generated TypeScript file so the package works in Node and browsers with no file access. The package builds one Ajv (2020-12) instance from those files, then adds the checks that JSON Schema cannot do on its own (per-widget `data` checks, walking nested widgets, plain-language error messages, client filtering).

**Tech Stack:** TypeScript 5.9.3, Ajv 8.20.0 + ajv-formats 3.0.1, Vitest 5.0.5, Node 24, npm workspaces.

**Where this plan sits:** This is plan 1 of 4 for steps 1 and 2 of the design's build order. Later plans (written when this one is done): (2) Vue pieces `sduikit/vue`, (3) Flutter package, (4) example app + example server. Each later plan reuses `/schemas` and `/fixtures` from here.

## Global Constraints

Copied from `docs/superpowers/specs/2026-11-01-sduikit-design.md`:

- Open source, **MIT** licence. npm package name: **`sduikit`**.
- The schema files are the **single source of truth** (server validates with them, dashboard builds forms from them, the app reads data in that shape).
- `style` holds **token names only, never pixels or hex codes**.
- Schema version number is `1` (the `schema` field). Widget `type` + `v` select a widget and the version of its shape.
- Actions are a small fixed set: `open_screen`, `open_sheet`, `open_url`, `open_native`, `call_api`, `share`, `dismiss`.
- Blocks: `column`, `row`, `stack`, `grid`, `scroll`, `text`, `image`, `button`, `spacer`, `divider`, plus `widget` (embeds a catalogue widget).
- v1 catalogue: `text`, `image`, `button`, `spacer`, `divider`, `section_header`, `card`, `banner`, `carousel`, `list`, `grid`, `tabs`.
- `validate` returns errors **in plain words, each with the path of the wrong field**.
- `filterForClient` takes a client with app version, supported widget types and versions, country, audience and current time, and removes anything that client must not receive. Anything unknown to that client is removed (or replaced by its `fallback`).
- No domain widgets in the package; apps register their own (so validate/filter must accept extra widget definitions).
- No code from Zepto. No React/Angular/native renderers.
- Do not publish to npm or make the repo public. That needs the owner's approval.

Project rules from the owner's `CLAUDE.md` (apply to every task):

- Work directly on the `dev` branch. No other branches.
- **No Claude attribution** in commit messages (no `Co-Authored-By`, no "Generated with").
- Plain, readable code: descriptive names, short comments that say **why**, no clever tricks. Error messages in friendly everyday language.
- Do not push unless asked. Commits stay local.

## File Structure

```
package.json                         root workspace (scripts: schemas, test)
.gitignore  LICENSE  README.md
scripts/generate-schemas.mjs         copies /schemas into one TS file
schemas/
  catalogue.json                     every widget type + version (not a JSON Schema)
  common/tokens.json                 the allowed token names
  common/style.json  action.json  rules.json  widget.json
  widgets/<type>.v1.json             one per widget: shape of its `data`
  blocks/block.json                  all building blocks (recursive)
  page.json  screen.json  manifest.json
fixtures/
  valid/page-home.json  screen-offers.json  manifest.json
packages/js/
  package.json  tsconfig.json
  src/generated/schemas.ts           GENERATED, committed
  src/util.ts          isObject, deepCopy
  src/paths.ts         pointerToPath, appendPath
  src/messages.ts      Ajv errors -> plain-words issues
  src/widgetTree.ts    finds the lists of child widgets inside a widget
  src/registry.ts      Ajv instance + widget lookup (+ custom widgets)
  src/validate.ts      validateDocument
  src/version.ts       compareVersions
  src/types.ts         hand-written TypeScript types
  src/filter.ts        filterDocument
  src/sdui.ts          createSdui, validate, filterForClient
  src/tokens.ts        token lists
  src/index.ts         public exports
  tests/*.test.ts
```

Note on types: the design says types are "generated from the schemas". This plan writes them by hand (`src/types.ts`) because the schemas reference each other across files and a generator for that has not been tried here. `schemas.test.ts` and the fixture tests keep the two honest at runtime; switching to generated types later does not change the public API.

---

### Task 1: Repo scaffold and schema generator

**Files:**
- Create: `package.json`, `.gitignore`, `LICENSE`, `README.md`
- Create: `scripts/generate-schemas.mjs`
- Create: `schemas/common/tokens.json`
- Create: `packages/js/package.json`, `packages/js/tsconfig.json`
- Create: `packages/js/tests/helpers.ts`, `packages/js/tests/generated.test.ts`
- Generated: `packages/js/src/generated/schemas.ts`

**Interfaces:**
- Produces: `schemaFiles: Record<string, unknown>` exported from `packages/js/src/generated/schemas.ts`. Keys are paths inside `/schemas` with forward slashes (for example `"common/tokens.json"`). Produces `buildSchemasModule(dir?: string): string` from `scripts/generate-schemas.mjs`. Produces `repoRoot` and `loadFixture(name)` from `tests/helpers.ts`.

- [ ] **Step 1: Create the root files**

`package.json`:
```json
{
  "name": "sduikit-workspace",
  "private": true,
  "license": "MIT",
  "workspaces": ["packages/js"],
  "scripts": {
    "schemas": "node scripts/generate-schemas.mjs",
    "test": "npm run test --workspace sduikit --"
  }
}
```

`.gitignore`:
```
node_modules/
dist/
coverage/
*.log
```

`LICENSE` (standard MIT text):
```
MIT License

Copyright (c) 2026 sduikit contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`README.md`:
```markdown
# sduikit

Server-driven UI toolkit. A server describes pages, screens, navigation and theme as JSON;
a Flutter app draws it. Staff change the JSON and every installed app updates with no new
release.

Status: early development. See `docs/superpowers/specs/2026-11-01-sduikit-design.md`.

Licence: MIT.
```

- [ ] **Step 2: Create the generator script**

`scripts/generate-schemas.mjs`:
```js
// Copies every JSON file in /schemas into one TypeScript file, so the npm package
// carries the schemas inside its own code and works in browsers as well as Node.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = join(repoRoot, "schemas");
const outputFile = join(repoRoot, "packages", "js", "src", "generated", "schemas.ts");

function listJsonFiles(folder) {
  const found = [];
  for (const name of readdirSync(folder).sort()) {
    const fullPath = join(folder, name);
    if (statSync(fullPath).isDirectory()) found.push(...listJsonFiles(fullPath));
    else if (name.endsWith(".json")) found.push(fullPath);
  }
  return found;
}

// Returns the full text of the generated file. A test compares this with the file on disk
// so nobody forgets to run `npm run schemas` after editing a schema.
export function buildSchemasModule(folder = schemasDir) {
  const entries = listJsonFiles(folder).map((file) => {
    const key = relative(folder, file).split("\\").join("/");
    return [key, JSON.parse(readFileSync(file, "utf8"))];
  });
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const body = JSON.stringify(Object.fromEntries(entries), null, 2);
  return (
    "// GENERATED by scripts/generate-schemas.mjs from the /schemas folder. Do not edit by hand.\n" +
    '// Run "npm run schemas" after changing a schema file.\n' +
    `export const schemaFiles: Record<string, unknown> = ${body};\n`
  );
}

const ranDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (ranDirectly) {
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, buildSchemasModule());
  console.log(`Wrote ${relative(repoRoot, outputFile)}`);
}
```

- [ ] **Step 3: Create the first schema (the allowed token names)**

`schemas/common/tokens.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/common/tokens.json",
  "title": "Design tokens",
  "$comment": "The $id values are only names; nothing is ever fetched from that address.",
  "$defs": {
    "spacing": { "enum": ["none", "xs", "sm", "md", "lg", "xl"] },
    "radius": { "enum": ["none", "sm", "md", "lg", "full"] },
    "color": {
      "enum": [
        "primary", "onPrimary", "secondary", "onSecondary",
        "background", "onBackground", "surface", "onSurface",
        "muted", "success", "warning", "error"
      ]
    },
    "textSize": { "enum": ["caption", "body", "title", "headline", "display"] },
    "align": { "enum": ["start", "center", "end"] }
  }
}
```

- [ ] **Step 4: Create the JS package files**

`packages/js/package.json`:
```json
{
  "name": "sduikit",
  "version": "0.1.0",
  "description": "Server-driven UI toolkit: shared schemas, validation and client filtering.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "ajv": "8.20.0",
    "ajv-formats": "3.0.1"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "5.9.3",
    "vitest": "5.0.5"
  }
}
```

`packages/js/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": []
  },
  "include": ["src"]
}
```

`packages/js/tests/helpers.ts`:
```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = join(here, "..", "..", "..");

// Reads one of the shared sample files from /fixtures.
export function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(repoRoot, "fixtures", name), "utf8"));
}
```

- [ ] **Step 5: Install dependencies**

Run (from repo root): `npm install`
Expected: creates `node_modules/` and `package-lock.json`, no errors.

- [ ] **Step 6: Write the failing test**

`packages/js/tests/generated.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-ignore: plain JavaScript file with no type declarations
import { buildSchemasModule } from "../../../scripts/generate-schemas.mjs";
import { repoRoot } from "./helpers";

describe("generated schema file", () => {
  it("matches the files in /schemas (run `npm run schemas` if this fails)", () => {
    const onDisk = readFileSync(
      join(repoRoot, "packages", "js", "src", "generated", "schemas.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(onDisk).toBe(buildSchemasModule(join(repoRoot, "schemas")));
  });
});
```

- [ ] **Step 7: Run it to see it fail**

Run: `npm test -- tests/generated.test.ts`
Expected: FAIL with `ENOENT` (the generated file does not exist yet).

- [ ] **Step 8: Generate the file and run the test again**

Run: `npm run schemas` then `npm test -- tests/generated.test.ts`
Expected: prints `Wrote packages/js/src/generated/schemas.ts`; test PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Set up the repo, the schema generator and the first schema (token names)"
```

---

### Task 2: Common schemas (style, action, rules, widget envelope)

**Files:**
- Create: `schemas/common/style.json`, `schemas/common/action.json`, `schemas/common/rules.json`, `schemas/common/widget.json`
- Create: `schemas/catalogue.json` (empty for now)
- Modify: `packages/js/tests/helpers.ts` (append `compileSchema`)
- Test: `packages/js/tests/schemas-common.test.ts`
- Regenerate: `packages/js/src/generated/schemas.ts`

**Interfaces:**
- Consumes: `schemaFiles` (Task 1).
- Produces: `compileSchema(file: string): ValidateFunction` in `tests/helpers.ts` (builds an Ajv with every schema file, returns the validator for one file such as `"common/style.json"`). The four schemas above, with `$id` `https://sduikit.dev/schemas/common/<name>.json`.

- [ ] **Step 1: Append the test helper**

Add to the top imports of `packages/js/tests/helpers.ts`:
```ts
import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { schemaFiles } from "../src/generated/schemas";
```
and append at the end:
```ts
const SCHEMA_BASE = "https://sduikit.dev/schemas/";
let sharedAjv: Ajv2020 | undefined;

// Builds one Ajv holding every schema file and returns the checker for one of them.
// Used by the schema tests so they do not depend on the package's own registry.
export function compileSchema(file: string): ValidateFunction {
  if (!sharedAjv) {
    sharedAjv = new Ajv2020({ allErrors: true, strict: true, discriminator: true });
    addFormats(sharedAjv);
    for (const [name, schema] of Object.entries(schemaFiles)) {
      if (name === "catalogue.json") continue; // not a JSON Schema
      sharedAjv.addSchema(schema as object, SCHEMA_BASE + name);
    }
  }
  const check = sharedAjv.getSchema(SCHEMA_BASE + file);
  if (!check) throw new Error(`No schema file named ${file}`);
  return check;
}
```

- [ ] **Step 2: Write the failing tests**

`packages/js/tests/schemas-common.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { compileSchema } from "./helpers";

describe("style", () => {
  const style = compileSchema("common/style.json");

  it("accepts token names", () => {
    expect(
      style({ spacing: "md", radius: "lg", color: "primary", textColor: "onPrimary", textSize: "title", align: "center" }),
    ).toBe(true);
  });
  it("rejects pixel values", () => expect(style({ spacing: "12px" })).toBe(false));
  it("rejects hex colours", () => expect(style({ color: "#ff0000" })).toBe(false));
  it("rejects keys it does not know", () => expect(style({ padding: "md" })).toBe(false));
});

describe("action", () => {
  const action = compileSchema("common/action.json");

  it.each([
    [{ type: "open_screen", screenId: "offers" }],
    [{ type: "open_sheet", screenId: "filters" }],
    [{ type: "open_url", url: "https://example.com", external: true }],
    [{ type: "open_native", name: "booking", params: { source: "home" } }],
    [{ type: "call_api", name: "start_booking" }],
    [{ type: "share", text: "Look at this", url: "https://example.com" }],
    [{ type: "dismiss" }],
  ])("accepts %j", (value) => expect(action(value)).toBe(true));

  it("rejects an open_screen with no screenId", () => expect(action({ type: "open_screen" })).toBe(false));
  it("rejects an open_url that is not a URL", () => expect(action({ type: "open_url", url: "nope" })).toBe(false));
  it("rejects an unknown action type", () => expect(action({ type: "explode" })).toBe(false));
  it("rejects extra keys", () => expect(action({ type: "dismiss", force: true })).toBe(false));
});

describe("rules", () => {
  const rules = compileSchema("common/rules.json");

  it("accepts a full set of rules", () => {
    expect(
      rules({
        countries: ["AE", "IN"],
        audience: { careType: ["home", "clinic"] },
        minAppVersion: "1.2.0",
        from: "2026-11-01T00:00:00Z",
        to: "2026-12-01T00:00:00Z",
      }),
    ).toBe(true);
  });
  it("rejects lower-case country codes", () => expect(rules({ countries: ["ae"] })).toBe(false));
  it("rejects an empty country list", () => expect(rules({ countries: [] })).toBe(false));
  it("rejects a version with only two numbers", () => expect(rules({ minAppVersion: "1.2" })).toBe(false));
  it("rejects a date that is not a date", () => expect(rules({ from: "yesterday" })).toBe(false));
  it("rejects an audience value that is not a list", () => expect(rules({ audience: { careType: "home" } })).toBe(false));
});

describe("widget envelope", () => {
  const widget = compileSchema("common/widget.json");
  const minimal = { id: "w1", type: "text", v: 1, data: {} };

  it("accepts the smallest widget", () => expect(widget(minimal)).toBe(true));
  it("accepts a null fallback", () => expect(widget({ ...minimal, fallback: null })).toBe(true));
  it("accepts a widget as fallback", () => {
    expect(widget({ ...minimal, fallback: { id: "w2", type: "text", v: 1, data: {} } })).toBe(true);
  });
  it("rejects a fallback that is not a widget", () => expect(widget({ ...minimal, fallback: { id: "w2" } })).toBe(false));
  it("rejects a missing id", () => expect(widget({ type: "text", v: 1, data: {} })).toBe(false));
  it("rejects a type name that is not lower_snake_case", () => expect(widget({ ...minimal, type: "Banner" })).toBe(false));
  it("rejects version 0", () => expect(widget({ ...minimal, v: 0 })).toBe(false));
  it("rejects a missing data object", () => expect(widget({ id: "w1", type: "text", v: 1 })).toBe(false));
  it("rejects keys it does not know", () => expect(widget({ ...minimal, colour: "red" })).toBe(false));
  it("requires an analytics event name", () => expect(widget({ ...minimal, analytics: {} })).toBe(false));
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test -- tests/schemas-common.test.ts`
Expected: FAIL: `No schema file named common/style.json`.

- [ ] **Step 4: Write the schema files**

`schemas/common/style.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/common/style.json",
  "title": "Style",
  "description": "Token names only. Never pixels or hex codes; the app theme decides what a token looks like.",
  "type": "object",
  "properties": {
    "spacing": { "$ref": "tokens.json#/$defs/spacing" },
    "radius": { "$ref": "tokens.json#/$defs/radius" },
    "color": { "$ref": "tokens.json#/$defs/color" },
    "textColor": { "$ref": "tokens.json#/$defs/color" },
    "textSize": { "$ref": "tokens.json#/$defs/textSize" },
    "align": { "$ref": "tokens.json#/$defs/align" }
  },
  "additionalProperties": false
}
```

`schemas/common/action.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/common/action.json",
  "title": "Action",
  "description": "What happens when the user taps something. The app registers the named native screens and handles call_api.",
  "type": "object",
  "discriminator": { "propertyName": "type" },
  "oneOf": [
    { "$ref": "#/$defs/open_screen" },
    { "$ref": "#/$defs/open_sheet" },
    { "$ref": "#/$defs/open_url" },
    { "$ref": "#/$defs/open_native" },
    { "$ref": "#/$defs/call_api" },
    { "$ref": "#/$defs/share" },
    { "$ref": "#/$defs/dismiss" }
  ],
  "$defs": {
    "open_screen": {
      "type": "object",
      "properties": { "type": { "const": "open_screen" }, "screenId": { "type": "string", "minLength": 1 } },
      "required": ["type", "screenId"],
      "additionalProperties": false
    },
    "open_sheet": {
      "type": "object",
      "properties": { "type": { "const": "open_sheet" }, "screenId": { "type": "string", "minLength": 1 } },
      "required": ["type", "screenId"],
      "additionalProperties": false
    },
    "open_url": {
      "type": "object",
      "properties": {
        "type": { "const": "open_url" },
        "url": { "type": "string", "format": "uri" },
        "external": { "type": "boolean" }
      },
      "required": ["type", "url"],
      "additionalProperties": false
    },
    "open_native": {
      "type": "object",
      "properties": {
        "type": { "const": "open_native" },
        "name": { "type": "string", "minLength": 1 },
        "params": { "type": "object" }
      },
      "required": ["type", "name"],
      "additionalProperties": false
    },
    "call_api": {
      "type": "object",
      "properties": {
        "type": { "const": "call_api" },
        "name": { "type": "string", "minLength": 1 },
        "params": { "type": "object" }
      },
      "required": ["type", "name"],
      "additionalProperties": false
    },
    "share": {
      "type": "object",
      "properties": {
        "type": { "const": "share" },
        "text": { "type": "string", "minLength": 1 },
        "url": { "type": "string", "format": "uri" }
      },
      "required": ["type", "text"],
      "additionalProperties": false
    },
    "dismiss": {
      "type": "object",
      "properties": { "type": { "const": "dismiss" } },
      "required": ["type"],
      "additionalProperties": false
    }
  }
}
```

`schemas/common/rules.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/common/rules.json",
  "title": "Rules",
  "description": "When a widget may be shown. `audience` is a free-form map the host app defines; it matches when, for every key, the client has at least one of the listed values. `to` is exclusive.",
  "type": "object",
  "properties": {
    "countries": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[A-Z]{2}$" },
      "minItems": 1,
      "uniqueItems": true
    },
    "audience": {
      "type": "object",
      "additionalProperties": {
        "type": "array",
        "items": { "type": "string", "minLength": 1 },
        "minItems": 1
      }
    },
    "minAppVersion": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "from": { "type": "string", "format": "date-time" },
    "to": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}
```

`schemas/common/widget.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/common/widget.json",
  "title": "Widget",
  "description": "The outer shape every widget shares. The shape of `data` depends on type + v and is checked by the widget's own schema (see catalogue.json).",
  "type": "object",
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "type": { "type": "string", "pattern": "^[a-z][a-z0-9_]*$" },
    "v": { "type": "integer", "minimum": 1 },
    "data": { "type": "object" },
    "style": { "$ref": "style.json" },
    "action": { "$ref": "action.json" },
    "analytics": {
      "type": "object",
      "properties": {
        "event": { "type": "string", "minLength": 1 },
        "params": { "type": "object" }
      },
      "required": ["event"],
      "additionalProperties": false
    },
    "rules": { "$ref": "rules.json" },
    "fallback": {
      "if": { "type": "object" },
      "then": { "$ref": "widget.json" },
      "else": { "type": "null" }
    }
  },
  "required": ["id", "type", "v", "data"],
  "additionalProperties": false
}
```

`schemas/catalogue.json`:
```json
{
  "$comment": "Lists every built-in widget type and version. 'since' is the first package version that supports it. 'children' says where the widget's data holds other widgets, for example \"tabs[].widgets\".",
  "types": {}
}
```

- [ ] **Step 5: Regenerate and run the tests**

Run: `npm run schemas` then `npm test`
Expected: all tests PASS (generated test and schemas-common).

If a test fails with an Ajv "strict mode" message, the schema has a keyword that needs a `"type"` next to it; add the type rather than turning strict mode off.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the shared schemas: style, action, rules and the widget outer shape"
```

---

### Task 3: Widget schemas, the catalogue and the registry

**Files:**
- Create: `schemas/widgets/{text,image,button,spacer,divider,section_header,card,banner,carousel,list,grid,tabs}.v1.json`
- Modify: `schemas/catalogue.json`
- Create: `packages/js/src/util.ts`, `packages/js/src/paths.ts`, `packages/js/src/registry.ts`
- Test: `packages/js/tests/widgets.test.ts`
- Regenerate: `packages/js/src/generated/schemas.ts`

**Interfaces:**
- Consumes: `schemaFiles`.
- Produces:
  - `util.ts`: `isObject(value: unknown): value is Record<string, unknown>`, `deepCopy<T>(value: T): T`.
  - `paths.ts`: `pointerToPath(pointer: string): string`, `appendPath(base: string, addition: string): string`.
  - `registry.ts`: `SCHEMA_BASE`, `builtInCatalogue`, `interface WidgetInfo { children: string[]; validateData: ValidateFunction }`, `interface Registry { getSchema(file: string): ValidateFunction; lookup(type: string, version: number): WidgetInfo | undefined; knownVersions(type: string): number[] }`, `createRegistry(): Registry`.

- [ ] **Step 1: Write the failing tests**

`packages/js/tests/widgets.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { schemaFiles } from "../src/generated/schemas";
import { builtInCatalogue, createRegistry, SCHEMA_BASE } from "../src/registry";

const registry = createRegistry();
const sampleText = { id: "t1", type: "text", v: 1, data: { text: "Hello" } };

// [type, data that is valid, data that is not valid]
const cases: Array<[string, unknown, unknown]> = [
  ["text", { text: "Hello", maxLines: 2 }, {}],
  ["image", { url: "https://example.com/a.jpg", alt: "A", aspectRatio: 1.5, fit: "cover" }, { url: "not a url" }],
  ["button", { label: "Go", variant: "outline" }, { label: "Go", variant: "huge" }],
  ["spacer", { size: "md" }, { size: "12px" }],
  ["divider", {}, { color: "red" }],
  ["section_header", { title: "Title", subtitle: "Sub", actionLabel: "See all" }, { subtitle: "Sub" }],
  ["card", { title: "Title", children: [sampleText] }, {}],
  ["banner", { imageUrl: "https://example.com/a.jpg", title: "Hi" }, { title: "Hi" }],
  ["carousel", { items: [sampleText], autoplay: true, viewportFraction: 0.8 }, { items: [] }],
  ["list", { items: [sampleText], dividers: true }, {}],
  ["grid", { columns: 2, items: [sampleText] }, { items: [sampleText] }],
  ["tabs", { tabs: [{ id: "a", label: "A", widgets: [sampleText] }] }, { tabs: [] }],
];

describe("widget schemas", () => {
  it("has a test case for every type in the catalogue", () => {
    expect(cases.map(([type]) => type).sort()).toEqual(Object.keys(builtInCatalogue.types).sort());
  });

  it.each(cases)("%s accepts good data", (type, good) => {
    const info = registry.lookup(type, 1);
    expect(info, `${type} v1 is missing from the catalogue`).toBeDefined();
    expect(info!.validateData(good), JSON.stringify(info!.validateData.errors)).toBe(true);
  });

  it.each(cases)("%s rejects bad data", (type, _good, bad) => {
    expect(registry.lookup(type, 1)!.validateData(bad)).toBe(false);
  });
});

describe("catalogue", () => {
  const versions = Object.entries(builtInCatalogue.types).flatMap(([type, entry]) =>
    Object.entries(entry.versions).map(([v, info]) => ({ type, v, ...info })),
  );

  it("points every version at a schema file that exists and has the matching $id", () => {
    for (const info of versions) {
      const file = schemaFiles[info.schema] as { $id?: string } | undefined;
      expect(file, `${info.schema} is missing`).toBeDefined();
      expect(file!.$id).toBe(SCHEMA_BASE + info.schema);
    }
  });

  it("lists every file in schemas/widgets (no orphan schema files)", () => {
    const listed = new Set(versions.map((info) => info.schema));
    const onDisk = Object.keys(schemaFiles).filter((name) => name.startsWith("widgets/"));
    expect(onDisk.sort()).toEqual([...listed].sort());
  });

  it("names a first package version for each widget", () => {
    for (const info of versions) expect(info.since).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("registry lookups", () => {
  it("finds a known type and version", () => {
    expect(registry.lookup("text", 1)).toBeDefined();
    expect(registry.lookup("tabs", 1)!.children).toEqual(["tabs[].widgets"]);
  });
  it("does not find an unknown version or type", () => {
    expect(registry.lookup("text", 2)).toBeUndefined();
    expect(registry.lookup("hologram", 1)).toBeUndefined();
  });
  it("lists the known versions of a type", () => {
    expect(registry.knownVersions("text")).toEqual([1]);
    expect(registry.knownVersions("hologram")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- tests/widgets.test.ts`
Expected: FAIL: cannot find module `../src/registry`.

- [ ] **Step 3: Write the widget schema files**

Every file starts with the same three lines (`$schema`, `$id`, `title`). Write them exactly:

`schemas/widgets/text.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/text.v1.json",
  "title": "text (v1) data",
  "type": "object",
  "properties": {
    "text": { "type": "string", "minLength": 1 },
    "maxLines": { "type": "integer", "minimum": 1 }
  },
  "required": ["text"],
  "additionalProperties": false
}
```

`schemas/widgets/image.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/image.v1.json",
  "title": "image (v1) data",
  "type": "object",
  "properties": {
    "url": { "type": "string", "format": "uri" },
    "alt": { "type": "string" },
    "aspectRatio": { "type": "number", "exclusiveMinimum": 0 },
    "fit": { "enum": ["cover", "contain"] }
  },
  "required": ["url"],
  "additionalProperties": false
}
```

`schemas/widgets/button.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/button.v1.json",
  "title": "button (v1) data",
  "type": "object",
  "properties": {
    "label": { "type": "string", "minLength": 1 },
    "variant": { "enum": ["filled", "outline", "text"] }
  },
  "required": ["label"],
  "additionalProperties": false
}
```

`schemas/widgets/spacer.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/spacer.v1.json",
  "title": "spacer (v1) data",
  "type": "object",
  "properties": {
    "size": { "$ref": "../common/tokens.json#/$defs/spacing" }
  },
  "required": ["size"],
  "additionalProperties": false
}
```

`schemas/widgets/divider.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/divider.v1.json",
  "title": "divider (v1) data",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

`schemas/widgets/section_header.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/section_header.v1.json",
  "title": "section_header (v1) data",
  "type": "object",
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "subtitle": { "type": "string" },
    "actionLabel": { "type": "string" }
  },
  "required": ["title"],
  "additionalProperties": false
}
```

`schemas/widgets/card.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/card.v1.json",
  "title": "card (v1) data",
  "type": "object",
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "subtitle": { "type": "string" },
    "imageUrl": { "type": "string", "format": "uri" },
    "children": { "type": "array", "items": { "$ref": "../common/widget.json" } }
  },
  "minProperties": 1,
  "additionalProperties": false
}
```

`schemas/widgets/banner.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/banner.v1.json",
  "title": "banner (v1) data",
  "type": "object",
  "properties": {
    "imageUrl": { "type": "string", "format": "uri" },
    "title": { "type": "string" },
    "subtitle": { "type": "string" }
  },
  "required": ["imageUrl"],
  "additionalProperties": false
}
```

`schemas/widgets/carousel.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/carousel.v1.json",
  "title": "carousel (v1) data",
  "type": "object",
  "properties": {
    "items": { "type": "array", "items": { "$ref": "../common/widget.json" }, "minItems": 1 },
    "autoplay": { "type": "boolean" },
    "viewportFraction": { "type": "number", "minimum": 0.3, "maximum": 1 }
  },
  "required": ["items"],
  "additionalProperties": false
}
```

`schemas/widgets/list.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/list.v1.json",
  "title": "list (v1) data",
  "type": "object",
  "properties": {
    "items": { "type": "array", "items": { "$ref": "../common/widget.json" }, "minItems": 1 },
    "dividers": { "type": "boolean" }
  },
  "required": ["items"],
  "additionalProperties": false
}
```

`schemas/widgets/grid.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/grid.v1.json",
  "title": "grid (v1) data",
  "type": "object",
  "properties": {
    "columns": { "type": "integer", "minimum": 1, "maximum": 6 },
    "items": { "type": "array", "items": { "$ref": "../common/widget.json" }, "minItems": 1 }
  },
  "required": ["columns", "items"],
  "additionalProperties": false
}
```

`schemas/widgets/tabs.v1.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/widgets/tabs.v1.json",
  "title": "tabs (v1) data",
  "type": "object",
  "properties": {
    "tabs": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "label": { "type": "string", "minLength": 1 },
          "widgets": { "type": "array", "items": { "$ref": "../common/widget.json" } }
        },
        "required": ["id", "label", "widgets"],
        "additionalProperties": false
      }
    }
  },
  "required": ["tabs"],
  "additionalProperties": false
}
```

- [ ] **Step 4: Fill in the catalogue**

Replace `schemas/catalogue.json`:
```json
{
  "$comment": "Lists every built-in widget type and version. 'since' is the first package version that supports it. 'children' says where the widget's data holds other widgets, for example \"tabs[].widgets\".",
  "types": {
    "text": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/text.v1.json", "children": [] } } },
    "image": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/image.v1.json", "children": [] } } },
    "button": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/button.v1.json", "children": [] } } },
    "spacer": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/spacer.v1.json", "children": [] } } },
    "divider": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/divider.v1.json", "children": [] } } },
    "section_header": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/section_header.v1.json", "children": [] } } },
    "card": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/card.v1.json", "children": ["children"] } } },
    "banner": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/banner.v1.json", "children": [] } } },
    "carousel": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/carousel.v1.json", "children": ["items"] } } },
    "list": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/list.v1.json", "children": ["items"] } } },
    "grid": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/grid.v1.json", "children": ["items"] } } },
    "tabs": { "versions": { "1": { "since": "0.1.0", "schema": "widgets/tabs.v1.json", "children": ["tabs[].widgets"] } } }
  }
}
```

- [ ] **Step 5: Write the small helper files**

`packages/js/src/util.ts`:
```ts
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Documents are plain JSON, so a JSON round trip is a safe way to copy them.
export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
```

`packages/js/src/paths.ts`:
```ts
// Turns an Ajv path such as "/sections/0/widgets/1" into "sections[0].widgets[1]".
export function pointerToPath(pointer: string): string {
  let path = "";
  for (const part of pointer.split("/").slice(1)) {
    const name = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (/^\d+$/.test(name)) path += `[${name}]`;
    else path += path === "" ? name : `.${name}`;
  }
  return path;
}

// Joins two path pieces: ("a.b", "c") -> "a.b.c", ("a", "[0]") -> "a[0]", ("", "c") -> "c".
export function appendPath(base: string, addition: string): string {
  if (addition === "") return base;
  if (base === "") return addition;
  return addition.startsWith("[") ? base + addition : `${base}.${addition}`;
}
```

- [ ] **Step 6: Write the registry**

`packages/js/src/registry.ts`:
```ts
import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { schemaFiles } from "./generated/schemas.js";

// Only used as a name for each schema; nothing is ever downloaded from this address.
export const SCHEMA_BASE = "https://sduikit.dev/schemas/";

interface CatalogueFile {
  types: Record<string, { versions: Record<string, { since: string; schema: string; children: string[] }> }>;
}

export const builtInCatalogue = schemaFiles["catalogue.json"] as CatalogueFile;

export interface WidgetInfo {
  // Where this widget's `data` holds other widgets, e.g. ["items"] or ["tabs[].widgets"].
  children: string[];
  // Checks the widget's `data` object against its own schema.
  validateData: ValidateFunction;
}

export interface Registry {
  getSchema(file: string): ValidateFunction;
  lookup(type: string, version: number): WidgetInfo | undefined;
  knownVersions(type: string): number[];
}

interface WidgetEntry {
  schemaKey: string;
  children: string[];
}

export function createRegistry(): Registry {
  // strict: true makes Ajv complain about mistakes in our own schema files instead of ignoring them.
  const ajv = new Ajv2020({ allErrors: true, strict: true, discriminator: true });
  addFormats(ajv);

  for (const [file, schema] of Object.entries(schemaFiles)) {
    if (file === "catalogue.json") continue; // the catalogue is a list, not a JSON Schema
    ajv.addSchema(schema as object, SCHEMA_BASE + file);
  }

  const widgetTypes = new Map<string, Map<number, WidgetEntry>>();
  for (const [type, entry] of Object.entries(builtInCatalogue.types)) {
    const versions = new Map<number, WidgetEntry>();
    for (const [version, info] of Object.entries(entry.versions)) {
      versions.set(Number(version), { schemaKey: SCHEMA_BASE + info.schema, children: info.children });
    }
    widgetTypes.set(type, versions);
  }

  function getSchema(file: string): ValidateFunction {
    const check = ajv.getSchema(SCHEMA_BASE + file);
    if (!check) throw new Error(`There is no schema file named ${file}`);
    return check;
  }

  return {
    getSchema,
    lookup(type, version) {
      const entry = widgetTypes.get(type)?.get(version);
      if (!entry) return undefined;
      const validateData = ajv.getSchema(entry.schemaKey);
      if (!validateData) throw new Error(`The schema ${entry.schemaKey} is listed but was not loaded`);
      return { children: entry.children, validateData };
    },
    knownVersions(type) {
      return [...(widgetTypes.get(type)?.keys() ?? [])].sort((a, b) => a - b);
    },
  };
}
```

- [ ] **Step 7: Regenerate and run**

Run: `npm run schemas` then `npm test`
Expected: all PASS. If Ajv reports a strict-mode problem in a widget schema, fix the schema (add the missing `"type"`), then regenerate.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add the twelve v1 widget schemas, the catalogue and the registry"
```

---

### Task 4: Page, screen (building blocks) and manifest schemas, plus fixtures

**Files:**
- Create: `schemas/page.json`, `schemas/screen.json`, `schemas/manifest.json`, `schemas/blocks/block.json`
- Create: `fixtures/valid/page-home.json`, `fixtures/valid/screen-offers.json`, `fixtures/valid/manifest.json`
- Test: `packages/js/tests/documents.test.ts`
- Regenerate: `packages/js/src/generated/schemas.ts`

**Interfaces:**
- Consumes: `compileSchema` (Task 2), `loadFixture` (Task 1), `builtInCatalogue` (Task 3).
- Produces: schema files `page.json`, `screen.json`, `manifest.json`, `blocks/block.json`; the three valid fixtures (used by every later plan).

- [ ] **Step 1: Write the fixtures**

`fixtures/valid/page-home.json`:
```json
{
  "schema": 1,
  "id": "home",
  "revision": "2026-11-01.3",
  "title": "Home",
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
          "fallback": {
            "id": "w_banner_1_fallback",
            "type": "text",
            "v": 1,
            "data": { "text": "Welcome" },
            "style": { "textSize": "headline" }
          }
        }
      ]
    },
    {
      "id": "services",
      "title": "Services",
      "widgets": [
        {
          "id": "w_header_1",
          "type": "section_header",
          "v": 1,
          "data": { "title": "Popular services", "subtitle": "Book in under a minute", "actionLabel": "See all" },
          "action": { "type": "open_screen", "screenId": "services" }
        },
        {
          "id": "w_carousel_1",
          "type": "carousel",
          "v": 1,
          "data": {
            "autoplay": true,
            "viewportFraction": 0.85,
            "items": [
              {
                "id": "w_card_1",
                "type": "card",
                "v": 1,
                "data": { "title": "Teeth cleaning", "subtitle": "From AED 150", "imageUrl": "https://example.com/c1.jpg" },
                "action": { "type": "open_sheet", "screenId": "cleaning" }
              },
              {
                "id": "w_card_2",
                "type": "card",
                "v": 1,
                "data": {
                  "title": "Health check",
                  "children": [
                    { "id": "w_card_2_text", "type": "text", "v": 1, "data": { "text": "A full check in one visit" } }
                  ]
                }
              }
            ]
          }
        },
        { "id": "w_spacer_1", "type": "spacer", "v": 1, "data": { "size": "md" } },
        { "id": "w_divider_1", "type": "divider", "v": 1, "data": {} }
      ]
    },
    {
      "id": "more",
      "widgets": [
        {
          "id": "w_list_1",
          "type": "list",
          "v": 1,
          "data": {
            "dividers": true,
            "items": [
              { "id": "w_list_1_a", "type": "text", "v": 1, "data": { "text": "First item" } },
              { "id": "w_list_1_b", "type": "text", "v": 1, "data": { "text": "Second item", "maxLines": 2 } }
            ]
          }
        },
        {
          "id": "w_grid_1",
          "type": "grid",
          "v": 1,
          "data": {
            "columns": 2,
            "items": [
              { "id": "w_grid_1_a", "type": "image", "v": 1, "data": { "url": "https://example.com/g1.jpg", "alt": "One", "aspectRatio": 1, "fit": "cover" } },
              { "id": "w_grid_1_b", "type": "image", "v": 1, "data": { "url": "https://example.com/g2.jpg", "alt": "Two" } }
            ]
          }
        },
        {
          "id": "w_tabs_1",
          "type": "tabs",
          "v": 1,
          "data": {
            "tabs": [
              {
                "id": "upcoming",
                "label": "Upcoming",
                "widgets": [{ "id": "w_tabs_1_a", "type": "text", "v": 1, "data": { "text": "No upcoming visits" } }]
              },
              {
                "id": "past",
                "label": "Past",
                "widgets": [{ "id": "w_tabs_1_b", "type": "text", "v": 1, "data": { "text": "No past visits" } }]
              }
            ]
          }
        },
        {
          "id": "w_button_1",
          "type": "button",
          "v": 1,
          "data": { "label": "Book a visit", "variant": "filled" },
          "action": { "type": "call_api", "name": "start_booking", "params": { "source": "home" } },
          "analytics": { "event": "home_book_tap", "params": { "position": "bottom" } }
        }
      ]
    }
  ]
}
```

`fixtures/valid/screen-offers.json`:
```json
{
  "schema": 1,
  "id": "offers",
  "revision": "2026-11-01.1",
  "title": "Offers",
  "root": {
    "block": "scroll",
    "children": [
      {
        "block": "column",
        "gap": "md",
        "style": { "spacing": "md" },
        "children": [
          { "block": "text", "text": "This month's offers", "style": { "textSize": "headline" } },
          { "block": "image", "url": "https://example.com/offers.jpg", "alt": "Offers", "aspectRatio": 1.78, "fit": "cover" },
          {
            "block": "row",
            "gap": "sm",
            "children": [
              {
                "block": "button",
                "label": "Book now",
                "variant": "filled",
                "action": { "type": "open_native", "name": "booking", "params": { "source": "offers" } }
              },
              {
                "block": "button",
                "label": "Share",
                "variant": "outline",
                "action": { "type": "share", "text": "Look at these offers", "url": "https://example.com/offers" }
              },
              { "block": "button", "label": "Close", "variant": "text", "action": { "type": "dismiss" } }
            ]
          },
          { "block": "spacer", "size": "lg" },
          { "block": "divider" },
          {
            "block": "stack",
            "children": [
              { "block": "image", "url": "https://example.com/badge.png" },
              { "block": "text", "text": "New" }
            ]
          },
          {
            "block": "grid",
            "columns": 2,
            "gap": "sm",
            "children": [
              { "block": "text", "text": "One" },
              { "block": "text", "text": "Two" }
            ]
          },
          {
            "block": "widget",
            "widget": {
              "id": "w_offer_banner",
              "type": "banner",
              "v": 1,
              "data": { "imageUrl": "https://example.com/b.jpg", "title": "Winter check-ups" },
              "action": { "type": "open_url", "url": "https://example.com/winter", "external": true }
            }
          }
        ]
      }
    ]
  }
}
```

`fixtures/valid/manifest.json`:
```json
{
  "schema": 1,
  "minAppVersion": "1.0.0",
  "theme": {
    "light": {
      "primary": "#0B6E4F", "onPrimary": "#FFFFFF",
      "secondary": "#3B82F6", "onSecondary": "#FFFFFF",
      "background": "#FFFFFF", "onBackground": "#111827",
      "surface": "#F3F4F6", "onSurface": "#111827",
      "muted": "#6B7280", "success": "#16A34A", "warning": "#D97706", "error": "#DC2626"
    },
    "dark": {
      "primary": "#34D399", "onPrimary": "#06281D",
      "secondary": "#60A5FA", "onSecondary": "#0B1E3A",
      "background": "#0B0F14", "onBackground": "#F9FAFB",
      "surface": "#161B22", "onSurface": "#F9FAFB",
      "muted": "#9CA3AF", "success": "#4ADE80", "warning": "#FBBF24", "error": "#F87171"
    },
    "fonts": { "body": "Inter", "heading": "Inter" },
    "textSizes": { "caption": 12, "body": 14, "title": 18, "headline": 24, "display": 32 },
    "spacing": { "none": 0, "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32 },
    "radii": { "none": 0, "sm": 4, "md": 8, "lg": 16, "full": 999 }
  },
  "navigation": {
    "bottomBar": [
      { "id": "tab_home", "label": "Home", "icon": "home", "pageId": "home" },
      { "id": "tab_offers", "label": "Offers", "icon": "tag", "pageId": "offers" }
    ],
    "pages": [
      {
        "id": "home",
        "title": "Home",
        "icon": "home",
        "tabs": [
          { "id": "for_you", "label": "For you", "pageId": "home" },
          { "id": "services", "label": "Services", "pageId": "services" }
        ]
      },
      { "id": "offers", "title": "Offers" }
    ]
  },
  "killSwitches": { "widgets": [], "actions": [] }
}
```

- [ ] **Step 2: Write the failing tests**

`packages/js/tests/documents.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { schemaFiles } from "../src/generated/schemas";
import { builtInCatalogue } from "../src/registry";
import { compileSchema, loadFixture } from "./helpers";

const checkPage = compileSchema("page.json");
const checkScreen = compileSchema("screen.json");
const checkManifest = compileSchema("manifest.json");

describe("fixtures", () => {
  it("page-home is a valid page", () => {
    expect(checkPage(loadFixture("valid/page-home.json")), JSON.stringify(checkPage.errors)).toBe(true);
  });
  it("screen-offers is a valid screen", () => {
    expect(checkScreen(loadFixture("valid/screen-offers.json")), JSON.stringify(checkScreen.errors)).toBe(true);
  });
  it("manifest is a valid manifest", () => {
    expect(checkManifest(loadFixture("valid/manifest.json")), JSON.stringify(checkManifest.errors)).toBe(true);
  });

  // The fixtures are also used by the Flutter tests, so they should show everything.
  const documents = [loadFixture("valid/page-home.json"), loadFixture("valid/screen-offers.json")];

  function collect(value: unknown, found: { widgets: Set<string>; blocks: Set<string>; actions: Set<string> }) {
    if (Array.isArray(value)) value.forEach((item) => collect(item, found));
    else if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      if (typeof object.type === "string" && typeof object.v === "number") found.widgets.add(object.type);
      if (typeof object.block === "string") found.blocks.add(object.block);
      if (typeof object.action === "object" && object.action) found.actions.add((object.action as { type: string }).type);
      Object.values(object).forEach((item) => collect(item, found));
    }
  }
  const found = { widgets: new Set<string>(), blocks: new Set<string>(), actions: new Set<string>() };
  documents.forEach((document) => collect(document, found));

  it("use every widget type in the catalogue", () => {
    expect([...found.widgets].sort()).toEqual(Object.keys(builtInCatalogue.types).sort());
  });
  it("use every block", () => {
    const blockSchema = schemaFiles["blocks/block.json"] as { $defs: Record<string, unknown> };
    expect([...found.blocks].sort()).toEqual(Object.keys(blockSchema.$defs).sort());
  });
  it("use every action", () => {
    const actionSchema = schemaFiles["common/action.json"] as { $defs: Record<string, unknown> };
    expect([...found.actions].sort()).toEqual(Object.keys(actionSchema.$defs).sort());
  });
});

describe("page", () => {
  const page = () => loadFixture("valid/page-home.json");

  it("needs a revision", () => {
    const broken = page();
    delete broken.revision;
    expect(checkPage(broken)).toBe(false);
  });
  it("only accepts schema 1", () => expect(checkPage({ ...page(), schema: 2 })).toBe(false));
  it("rejects a section with no id", () => {
    expect(checkPage({ ...page(), sections: [{ widgets: [] }] })).toBe(false);
  });
});

describe("screen and blocks", () => {
  const screen = () => loadFixture("valid/screen-offers.json");

  it("rejects a block name it does not know", () => {
    expect(checkScreen({ ...screen(), root: { block: "carousel", children: [] } })).toBe(false);
  });
  it("rejects a text block with no text", () => {
    expect(checkScreen({ ...screen(), root: { block: "text" } })).toBe(false);
  });
  it("rejects a grid with zero columns", () => {
    expect(checkScreen({ ...screen(), root: { block: "grid", columns: 0, children: [] } })).toBe(false);
  });
  it("rejects a pixel gap", () => {
    expect(checkScreen({ ...screen(), root: { block: "column", gap: "8px", children: [] } })).toBe(false);
  });
  it("checks blocks nested deep inside", () => {
    const deep = { block: "column", children: [{ block: "row", children: [{ block: "text" }] }] };
    expect(checkScreen({ ...screen(), root: deep })).toBe(false);
  });
});

describe("manifest", () => {
  const manifest = () => loadFixture("valid/manifest.json");

  it("needs every colour token in both modes", () => {
    const broken = manifest();
    delete broken.theme.dark.error;
    expect(checkManifest(broken)).toBe(false);
  });
  it("rejects a colour that is not #RRGGBB", () => {
    const broken = manifest();
    broken.theme.light.primary = "green";
    expect(checkManifest(broken)).toBe(false);
  });
  it("needs at least one bottom bar item", () => {
    const broken = manifest();
    broken.navigation.bottomBar = [];
    expect(checkManifest(broken)).toBe(false);
  });
  it("allows at most five bottom bar items", () => {
    const broken = manifest();
    broken.navigation.bottomBar = Array.from({ length: 6 }, (_, index) => ({
      id: `t${index}`, label: "T", icon: "home", pageId: "home",
    }));
    expect(checkManifest(broken)).toBe(false);
  });
  it("lists exactly the colour tokens the style schema allows", () => {
    const tokens = schemaFiles["common/tokens.json"] as { $defs: { color: { enum: string[] } } };
    const paletteSchema = (schemaFiles["manifest.json"] as { $defs: { palette: { required: string[] } } }).$defs.palette;
    expect([...paletteSchema.required].sort()).toEqual([...tokens.$defs.color.enum].sort());
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test -- tests/documents.test.ts`
Expected: FAIL: `No schema file named page.json`.

- [ ] **Step 4: Write the schemas**

`schemas/blocks/block.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/blocks/block.json",
  "title": "Block",
  "description": "A building block of a custom screen. Layout blocks hold other blocks; the widget block embeds a catalogue widget.",
  "type": "object",
  "discriminator": { "propertyName": "block" },
  "oneOf": [
    { "$ref": "#/$defs/column" },
    { "$ref": "#/$defs/row" },
    { "$ref": "#/$defs/stack" },
    { "$ref": "#/$defs/grid" },
    { "$ref": "#/$defs/scroll" },
    { "$ref": "#/$defs/text" },
    { "$ref": "#/$defs/image" },
    { "$ref": "#/$defs/button" },
    { "$ref": "#/$defs/spacer" },
    { "$ref": "#/$defs/divider" },
    { "$ref": "#/$defs/widget" }
  ],
  "$defs": {
    "column": {
      "type": "object",
      "properties": {
        "block": { "const": "column" },
        "children": { "type": "array", "items": { "$ref": "block.json" } },
        "gap": { "$ref": "../common/tokens.json#/$defs/spacing" },
        "style": { "$ref": "../common/style.json" },
        "action": { "$ref": "../common/action.json" }
      },
      "required": ["block", "children"],
      "additionalProperties": false
    },
    "row": {
      "type": "object",
      "properties": {
        "block": { "const": "row" },
        "children": { "type": "array", "items": { "$ref": "block.json" } },
        "gap": { "$ref": "../common/tokens.json#/$defs/spacing" },
        "style": { "$ref": "../common/style.json" },
        "action": { "$ref": "../common/action.json" }
      },
      "required": ["block", "children"],
      "additionalProperties": false
    },
    "stack": {
      "type": "object",
      "properties": {
        "block": { "const": "stack" },
        "children": { "type": "array", "items": { "$ref": "block.json" } },
        "style": { "$ref": "../common/style.json" },
        "action": { "$ref": "../common/action.json" }
      },
      "required": ["block", "children"],
      "additionalProperties": false
    },
    "grid": {
      "type": "object",
      "properties": {
        "block": { "const": "grid" },
        "columns": { "type": "integer", "minimum": 1, "maximum": 6 },
        "children": { "type": "array", "items": { "$ref": "block.json" } },
        "gap": { "$ref": "../common/tokens.json#/$defs/spacing" },
        "style": { "$ref": "../common/style.json" }
      },
      "required": ["block", "columns", "children"],
      "additionalProperties": false
    },
    "scroll": {
      "type": "object",
      "properties": {
        "block": { "const": "scroll" },
        "children": { "type": "array", "items": { "$ref": "block.json" } },
        "style": { "$ref": "../common/style.json" }
      },
      "required": ["block", "children"],
      "additionalProperties": false
    },
    "text": {
      "type": "object",
      "properties": {
        "block": { "const": "text" },
        "text": { "type": "string", "minLength": 1 },
        "style": { "$ref": "../common/style.json" },
        "action": { "$ref": "../common/action.json" }
      },
      "required": ["block", "text"],
      "additionalProperties": false
    },
    "image": {
      "type": "object",
      "properties": {
        "block": { "const": "image" },
        "url": { "type": "string", "format": "uri" },
        "alt": { "type": "string" },
        "aspectRatio": { "type": "number", "exclusiveMinimum": 0 },
        "fit": { "enum": ["cover", "contain"] },
        "style": { "$ref": "../common/style.json" },
        "action": { "$ref": "../common/action.json" }
      },
      "required": ["block", "url"],
      "additionalProperties": false
    },
    "button": {
      "type": "object",
      "properties": {
        "block": { "const": "button" },
        "label": { "type": "string", "minLength": 1 },
        "variant": { "enum": ["filled", "outline", "text"] },
        "style": { "$ref": "../common/style.json" },
        "action": { "$ref": "../common/action.json" }
      },
      "required": ["block", "label"],
      "additionalProperties": false
    },
    "spacer": {
      "type": "object",
      "properties": {
        "block": { "const": "spacer" },
        "size": { "$ref": "../common/tokens.json#/$defs/spacing" }
      },
      "required": ["block", "size"],
      "additionalProperties": false
    },
    "divider": {
      "type": "object",
      "properties": {
        "block": { "const": "divider" },
        "style": { "$ref": "../common/style.json" }
      },
      "required": ["block"],
      "additionalProperties": false
    },
    "widget": {
      "type": "object",
      "properties": {
        "block": { "const": "widget" },
        "widget": { "$ref": "../common/widget.json" }
      },
      "required": ["block", "widget"],
      "additionalProperties": false
    }
  }
}
```

`schemas/page.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/page.json",
  "title": "Page",
  "description": "A page made of sections of catalogue widgets.",
  "type": "object",
  "properties": {
    "schema": { "const": 1 },
    "id": { "type": "string", "minLength": 1 },
    "revision": { "type": "string", "minLength": 1 },
    "title": { "type": "string" },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "title": { "type": "string" },
          "widgets": { "type": "array", "items": { "$ref": "common/widget.json" } }
        },
        "required": ["id", "widgets"],
        "additionalProperties": false
      }
    }
  },
  "required": ["schema", "id", "revision", "sections"],
  "additionalProperties": false
}
```

`schemas/screen.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/screen.json",
  "title": "Screen",
  "description": "A custom screen made of building blocks.",
  "type": "object",
  "properties": {
    "schema": { "const": 1 },
    "id": { "type": "string", "minLength": 1 },
    "revision": { "type": "string", "minLength": 1 },
    "title": { "type": "string" },
    "root": { "$ref": "blocks/block.json" }
  },
  "required": ["schema", "id", "revision", "root"],
  "additionalProperties": false
}
```

`schemas/manifest.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sduikit.dev/schemas/manifest.json",
  "title": "Manifest",
  "description": "App setup fetched at launch: theme, navigation and kill switches.",
  "type": "object",
  "properties": {
    "schema": { "const": 1 },
    "minAppVersion": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "theme": {
      "type": "object",
      "properties": {
        "light": { "$ref": "#/$defs/palette" },
        "dark": { "$ref": "#/$defs/palette" },
        "fonts": {
          "type": "object",
          "properties": {
            "body": { "type": "string", "minLength": 1 },
            "heading": { "type": "string", "minLength": 1 }
          },
          "required": ["body", "heading"],
          "additionalProperties": false
        },
        "textSizes": {
          "type": "object",
          "properties": {
            "caption": { "$ref": "#/$defs/positive" },
            "body": { "$ref": "#/$defs/positive" },
            "title": { "$ref": "#/$defs/positive" },
            "headline": { "$ref": "#/$defs/positive" },
            "display": { "$ref": "#/$defs/positive" }
          },
          "required": ["caption", "body", "title", "headline", "display"],
          "additionalProperties": false
        },
        "spacing": {
          "type": "object",
          "properties": {
            "none": { "$ref": "#/$defs/zeroOrMore" },
            "xs": { "$ref": "#/$defs/zeroOrMore" },
            "sm": { "$ref": "#/$defs/zeroOrMore" },
            "md": { "$ref": "#/$defs/zeroOrMore" },
            "lg": { "$ref": "#/$defs/zeroOrMore" },
            "xl": { "$ref": "#/$defs/zeroOrMore" }
          },
          "required": ["none", "xs", "sm", "md", "lg", "xl"],
          "additionalProperties": false
        },
        "radii": {
          "type": "object",
          "properties": {
            "none": { "$ref": "#/$defs/zeroOrMore" },
            "sm": { "$ref": "#/$defs/zeroOrMore" },
            "md": { "$ref": "#/$defs/zeroOrMore" },
            "lg": { "$ref": "#/$defs/zeroOrMore" },
            "full": { "$ref": "#/$defs/zeroOrMore" }
          },
          "required": ["none", "sm", "md", "lg", "full"],
          "additionalProperties": false
        }
      },
      "required": ["light", "dark", "fonts", "textSizes", "spacing", "radii"],
      "additionalProperties": false
    },
    "navigation": {
      "type": "object",
      "properties": {
        "bottomBar": {
          "type": "array",
          "minItems": 1,
          "maxItems": 5,
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "label": { "type": "string", "minLength": 1 },
              "icon": { "type": "string", "minLength": 1 },
              "pageId": { "type": "string", "minLength": 1 }
            },
            "required": ["id", "label", "icon", "pageId"],
            "additionalProperties": false
          }
        },
        "pages": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "title": { "type": "string", "minLength": 1 },
              "icon": { "type": "string", "minLength": 1 },
              "tabs": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "string", "minLength": 1 },
                    "label": { "type": "string", "minLength": 1 },
                    "pageId": { "type": "string", "minLength": 1 }
                  },
                  "required": ["id", "label", "pageId"],
                  "additionalProperties": false
                }
              }
            },
            "required": ["id", "title"],
            "additionalProperties": false
          }
        }
      },
      "required": ["bottomBar", "pages"],
      "additionalProperties": false
    },
    "killSwitches": {
      "type": "object",
      "properties": {
        "widgets": { "type": "array", "items": { "type": "string" } },
        "actions": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": false
    }
  },
  "required": ["schema", "theme", "navigation"],
  "additionalProperties": false,
  "$defs": {
    "hexColor": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
    "positive": { "type": "number", "exclusiveMinimum": 0 },
    "zeroOrMore": { "type": "number", "minimum": 0 },
    "palette": {
      "type": "object",
      "properties": {
        "primary": { "$ref": "#/$defs/hexColor" },
        "onPrimary": { "$ref": "#/$defs/hexColor" },
        "secondary": { "$ref": "#/$defs/hexColor" },
        "onSecondary": { "$ref": "#/$defs/hexColor" },
        "background": { "$ref": "#/$defs/hexColor" },
        "onBackground": { "$ref": "#/$defs/hexColor" },
        "surface": { "$ref": "#/$defs/hexColor" },
        "onSurface": { "$ref": "#/$defs/hexColor" },
        "muted": { "$ref": "#/$defs/hexColor" },
        "success": { "$ref": "#/$defs/hexColor" },
        "warning": { "$ref": "#/$defs/hexColor" },
        "error": { "$ref": "#/$defs/hexColor" }
      },
      "required": [
        "primary", "onPrimary", "secondary", "onSecondary",
        "background", "onBackground", "surface", "onSurface",
        "muted", "success", "warning", "error"
      ],
      "additionalProperties": false
    }
  }
}
```

- [ ] **Step 5: Regenerate and run**

Run: `npm run schemas` then `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add page, screen, block and manifest schemas with shared sample files"
```

---

### Task 5: `validate()` with plain-words errors

**Files:**
- Create: `packages/js/src/messages.ts`, `packages/js/src/widgetTree.ts`, `packages/js/src/validate.ts`, `packages/js/src/sdui.ts`
- Modify: `packages/js/tests/helpers.ts` (append `page`, `screen`)
- Test: `packages/js/tests/paths.test.ts`, `packages/js/tests/validate.test.ts`

**Interfaces:**
- Consumes: `Registry` (Task 3), `isObject`, `appendPath`, `pointerToPath`.
- Produces:
  - `messages.ts`: `interface ValidationIssue { path: string; message: string }`, `issuesFromAjv(errors: ErrorObject[], basePath?: string): ValidationIssue[]`.
  - `widgetTree.ts`: `interface WidgetSlot { owner: Record<string, unknown>; key: string; path: string; widgets: unknown[] }`, `findWidgetLists(data: unknown, specs: string[], basePath: string): WidgetSlot[]`.
  - `validate.ts`: `type DocumentKind = "page" | "screen" | "manifest"`, `interface ValidationResult { valid: boolean; errors: ValidationIssue[] }`, `validateDocument(registry: Registry, document: unknown, kind?: DocumentKind): ValidationResult`.
  - `sdui.ts`: `createSdui()` returning `{ validate }` for now (Task 6 adds `filterForClient`, Task 7 adds options); exported constant `validate`.

- [ ] **Step 1: Append test helpers**

Append to `packages/js/tests/helpers.ts`:
```ts
// Builds a small page holding the given widgets in one section.
export function page(...widgets: unknown[]): any {
  return { schema: 1, id: "p", revision: "1", sections: [{ id: "s", widgets }] };
}

// Builds a small screen whose root is the given block.
export function screen(root: unknown): any {
  return { schema: 1, id: "s", revision: "1", root };
}

export function widget(type: string, data: unknown, extra: Record<string, unknown> = {}): any {
  return { id: `w_${type}`, type, v: 1, data, ...extra };
}
```

- [ ] **Step 2: Write the failing tests**

`packages/js/tests/paths.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { appendPath, pointerToPath } from "../src/paths";

describe("pointerToPath", () => {
  it("turns an Ajv path into a readable one", () => {
    expect(pointerToPath("/sections/0/widgets/1/data")).toBe("sections[0].widgets[1].data");
  });
  it("gives an empty path for the whole document", () => expect(pointerToPath("")).toBe(""));
  it("starts with an index when the document is a list", () => expect(pointerToPath("/0/name")).toBe("[0].name"));
});

describe("appendPath", () => {
  it("joins with a dot", () => expect(appendPath("a.b", "c")).toBe("a.b.c"));
  it("joins an index without a dot", () => expect(appendPath("a", "[0]")).toBe("a[0]"));
  it("ignores empty pieces", () => {
    expect(appendPath("", "c")).toBe("c");
    expect(appendPath("a", "")).toBe("a");
  });
});
```

`packages/js/tests/validate.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { validate } from "../src/sdui";
import { loadFixture, page, screen, widget } from "./helpers";

const banner = (data: unknown = { imageUrl: "https://example.com/a.jpg" }, extra = {}) => widget("banner", data, extra);

describe("validate: sample files", () => {
  it.each(["valid/page-home.json", "valid/screen-offers.json", "valid/manifest.json"])("%s is valid", (name) => {
    const result = validate(loadFixture(name));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

// [description, document, path of the wrong field, words the message must contain]
const problems: Array<[string, unknown, string, string]> = [
  ["a missing required field", page(banner({})), "sections[0].widgets[0].data.imageUrl", "required"],
  ["an unknown widget type", page(widget("hologram", {})), "sections[0].widgets[0].type", 'Unknown widget type "hologram"'],
  ["an unknown widget version", page(banner(undefined, { v: 9 })), "sections[0].widgets[0].v", "has no version 9. Known versions: 1"],
  ["a style value that is not a token", page(banner(undefined, { style: { spacing: "huge" } })), "sections[0].widgets[0].style.spacing", "Must be one of: none, xs, sm, md, lg, xl"],
  ["an extra field in data", page(banner({ imageUrl: "https://example.com/a.jpg", colour: "red" })), "sections[0].widgets[0].data.colour", "not allowed"],
  ["an action missing its screenId", page(banner(undefined, { action: { type: "open_screen" } })), "sections[0].widgets[0].action.screenId", "required"],
  ["an unknown action type", page(banner(undefined, { action: { type: "explode" } })), "sections[0].widgets[0].action", '"explode" is not a known value for "type"'],
  ["a lower-case country code", page(banner(undefined, { rules: { countries: ["ae"] } })), "sections[0].widgets[0].rules.countries[0]", "expected format"],
  ["a start date that is not a date", page(banner(undefined, { rules: { from: "yesterday" } })), "sections[0].widgets[0].rules.from", "valid date and time"],
  ["a wrong kind of value", page(widget("text", { text: 5 })), "sections[0].widgets[0].data.text", "Must be text"],
  ["an empty text", page(widget("text", { text: "" })), "sections[0].widgets[0].data.text", "Must not be empty"],
  ["a bad widget inside a card", page(widget("card", { children: [widget("text", { text: "" })] })), "sections[0].widgets[0].data.children[0].data.text", "Must not be empty"],
  ["an unknown widget inside a tab", page(widget("tabs", { tabs: [{ id: "a", label: "A", widgets: [widget("hologram", {})] }] })), "sections[0].widgets[0].data.tabs[0].widgets[0].type", "Unknown widget type"],
  ["a bad fallback widget", page(banner(undefined, { fallback: widget("hologram", {}) })), "sections[0].widgets[0].fallback.type", "Unknown widget type"],
  ["a block name it does not know", screen({ block: "nope" }), "root", '"nope" is not a known value for "block"'],
  ["a bad widget inside a screen", screen({ block: "column", children: [{ block: "widget", widget: banner({}) }] }), "root.children[0].widget.data.imageUrl", "required"],
  ["a missing top-level field", { ...page(), revision: undefined }, "revision", "required"],
];

describe("validate: problems are reported with the path and plain words", () => {
  it.each(problems)("%s", (_description, document, expectedPath, expectedWords) => {
    const result = validate(document);
    expect(result.valid).toBe(false);
    const match = result.errors.find((issue) => issue.path === expectedPath);
    expect(match, `no error at ${expectedPath}; got ${JSON.stringify(result.errors)}`).toBeDefined();
    expect(match!.message).toContain(expectedWords);
  });

  it("reports a missing manifest colour at its path", () => {
    const manifest = loadFixture("valid/manifest.json");
    delete manifest.theme.light.primary;
    const result = validate(manifest);
    expect(result.errors.map((issue) => issue.path)).toContain("theme.light.primary");
  });

  it("reports every problem, not just the first", () => {
    const result = validate(page(banner({}), widget("hologram", {})));
    const paths = result.errors.map((issue) => issue.path);
    expect(paths).toContain("sections[0].widgets[0].data.imageUrl");
    expect(paths).toContain("sections[0].widgets[1].type");
  });

  it("does not report the same problem twice", () => {
    const result = validate(page(widget("card", { children: [widget("text", { text: "" })] })));
    const keys = result.errors.map((issue) => `${issue.path}|${issue.message}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("says when it cannot tell what kind of document it is", () => {
    const result = validate({ hello: "world" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Cannot tell what kind of document");
  });

  it("does not crash on things that are not objects", () => {
    expect(validate(null).valid).toBe(false);
    expect(validate("text").valid).toBe(false);
    expect(validate(page("not a widget")).valid).toBe(false);
  });

  it("can be told the kind of document", () => {
    expect(validate({ hello: "world" }, "page").valid).toBe(false);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test -- tests/paths.test.ts tests/validate.test.ts`
Expected: paths tests PASS (Task 3 already wrote `paths.ts`); validate tests FAIL: cannot find module `../src/sdui`.

- [ ] **Step 4: Write `messages.ts`**

`packages/js/src/messages.ts`:
```ts
import type { ErrorObject } from "ajv";
import { appendPath, pointerToPath } from "./paths.js";

export interface ValidationIssue {
  // Where the problem is, for example "sections[0].widgets[1].data.title". Empty means the whole document.
  path: string;
  message: string;
}

const typeNames: Record<string, string> = {
  string: "text",
  number: "a number",
  integer: "a whole number",
  boolean: "true or false",
  object: "an object",
  array: "a list",
  null: "null",
};

const formatNames: Record<string, string> = {
  uri: "web address (URL), for example https://example.com",
  "date-time": "date and time, for example 2026-11-01T00:00:00Z",
};

// Returns the readable version of one Ajv error, or null if the error adds nothing
// (Ajv also reports "the if-rule failed", which only repeats the real errors).
function describe(error: ErrorObject): { extraPath: string; message: string } | null {
  const params = error.params as Record<string, any>;
  switch (error.keyword) {
    case "if":
      return null;
    case "required":
      return { extraPath: params.missingProperty, message: "This field is required." };
    case "additionalProperties":
      return { extraPath: params.additionalProperty, message: "This field is not allowed here." };
    case "type": {
      const expected = [params.type].flat().map((name: string) => typeNames[name] ?? name);
      return { extraPath: "", message: `Must be ${expected.join(" or ")}.` };
    }
    case "enum":
      return { extraPath: "", message: `Must be one of: ${(params.allowedValues as unknown[]).join(", ")}.` };
    case "const":
      return { extraPath: "", message: `Must be ${JSON.stringify(params.allowedValue)}.` };
    case "pattern":
      return { extraPath: "", message: "Is not in the expected format." };
    case "format":
      return { extraPath: "", message: `Must be a valid ${formatNames[params.format] ?? params.format}.` };
    case "minimum":
      return { extraPath: "", message: `Must be at least ${params.limit}.` };
    case "maximum":
      return { extraPath: "", message: `Must be at most ${params.limit}.` };
    case "exclusiveMinimum":
      return { extraPath: "", message: `Must be greater than ${params.limit}.` };
    case "minLength":
      return { extraPath: "", message: params.limit === 1 ? "Must not be empty." : `Must be at least ${params.limit} characters.` };
    case "minItems":
      return { extraPath: "", message: params.limit === 1 ? "Must have at least one item." : `Must have at least ${params.limit} items.` };
    case "maxItems":
      return { extraPath: "", message: `Must have at most ${params.limit} items.` };
    case "minProperties":
      return { extraPath: "", message: "Must not be empty." };
    case "uniqueItems":
      return { extraPath: "", message: "Must not contain the same value twice." };
    case "discriminator":
      if (params.error === "tag") {
        return { extraPath: "", message: `Needs a "${params.tag}" field with a text value.` };
      }
      return { extraPath: "", message: `"${params.tagValue}" is not a known value for "${params.tag}".` };
    default:
      return { extraPath: "", message: `Is not valid (${error.message ?? error.keyword}).` };
  }
}

// Turns Ajv's technical errors into issues a person can act on.
// `basePath` is added in front of every path (used when only a part of the document was checked).
export function issuesFromAjv(errors: ErrorObject[], basePath = ""): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const error of errors) {
    const described = describe(error);
    if (!described) continue;
    const where = appendPath(basePath, pointerToPath(error.instancePath));
    issues.push({ path: appendPath(where, described.extraPath), message: described.message });
  }
  return issues;
}
```

- [ ] **Step 5: Write `widgetTree.ts`**

`packages/js/src/widgetTree.ts`:
```ts
import { appendPath } from "./paths.js";
import { isObject } from "./util.js";

// One list of child widgets found inside a widget's data.
export interface WidgetSlot {
  owner: Record<string, unknown>; // the object that holds the list
  key: string; // the list's name inside `owner`
  path: string; // readable path of the list, for error messages
  widgets: unknown[]; // owner[key]
}

// Finds the lists of child widgets inside `data`.
// Each spec is a dotted path such as "items" or "tabs[].widgets"; "[]" means "do this for every entry".
export function findWidgetLists(data: unknown, specs: string[], basePath: string): WidgetSlot[] {
  const slots: WidgetSlot[] = [];
  for (const spec of specs) collect(data, spec.split("."), basePath, slots);
  return slots;
}

function collect(value: unknown, parts: string[], path: string, slots: WidgetSlot[]): void {
  if (!isObject(value) || parts.length === 0) return;
  const [head, ...rest] = parts;
  const forEveryEntry = head.endsWith("[]");
  const key = forEveryEntry ? head.slice(0, -2) : head;
  const next = value[key];
  const nextPath = appendPath(path, key);

  if (forEveryEntry) {
    if (Array.isArray(next)) next.forEach((entry, index) => collect(entry, rest, `${nextPath}[${index}]`, slots));
  } else if (rest.length === 0) {
    if (Array.isArray(next)) slots.push({ owner: value, key, path: nextPath, widgets: next });
  } else {
    collect(next, rest, nextPath, slots);
  }
}
```

- [ ] **Step 6: Write `validate.ts`**

`packages/js/src/validate.ts`:
```ts
import { issuesFromAjv, type ValidationIssue } from "./messages.js";
import { appendPath } from "./paths.js";
import type { Registry } from "./registry.js";
import { isObject } from "./util.js";
import { findWidgetLists } from "./widgetTree.js";

export type DocumentKind = "page" | "screen" | "manifest";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

// Works out the kind of document from its top-level fields.
function guessKind(document: unknown): DocumentKind | undefined {
  if (!isObject(document)) return undefined;
  if ("sections" in document) return "page";
  if ("root" in document) return "screen";
  if ("theme" in document) return "manifest";
  return undefined;
}

export function validateDocument(registry: Registry, document: unknown, kind?: DocumentKind): ValidationResult {
  const documentKind = kind ?? guessKind(document);
  if (!documentKind) {
    return {
      valid: false,
      errors: [
        {
          path: "",
          message:
            'Cannot tell what kind of document this is. It should be a page (has "sections"), a screen (has "root") or a manifest (has "theme").',
        },
      ],
    };
  }

  const errors: ValidationIssue[] = [];

  // Step 1: the overall shape, checked by the JSON Schema file for this kind of document.
  const checkShape = registry.getSchema(`${documentKind}.json`);
  if (!checkShape(document)) errors.push(...issuesFromAjv(checkShape.errors ?? []));

  // Step 2: every widget's `data` has its own schema, chosen by the widget's type and version.
  visitWidgets(documentKind, document, (widget, path) => checkWidget(registry, widget, path, errors));

  return { valid: errors.length === 0, errors: removeRepeats(errors) };
}

function removeRepeats(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.path}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type WidgetVisitor = (widget: unknown, path: string) => void;

function visitWidgets(kind: DocumentKind, document: unknown, visit: WidgetVisitor): void {
  if (!isObject(document)) return;
  if (kind === "page" && Array.isArray(document.sections)) {
    document.sections.forEach((section, sectionIndex) => {
      if (!isObject(section) || !Array.isArray(section.widgets)) return;
      section.widgets.forEach((widget, widgetIndex) => visit(widget, `sections[${sectionIndex}].widgets[${widgetIndex}]`));
    });
  }
  if (kind === "screen") visitBlock(document.root, "root", visit);
}

function visitBlock(block: unknown, path: string, visit: WidgetVisitor): void {
  if (!isObject(block)) return;
  if (block.block === "widget") visit(block.widget, `${path}.widget`);
  if (Array.isArray(block.children)) {
    block.children.forEach((child, index) => visitBlock(child, `${path}.children[${index}]`, visit));
  }
}

function checkWidget(registry: Registry, widget: unknown, path: string, errors: ValidationIssue[]): void {
  // If the outer shape is broken, step 1 already reported it.
  if (!isObject(widget) || typeof widget.type !== "string" || !Number.isInteger(widget.v)) return;

  const info = registry.lookup(widget.type, widget.v as number);
  if (!info) {
    const versions = registry.knownVersions(widget.type);
    errors.push(
      versions.length === 0
        ? { path: appendPath(path, "type"), message: `Unknown widget type "${widget.type}".` }
        : {
            path: appendPath(path, "v"),
            message: `Widget "${widget.type}" has no version ${widget.v}. Known versions: ${versions.join(", ")}.`,
          },
    );
    return;
  }

  if (isObject(widget.data)) {
    const dataPath = appendPath(path, "data");
    if (!info.validateData(widget.data)) errors.push(...issuesFromAjv(info.validateData.errors ?? [], dataPath));
    // Widgets inside this widget (card children, carousel items, tab contents...) get the same checks.
    for (const slot of findWidgetLists(widget.data, info.children, dataPath)) {
      slot.widgets.forEach((child, index) => checkWidget(registry, child, `${slot.path}[${index}]`, errors));
    }
  }

  if (isObject(widget.fallback)) checkWidget(registry, widget.fallback, appendPath(path, "fallback"), errors);
}
```

- [ ] **Step 7: Write `sdui.ts`**

`packages/js/src/sdui.ts`:
```ts
import { createRegistry } from "./registry.js";
import { validateDocument, type DocumentKind } from "./validate.js";

export function createSdui() {
  const registry = createRegistry();
  return {
    validate: (document: unknown, kind?: DocumentKind) => validateDocument(registry, document, kind),
  };
}

// Ready-made instance that knows only the built-in widgets.
const builtIn = createSdui();
export const validate = builtIn.validate;
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: all PASS.

If one `problems` row fails, read the printed list of errors. Fix the message or path logic in `messages.ts` / `validate.ts`, not the test, unless the test row expects something the design does not say.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add validate() with plain-words errors that point at the wrong field"
```

---

### Task 6: `filterForClient()`

**Files:**
- Create: `packages/js/src/types.ts`, `packages/js/src/version.ts`, `packages/js/src/filter.ts`
- Modify: `packages/js/src/sdui.ts`
- Test: `packages/js/tests/filter.test.ts`

**Interfaces:**
- Consumes: `Registry`, `findWidgetLists`, `deepCopy`.
- Produces:
  - `version.ts`: `parseVersion(text: string): [number, number, number]`, `compareVersions(a: string, b: string): number` (negative, zero, positive).
  - `types.ts`: `Style`, `Action`, `Rules`, `Widget`, `Section`, `Page`, `Block`, `Screen`, `Manifest`, `ClientInfo`.
  - `filter.ts`: `filterDocument<T extends Page | Screen | Manifest>(registry: Registry, document: T, client: ClientInfo): T`.
  - `sdui.ts`: `createSdui()` now returns `{ validate, filterForClient }`; exported constant `filterForClient`.

- [ ] **Step 1: Write the types**

`packages/js/src/types.ts`:
```ts
export type SpacingToken = "none" | "xs" | "sm" | "md" | "lg" | "xl";
export type RadiusToken = "none" | "sm" | "md" | "lg" | "full";
export type ColorToken =
  | "primary" | "onPrimary" | "secondary" | "onSecondary"
  | "background" | "onBackground" | "surface" | "onSurface"
  | "muted" | "success" | "warning" | "error";
export type TextSizeToken = "caption" | "body" | "title" | "headline" | "display";
export type AlignToken = "start" | "center" | "end";

export interface Style {
  spacing?: SpacingToken;
  radius?: RadiusToken;
  color?: ColorToken;
  textColor?: ColorToken;
  textSize?: TextSizeToken;
  align?: AlignToken;
}

export type Action =
  | { type: "open_screen"; screenId: string }
  | { type: "open_sheet"; screenId: string }
  | { type: "open_url"; url: string; external?: boolean }
  | { type: "open_native"; name: string; params?: Record<string, unknown> }
  | { type: "call_api"; name: string; params?: Record<string, unknown> }
  | { type: "share"; text: string; url?: string }
  | { type: "dismiss" };

export interface Rules {
  countries?: string[];
  // The host app decides the keys. A client matches when, for every key, it has at least one listed value.
  audience?: Record<string, string[]>;
  minAppVersion?: string;
  from?: string;
  to?: string; // exclusive
}

export interface Widget {
  id: string;
  type: string;
  v: number;
  data: Record<string, any>;
  style?: Style;
  action?: Action;
  analytics?: { event: string; params?: Record<string, unknown> };
  rules?: Rules;
  fallback?: Widget | null;
}

export interface Section {
  id: string;
  title?: string;
  widgets: Widget[];
}

export interface Page {
  schema: 1;
  id: string;
  revision: string;
  title?: string;
  sections: Section[];
}

export type Block =
  | { block: "column" | "row"; children: Block[]; gap?: SpacingToken; style?: Style; action?: Action }
  | { block: "stack"; children: Block[]; style?: Style; action?: Action }
  | { block: "grid"; columns: number; children: Block[]; gap?: SpacingToken; style?: Style }
  | { block: "scroll"; children: Block[]; style?: Style }
  | { block: "text"; text: string; style?: Style; action?: Action }
  | { block: "image"; url: string; alt?: string; aspectRatio?: number; fit?: "cover" | "contain"; style?: Style; action?: Action }
  | { block: "button"; label: string; variant?: "filled" | "outline" | "text"; style?: Style; action?: Action }
  | { block: "spacer"; size: SpacingToken }
  | { block: "divider"; style?: Style }
  | { block: "widget"; widget: Widget };

export interface Screen {
  schema: 1;
  id: string;
  revision: string;
  title?: string;
  root: Block;
}

type Palette = Record<ColorToken, string>;

export interface Manifest {
  schema: 1;
  minAppVersion?: string;
  theme: {
    light: Palette;
    dark: Palette;
    fonts: { body: string; heading: string };
    textSizes: Record<TextSizeToken, number>;
    spacing: Record<SpacingToken, number>;
    radii: Record<RadiusToken, number>;
  };
  navigation: {
    bottomBar: Array<{ id: string; label: string; icon: string; pageId: string }>;
    pages: Array<{
      id: string;
      title: string;
      icon?: string;
      tabs?: Array<{ id: string; label: string; pageId: string }>;
    }>;
  };
  killSwitches?: { widgets?: string[]; actions?: string[] };
}

// Describes the app that is asking for a page.
export interface ClientInfo {
  appVersion: string; // like "1.2.0" ("1.2.0+45" and "1.2.0-beta" are accepted too)
  // Which widget types and versions this app can draw, e.g. { text: [1], banner: [1, 2] }.
  supportedWidgets: Record<string, number[]>;
  country?: string; // like "AE"
  audience?: Record<string, string | string[]>;
  now?: Date; // defaults to the current time; pass it in tests
}
```

- [ ] **Step 2: Write the failing tests**

`packages/js/tests/filter.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { builtInCatalogue } from "../src/registry";
import { filterForClient } from "../src/sdui";
import { compareVersions } from "../src/version";
import type { ClientInfo } from "../src/types";
import { page, screen, widget } from "./helpers";

// A client that can draw every built-in widget (version 1).
const supportedWidgets = Object.fromEntries(Object.keys(builtInCatalogue.types).map((type) => [type, [1]]));
const client = (changes: Partial<ClientInfo> = {}): ClientInfo => ({
  appVersion: "1.2.0",
  supportedWidgets,
  country: "AE",
  now: new Date("2026-11-15T12:00:00Z"),
  ...changes,
});

const text = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: "text", v: 1, data: { text: id }, ...extra });
const idsOf = (document: any) => document.sections.flatMap((section: any) => section.widgets.map((w: any) => w.id));

describe("compareVersions", () => {
  it("compares numbers, not text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("0.9.9", "1.0.0")).toBeLessThan(0);
  });
  it("ignores a build or beta suffix", () => expect(compareVersions("1.2.0+45", "1.2.0")).toBe(0));
  it("explains a version it cannot read", () => expect(() => compareVersions("one", "1.0.0")).toThrow('"one" is not a version like 1.2.0'));
});

describe("filterForClient: rules", () => {
  it("keeps widgets with no rules", () => {
    expect(idsOf(filterForClient(page(text("a"), text("b")), client()))).toEqual(["a", "b"]);
  });

  it("keeps a widget when the country matches and hides it otherwise", () => {
    const document = page(text("a", { rules: { countries: ["AE", "SA"] } }));
    expect(idsOf(filterForClient(document, client({ country: "AE" })))).toEqual(["a"]);
    expect(idsOf(filterForClient(document, client({ country: "IN" })))).toEqual([]);
    expect(idsOf(filterForClient(document, client({ country: undefined })))).toEqual([]);
  });

  it("hides a widget from apps that are too old", () => {
    const document = page(text("a", { rules: { minAppVersion: "1.2.0" } }));
    expect(idsOf(filterForClient(document, client({ appVersion: "1.2.0" })))).toEqual(["a"]);
    expect(idsOf(filterForClient(document, client({ appVersion: "1.1.9" })))).toEqual([]);
  });

  it("shows a widget only inside its schedule (the end time is exclusive)", () => {
    const document = page(text("a", { rules: { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" } }));
    const at = (iso: string) => idsOf(filterForClient(document, client({ now: new Date(iso) })));
    expect(at("2026-10-31T23:59:59Z")).toEqual([]);
    expect(at("2026-11-01T00:00:00Z")).toEqual(["a"]);
    expect(at("2026-11-30T23:59:59Z")).toEqual(["a"]);
    expect(at("2026-12-01T00:00:00Z")).toEqual([]);
  });

  it("matches the audience the host app defines", () => {
    const document = page(text("a", { rules: { audience: { careType: ["home", "clinic"], plan: ["gold"] } } }));
    const withAudience = (audience: ClientInfo["audience"]) => idsOf(filterForClient(document, client({ audience })));
    expect(withAudience({ careType: "home", plan: ["gold", "silver"] })).toEqual(["a"]);
    expect(withAudience({ careType: "home" })).toEqual([]); // plan is missing
    expect(withAudience({ careType: "video", plan: "gold" })).toEqual([]);
    expect(withAudience(undefined)).toEqual([]);
  });

  it("does not use the fallback when rules hide a widget (rules mean 'do not show')", () => {
    const document = page(text("a", { rules: { countries: ["US"] }, fallback: text("backup") }));
    expect(idsOf(filterForClient(document, client()))).toEqual([]);
  });
});

describe("filterForClient: what the app can draw", () => {
  it("removes a widget type the app does not support", () => {
    const document = page(text("a"), widget("banner", { imageUrl: "https://example.com/a.jpg" }, { id: "b" }));
    const old = client({ supportedWidgets: { text: [1] } });
    expect(idsOf(filterForClient(document, old))).toEqual(["a"]);
  });

  it("removes a version the app does not support", () => {
    const document = page({ ...text("a"), v: 2 });
    expect(idsOf(filterForClient(document, client()))).toEqual([]);
  });

  it("draws the fallback when the app cannot draw the widget", () => {
    const banner = widget("banner", { imageUrl: "https://example.com/a.jpg" }, { id: "b", fallback: text("backup") });
    const result: any = filterForClient(page(banner), client({ supportedWidgets: { text: [1] } }));
    expect(idsOf(result)).toEqual(["backup"]);
  });

  it("follows a chain of fallbacks and drops the widget if none can be drawn", () => {
    const banner = widget("banner", { imageUrl: "https://example.com/a.jpg" }, {
      id: "b",
      fallback: widget("carousel", { items: [text("x")] }, { id: "c", fallback: text("last") }),
    });
    expect(idsOf(filterForClient(page(banner), client({ supportedWidgets: { text: [1] } })))).toEqual(["last"]);
    expect(idsOf(filterForClient(page(banner), client({ supportedWidgets: {} })))).toEqual([]);
  });

  it("filters widgets inside cards, carousels, lists, grids and tabs", () => {
    const hidden = { rules: { countries: ["US"] } };
    const document = page(
      widget("carousel", { items: [text("c1"), text("c2", hidden)] }, { id: "carousel" }),
      widget("tabs", { tabs: [{ id: "t", label: "T", widgets: [text("t1"), text("t2", hidden)] }] }, { id: "tabs" }),
      widget("card", { title: "Card", children: [text("k1", hidden)] }, { id: "card" }),
    );
    const result: any = filterForClient(document, client());
    const [carousel, tabs, card] = result.sections[0].widgets;
    expect(carousel.data.items.map((w: any) => w.id)).toEqual(["c1"]);
    expect(tabs.data.tabs[0].widgets.map((w: any) => w.id)).toEqual(["t1"]);
    expect(card.data.children).toEqual([]);
  });

  it("drops a section that ends up with no widgets", () => {
    const document: any = page(text("a", { rules: { countries: ["US"] } }));
    document.sections.push({ id: "second", widgets: [text("b")] });
    const result: any = filterForClient(document, client());
    expect(result.sections.map((section: any) => section.id)).toEqual(["second"]);
  });

  it("keeps a widget type the package does not know if the app says it can draw it", () => {
    const custom = { id: "d", type: "doctor_card", v: 1, data: { name: "Dr A" } };
    const result = filterForClient(page(custom), client({ supportedWidgets: { doctor_card: [1] } }));
    expect(idsOf(result)).toEqual(["d"]);
  });
});

describe("filterForClient: screens and manifests", () => {
  it("removes hidden widget blocks from a screen", () => {
    const root = {
      block: "column",
      children: [
        { block: "text", text: "Hello" },
        { block: "widget", widget: text("a", { rules: { countries: ["US"] } }) },
        { block: "row", children: [{ block: "widget", widget: text("b") }] },
      ],
    };
    const result: any = filterForClient(screen(root), client());
    expect(result.root.children).toHaveLength(2);
    expect(result.root.children[1].children[0].widget.id).toBe("b");
  });

  it("leaves an empty column if the whole screen root is a hidden widget", () => {
    const root = { block: "widget", widget: text("a", { rules: { countries: ["US"] } }) };
    const result: any = filterForClient(screen(root), client());
    expect(result.root).toEqual({ block: "column", children: [] });
  });

  it("returns a manifest unchanged", () => {
    const manifest: any = { schema: 1, theme: {}, navigation: {} };
    expect(filterForClient(manifest, client())).toEqual(manifest);
  });
});

describe("filterForClient: safety", () => {
  it("does not change the document it was given", () => {
    const document = page(text("a"), text("b", { rules: { countries: ["US"] } }));
    const before = JSON.stringify(document);
    filterForClient(document, client());
    expect(JSON.stringify(document)).toBe(before);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test -- tests/filter.test.ts`
Expected: FAIL: cannot find module `../src/version`.

- [ ] **Step 4: Write `version.ts`**

`packages/js/src/version.ts`:
```ts
// Reads "1.2.0", "1.2.0+45" or "1.2.0-beta" as three numbers. Anything after the third number is ignored.
export function parseVersion(text: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(text);
  if (!match) throw new Error(`"${text}" is not a version like 1.2.0`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Negative if a is older than b, zero if the same, positive if a is newer.
export function compareVersions(a: string, b: string): number {
  const first = parseVersion(a);
  const second = parseVersion(b);
  for (let index = 0; index < 3; index++) {
    if (first[index] !== second[index]) return first[index] < second[index] ? -1 : 1;
  }
  return 0;
}
```

- [ ] **Step 5: Write `filter.ts`**

`packages/js/src/filter.ts`:
```ts
import type { Registry } from "./registry.js";
import type { Block, ClientInfo, Manifest, Page, Rules, Screen, Widget } from "./types.js";
import { deepCopy } from "./util.js";
import { compareVersions } from "./version.js";
import { findWidgetLists } from "./widgetTree.js";

interface FilterContext {
  registry: Registry;
  client: ClientInfo & { now: Date };
}

// Returns a copy of the document with everything this client must not receive taken out.
// The document passed in is never changed.
export function filterDocument<T extends Page | Screen | Manifest>(registry: Registry, document: T, client: ClientInfo): T {
  const context: FilterContext = { registry, client: { ...client, now: client.now ?? new Date() } };
  const copy: Page | Screen | Manifest = deepCopy(document);

  if ("sections" in copy) {
    copy.sections = copy.sections
      .map((section) => ({ ...section, widgets: filterWidgets(context, section.widgets) }))
      // A section with nothing left to show would only leave an empty gap or a lonely title.
      .filter((section) => section.widgets.length > 0);
  } else if ("root" in copy) {
    copy.root = filterBlock(context, copy.root) ?? { block: "column", children: [] };
  }
  return copy as T;
}

function filterWidgets(context: FilterContext, widgets: Widget[]): Widget[] {
  const kept: Widget[] = [];
  for (const widget of widgets) {
    const result = resolveWidget(context, widget);
    if (result) kept.push(result);
  }
  return kept;
}

// Decides what to send for one widget: itself, its fallback, or nothing.
// Works on the private copy made in filterDocument, so it may change the widget in place.
function resolveWidget(context: FilterContext, widget: Widget): Widget | null {
  // Rules mean "do not show this to this person", so the fallback is not used here.
  if (!passesRules(widget.rules, context.client)) return null;

  const canDraw = context.client.supportedWidgets[widget.type]?.includes(widget.v) ?? false;
  if (!canDraw) return widget.fallback ? resolveWidget(context, widget.fallback) : null;

  // A widget type the package does not know (an app's own widget) is treated as having no children.
  const childLists = context.registry.lookup(widget.type, widget.v)?.children ?? [];
  for (const slot of findWidgetLists(widget.data, childLists, "")) {
    slot.owner[slot.key] = filterWidgets(context, slot.widgets as Widget[]);
  }

  if (widget.fallback) {
    const fallback = resolveWidget(context, widget.fallback);
    if (fallback) widget.fallback = fallback;
    else delete widget.fallback;
  }
  return widget;
}

function filterBlock(context: FilterContext, block: Block): Block | null {
  if (block.block === "widget") {
    const widget = resolveWidget(context, block.widget);
    return widget ? { ...block, widget } : null;
  }
  if ("children" in block) {
    block.children = block.children
      .map((child) => filterBlock(context, child))
      .filter((child): child is Block => child !== null);
  }
  return block;
}

function passesRules(rules: Rules | undefined, client: FilterContext["client"]): boolean {
  if (!rules) return true;

  if (rules.countries && (!client.country || !rules.countries.includes(client.country))) return false;

  if (rules.minAppVersion && compareVersions(client.appVersion, rules.minAppVersion) < 0) return false;

  if (rules.from && client.now < new Date(rules.from)) return false;
  if (rules.to && client.now >= new Date(rules.to)) return false;

  for (const [key, allowedValues] of Object.entries(rules.audience ?? {})) {
    const clientValues = [client.audience?.[key] ?? []].flat();
    if (!clientValues.some((value) => allowedValues.includes(value))) return false;
  }
  return true;
}
```

- [ ] **Step 6: Update `sdui.ts`**

Replace `packages/js/src/sdui.ts`:
```ts
import { filterDocument } from "./filter.js";
import { createRegistry } from "./registry.js";
import type { ClientInfo, Manifest, Page, Screen } from "./types.js";
import { validateDocument, type DocumentKind } from "./validate.js";

export function createSdui() {
  const registry = createRegistry();
  return {
    validate: (document: unknown, kind?: DocumentKind) => validateDocument(registry, document, kind),
    filterForClient: <T extends Page | Screen | Manifest>(document: T, client: ClientInfo): T =>
      filterDocument(registry, document, client),
  };
}

// Ready-made instance that knows only the built-in widgets.
const builtIn = createSdui();
export const validate = builtIn.validate;
export const filterForClient = builtIn.filterForClient;
```

- [ ] **Step 7: Run all tests and the type check**

Run: `npm test` then `npm run typecheck --workspace sduikit`
Expected: all tests PASS; typecheck prints no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add filterForClient: rules, supported widgets, fallbacks and screens"
```

---

### Task 7: Apps' own widgets (extra widget definitions)

An app such as Medivoy has widgets the package does not ship (a doctor card). The server must still be able to validate and filter pages that contain them. `createSdui({ extraWidgets })` registers them.

**Files:**
- Modify: `packages/js/src/registry.ts`, `packages/js/src/sdui.ts`
- Test: `packages/js/tests/custom-widgets.test.ts`

**Interfaces:**
- Consumes: `createRegistry`, `createSdui` (Tasks 3, 6).
- Produces: `interface WidgetDefinition { schema: Record<string, unknown>; children?: string[] }`, `type ExtraWidgets = Record<string, Record<number, WidgetDefinition>>` (type name, then version number, then definition), `createRegistry(extraWidgets?: ExtraWidgets)`, `createSdui(options?: { extraWidgets?: ExtraWidgets })`.

- [ ] **Step 1: Write the failing tests**

`packages/js/tests/custom-widgets.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createSdui } from "../src/sdui";
import { builtInCatalogue } from "../src/registry";
import { page, widget } from "./helpers";

const doctorCard = {
  doctor_card: {
    1: {
      schema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          specialty: { type: "string" },
          related: { type: "array", items: { $ref: "https://sduikit.dev/schemas/common/widget.json" } },
        },
        required: ["name"],
        additionalProperties: false,
      },
      children: ["related"],
    },
  },
};

describe("apps' own widgets", () => {
  const sdui = createSdui({ extraWidgets: doctorCard });

  it("validates good data for an app's own widget", () => {
    expect(sdui.validate(page(widget("doctor_card", { name: "Dr A", specialty: "Dentist" }))).valid).toBe(true);
  });

  it("reports bad data for an app's own widget with the path", () => {
    const result = sdui.validate(page(widget("doctor_card", { specialty: "Dentist" })));
    expect(result.errors.map((issue) => issue.path)).toEqual(["sections[0].widgets[0].data.name"]);
  });

  it("checks widgets nested inside an app's own widget", () => {
    const inner = widget("text", { text: "" });
    const result = sdui.validate(page(widget("doctor_card", { name: "Dr A", related: [inner] })));
    expect(result.errors.map((issue) => issue.path)).toEqual(["sections[0].widgets[0].data.related[0].data.text"]);
  });

  it("filters widgets nested inside an app's own widget", () => {
    const hidden = { id: "h", type: "text", v: 1, data: { text: "x" }, rules: { countries: ["US"] } };
    const document = page(widget("doctor_card", { name: "Dr A", related: [hidden] }));
    const result: any = sdui.filterForClient(document, {
      appVersion: "1.0.0",
      supportedWidgets: { doctor_card: [1], text: [1] },
      country: "AE",
    });
    expect(result.sections[0].widgets[0].data.related).toEqual([]);
  });

  it("does not leak into the ready-made instance", () => {
    const plain = createSdui();
    expect(plain.validate(page(widget("doctor_card", { name: "Dr A" }))).valid).toBe(false);
  });

  it("refuses to redefine a built-in widget", () => {
    expect(() => createSdui({ extraWidgets: { text: { 1: { schema: { type: "object" } } } } })).toThrow(
      'The widget type "text" is built in and cannot be redefined',
    );
  });

  it("refuses a type name that breaks the naming rule", () => {
    expect(() => createSdui({ extraWidgets: { DoctorCard: { 1: { schema: { type: "object" } } } } })).toThrow(
      'The widget type name "DoctorCard" must be lower_snake_case',
    );
  });

  it("still knows the built-in widgets", () => {
    expect(Object.keys(builtInCatalogue.types)).toContain("text");
    expect(sdui.validate(page(widget("text", { text: "Hi" }))).valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- tests/custom-widgets.test.ts`
Expected: FAIL (the `extraWidgets` option is ignored, so `doctor_card` is reported as unknown).

- [ ] **Step 3: Update `registry.ts`**

Add these exports above `createRegistry`:
```ts
export interface WidgetDefinition {
  // JSON Schema for the widget's `data` object.
  schema: Record<string, unknown>;
  // Where the data holds other widgets, same notation as the catalogue: "items" or "tabs[].widgets".
  children?: string[];
}

// Widget type name -> version number -> definition.
export type ExtraWidgets = Record<string, Record<number, WidgetDefinition>>;
```

Change the signature `export function createRegistry(): Registry {` to:
```ts
export function createRegistry(extraWidgets: ExtraWidgets = {}): Registry {
```

Insert this block directly after the `for (const [type, entry] of Object.entries(builtInCatalogue.types)) { ... }` loop and before `function getSchema`:
```ts
  for (const [type, versionDefinitions] of Object.entries(extraWidgets)) {
    if (widgetTypes.has(type)) throw new Error(`The widget type "${type}" is built in and cannot be redefined.`);
    if (!/^[a-z][a-z0-9_]*$/.test(type)) throw new Error(`The widget type name "${type}" must be lower_snake_case.`);
    const versions = new Map<number, WidgetEntry>();
    for (const [version, definition] of Object.entries(versionDefinitions)) {
      const schemaKey = `${SCHEMA_BASE}custom/${type}.v${version}.json`;
      ajv.addSchema({ ...definition.schema, $id: schemaKey }, schemaKey);
      versions.set(Number(version), { schemaKey, children: definition.children ?? [] });
    }
    widgetTypes.set(type, versions);
  }
```

Note: the name check runs after the built-in check, so `"text"` reports "built in" and `"DoctorCard"` reports the naming rule.

- [ ] **Step 4: Update `sdui.ts`**

Change the top of `packages/js/src/sdui.ts`:
```ts
import { filterDocument } from "./filter.js";
import { createRegistry, type ExtraWidgets } from "./registry.js";
import type { ClientInfo, Manifest, Page, Screen } from "./types.js";
import { validateDocument, type DocumentKind } from "./validate.js";

export interface SduiOptions {
  // Widgets that belong to the app, not to this package (for example a doctor card).
  extraWidgets?: ExtraWidgets;
}

export function createSdui(options: SduiOptions = {}) {
  const registry = createRegistry(options.extraWidgets);
```
(the rest of the file is unchanged).

- [ ] **Step 5: Run everything**

Run: `npm test` then `npm run typecheck --workspace sduikit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Let apps register their own widgets with createSdui"
```

---

### Task 8: Public exports, token lists, build and smoke test

**Files:**
- Create: `packages/js/src/tokens.ts`, `packages/js/src/index.ts`
- Test: `packages/js/tests/tokens.test.ts`, `packages/js/tests/build.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces (public API of `sduikit`): `validate`, `filterForClient`, `createSdui`, `tokens`, `builtInCatalogue`, and the types `ValidationIssue`, `ValidationResult`, `DocumentKind`, `SduiOptions`, `WidgetDefinition`, `ExtraWidgets`, plus everything in `types.ts`.

- [ ] **Step 1: Write the failing tests**

`packages/js/tests/tokens.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { tokens } from "../src/index";

describe("tokens", () => {
  it("lists the token names the schemas allow", () => {
    expect(tokens.spacing).toEqual(["none", "xs", "sm", "md", "lg", "xl"]);
    expect(tokens.radius).toEqual(["none", "sm", "md", "lg", "full"]);
    expect(tokens.textSize).toEqual(["caption", "body", "title", "headline", "display"]);
    expect(tokens.align).toEqual(["start", "center", "end"]);
    expect(tokens.color).toHaveLength(12);
    expect(tokens.color).toContain("onPrimary");
  });
});
```

`packages/js/tests/build.test.ts`:
```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./helpers";

describe("built package", () => {
  it("builds and works when loaded by plain Node", () => {
    const packageFolder = join(repoRoot, "packages", "js");
    execFileSync("npm", ["run", "build"], { cwd: packageFolder, shell: true, stdio: "pipe" });

    const scratch = mkdtempSync(join(tmpdir(), "sduikit-smoke-"));
    const script = join(scratch, "smoke.mjs");
    const entry = join(packageFolder, "dist", "index.js").split("\\").join("/");
    writeFileSync(
      script,
      `import { validate } from "file:///${entry}";
       const good = validate({ schema: 1, id: "p", revision: "1", sections: [] });
       const bad = validate({ schema: 1, id: "p", revision: "1", sections: [{ id: "s", widgets: [{ id: "w", type: "nope", v: 1, data: {} }] }] });
       console.log(JSON.stringify({ good: good.valid, bad: bad.valid }));`,
    );
    const output = execFileSync("node", [script], { encoding: "utf8" });
    expect(JSON.parse(output)).toEqual({ good: true, bad: false });
  }, 60_000);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npm test -- tests/tokens.test.ts tests/build.test.ts`
Expected: FAIL: cannot find module `../src/index`.

- [ ] **Step 3: Write `tokens.ts` and `index.ts`**

`packages/js/src/tokens.ts`:
```ts
import { schemaFiles } from "./generated/schemas.js";

interface TokenFile {
  $defs: Record<"spacing" | "radius" | "color" | "textSize" | "align", { enum: string[] }>;
}

const definitions = (schemaFiles["common/tokens.json"] as TokenFile).$defs;

// The token names a widget's `style` may use. Read from the schema so the two can never disagree.
// A dashboard can use these lists to build dropdowns.
export const tokens = {
  spacing: definitions.spacing.enum,
  radius: definitions.radius.enum,
  color: definitions.color.enum,
  textSize: definitions.textSize.enum,
  align: definitions.align.enum,
};
```

`packages/js/src/index.ts`:
```ts
export { createSdui, filterForClient, validate } from "./sdui.js";
export type { SduiOptions } from "./sdui.js";
export { builtInCatalogue } from "./registry.js";
export type { ExtraWidgets, WidgetDefinition } from "./registry.js";
export type { DocumentKind, ValidationResult } from "./validate.js";
export type { ValidationIssue } from "./messages.js";
export { tokens } from "./tokens.js";
export * from "./types.js";
```

- [ ] **Step 4: Run all tests, the type check and the build**

Run: `npm test` then `npm run typecheck --workspace sduikit`
Expected: everything PASS (the build test runs `tsc` and loads `dist/index.js` with plain Node, so it proves the compiled package works outside Vitest).

- [ ] **Step 5: Update the README**

Replace `README.md`:
```markdown
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
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the public exports, token lists, a build check and the README quick look"
```

---

## Self-Review (done while writing this plan)

**Spec coverage (sections 4, 5 and 8 for the schema and JS parts):**

| Spec item | Where |
|---|---|
| 4.1 manifest (theme, navigation, killSwitches, minAppVersion, schema) | Task 4 `manifest.json` |
| 4.2 page, widget envelope, rules, fallback | Tasks 2, 4 |
| 4.3 blocks incl. embedded widget | Task 4 `blocks/block.json` |
| 4.4 the seven actions | Task 2 `action.json` |
| 4.5 one schema per widget type/version, `catalogue.json` with first package version | Task 3 |
| 5 `validate` with plain errors and paths | Task 5 |
| 5 `filterForClient` (version, types, country, audience, time; unknown removed) | Task 6 |
| 5 types and token definitions | Tasks 6, 8 (types are hand-written; noted at top) |
| 5 `sduikit/vue` | **Not in this plan.** Plan 2. |
| 7 unknown type/version -> skip or fallback (server side) | Task 6 |
| 7 kill switches | Data lives in the manifest (Task 4); applying them is the app's job (Flutter plan). |
| 8 JS unit tests for validate and filter | Tasks 5, 6, 7 |
| 8 shared fixtures | Task 4 (the Flutter side uses them in plan 3) |
| 9 MIT licence, README | Tasks 1, 8 (`CONTRIBUTING`, `CHANGELOG`, CI come with the docs/release step) |
| Section 3: apps register their own widgets | Task 7 (a gap in the design text, found while planning) |

**Not in this plan on purpose:** the compatibility test for old sample pages (needs a second schema version to mean anything), GitHub Actions, publishing.

**Placeholder scan:** none; every code step has the code.

**Type consistency:** `Registry.lookup/knownVersions/getSchema`, `WidgetInfo.children/validateData`, `findWidgetLists`/`WidgetSlot`, `issuesFromAjv`, `validateDocument`, `filterDocument`, `createSdui`, `ExtraWidgets` are used with the same names and signatures in every task that mentions them.

**Things this plan does not prove (found by reading, not by running):** the Ajv behaviours the schemas rely on (relative `$ref` across files, recursion, `discriminator` in strict mode, and the import style under TypeScript and plain Node) were checked with a small test on 2026-11-01. The rest of the code in this plan has not been run yet. If a step's "Expected" line does not match, fix the code and note it.

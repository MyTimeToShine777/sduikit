# Contributing to sduikit

Thank you for helping. This page explains how the repo is organised and how to make a change.

## How the repo fits together

- `schemas/` is the format and the single source of truth. Change a schema here first.
- `fixtures/valid/` are sample documents that every package tests against.
- `packages/js/` is the npm package (`validate`, `filterForClient`, Vue pieces).
- `examples/server/` is a tiny server that proves a saved change reaches apps right away.

## Setting up

```
npm install
npm test               # the JavaScript package tests
npm run test:example   # the example server, end to end
```

You need Node 22.12 or newer (Node 24 is what the project is developed on).

## Changing a schema

1. Edit the file in `schemas/`.
2. Run `npm run schemas`. This copies the schemas into `packages/js/src/generated/schemas.ts`.
   A test fails if you forget.
3. Run `npm test`.

## Adding or changing a widget

- **A new widget:** add `schemas/widgets/<name>.v1.json`, list it in `schemas/catalogue.json`
  (with `since` set to the package version that first ships it), add a case to
  `packages/js/tests/widgets.test.ts`, and use it in a sample file in `fixtures/valid/`.
  The tests check that every widget in the catalogue appears in a sample file.
- **A change that would break old apps** (renaming a field, making an optional field required,
  removing a value) must be a new version, `<name>.v2.json`, not an edit of `v1`. Old apps
  keep asking for `v1`, so `v1` must keep working.
- Style values are token names only. Never add pixels or hex codes to a widget's `style`.

## Style of code and words

- Clear names (`overdueFollowUps`, not `ofu`).
- Short comments that say **why**, not what the line does.
- Error messages are written for the person who has to fix the problem, in everyday words.

## Pull requests

- Keep each pull request to one change.
- Say what you tested. Tests that fail before your change and pass after it are the best proof.
- Do not add dependencies unless there is no simple alternative.

## Licence

By contributing you agree that your contribution is released under the MIT licence.

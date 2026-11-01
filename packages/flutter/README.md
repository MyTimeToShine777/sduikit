# sduikit (Flutter)

Draws server-driven screens described by JSON: pages made of ready-made widgets, custom screens
made of building blocks, and the app theme. See the repo root README for the whole project.

> **Status: written but never compiled or run.** The code and tests in this folder were written
> without a Flutter SDK. Expect some compile errors and failing tests on the first run. Fixing
> them is the first job (see "First run" below).

## First run (for the Flutter developer)

Needs Flutter 3.35 or newer (Dart 3.9 or newer).

```
cd packages/flutter
flutter pub get
flutter analyze
flutter test
```

- The tests read the shared sample files in `../../fixtures/valid/`, so run them from this folder.
- Fix whatever `flutter analyze` and `flutter test` report. If a test and the code disagree,
  decide which one is right using the design in `docs/superpowers/specs/2026-11-01-sduikit-design.md`
  (section 6 and section 7, "Errors and safety").
- Then do the example app: `cd ../../examples/app`, run `flutter create .` to add the Android/iOS
  folders, `flutter pub get`, and start the example server from the repo root with
  `npm run build --workspace sduikit` then `npm start --workspace sduikit-example-server`.
  Run the app and check that the home page appears.

## What is in the package

| File | What it does |
|---|---|
| `lib/src/theme.dart` | Turns the manifest `theme` into `ThemeData` and a token lookup (`context.sduiTokens`). |
| `lib/src/registry.dart` | Maps widget `type` + `v` to code. Your app adds its own widgets here. |
| `lib/src/builtin_widgets.dart` | The 12 starter widgets (text, image, button, spacer, divider, section_header, card, banner, carousel, list, grid, tabs). |
| `lib/src/blocks.dart` | The building blocks for custom screens (column, row, stack, grid, scroll, text, image, button, spacer, divider, widget). |
| `lib/src/render.dart` | Draws widgets safely: one broken widget is skipped (or replaced by its fallback), reported, and the rest is drawn. |
| `lib/src/actions.dart` | Runs actions (open screen/sheet/url/native, call API, share, dismiss). The app supplies the handlers. |
| `lib/src/view.dart` | `SduiView`: loads a page or screen, shows grey placeholders, keeps a saved copy, times out, offers "Try again". |
| `lib/src/client.dart` | `SduiClient` (how your app calls its API) and `SduiCache` (the saved copy). You implement both. |

## Using it in an app

```dart
final registry = SduiWidgetRegistry.withBuiltIns()
  ..register('doctor_card', 1, (context, node, render) => DoctorCard(name: node.requireString('name')));

final render = SduiRender(
  registry: registry,
  actions: SduiActionHandler(
    onOpenScreen: (context, id) => /* your navigation */,
    onCallApi: (name, params) async => /* your API */,
    nativeScreens: {'booking': (context, params) => /* open the built-in booking screen */},
  ),
  onError: (error, stackTrace) => /* send to your error reporting */,
  onAnalytics: (event, params) => /* send to your analytics */,
);

// Tell the server what this app can draw, on every request: registry.supported
// e.g. {'text': [1], 'banner': [1], 'doctor_card': [1]}

SduiView(kind: SduiDocumentKind.page, id: 'home', client: myClient, render: render, cache: myCache)
```

Use `sduiThemeData(manifest['theme'])` as the app's `ThemeData` so tokens like `md` and `primary`
match what the server says.

## Known gaps in version 0.1.0

- The carousel's `autoplay` setting is accepted but does not animate yet.
- `MemorySduiCache` forgets everything when the app closes. For the offline copy to survive a
  restart, write a `SduiCache` that stores the JSON on disk (for example with `shared_preferences`).
- The loading placeholders are static grey boxes (no shimmer).
- Lottie animations are not included; the design makes them an optional add-on package.

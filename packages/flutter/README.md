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
| `lib/src/builtin_widgets.dart` | The first widgets (text, image, button, spacer, divider, section_header, card, banner, carousel, list, grid, tabs, data_list, form), and the place where all 38 are registered. |
| `lib/src/display_widgets.dart` | Widgets that show information: rich_text, quote, icon, avatar, badge, alert, progress, stat, key_value, list_item, empty_state, rating, table, steps. |
| `lib/src/interactive_widgets.dart` | Widgets people tap or that change: search_bar, chips, quick_actions, accordion, countdown, gallery, video_card, hero, pricing_card, container. |
| `lib/src/form_widget.dart` | The form: text, email, number, multiline, password, date, select, checkbox and switch fields, with checks. |
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

## Live data (the `data_list` widget)

A `data_list` asks your app for rows and draws its template once per row, filling `{{field}}`
from each row. You give the package one function:

```dart
SduiRender(
  registry: registry,
  dataLoader: (name, params) async {
    // name is what the page says, e.g. "doctors_nearby"; params e.g. {'city': 'Dubai'}
    final rows = await myApi.get('/$name', params);
    return List<Map<String, dynamic>>.from(rows);
  },
);
```

A field the row does not have is left out, never invented. Without a `dataLoader` the list is
skipped (or its fallback is drawn) and the error hook is called.

## Keeping the saved copy on the phone

`MemorySduiCache` forgets everything when the app closes. For a copy that survives a restart:

```dart
import 'package:sduikit/io.dart';
SduiView(..., cache: FileSduiCache(Directory('${supportDirectory.path}/sduikit')))
```

## Right-to-left languages

Layout follows the app's text direction (Arabic works), because the package uses start/end
alignment and ordinary Rows and Columns. Test it with your own Arabic text.

## Known gaps in version 0.2.0

- `FileSduiCache` uses `dart:io`, so it does not work in a web build.
- The loading placeholders are static grey boxes (no shimmer).
- Lottie animations are not included; the design makes them an optional add-on package.

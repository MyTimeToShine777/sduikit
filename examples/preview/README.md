# sduikit preview

A Flutter **web** page that draws a sduikit page *exactly* like the app does, because it uses the same
`sduikit` Flutter package, the same widgets and the same theme. A dashboard shows it inside a
phone-sized frame so staff see what patients or customers will see.

> **Status: written, never built.** It needs a Flutter SDK (3.35 or newer), which the author did not
> have. The first job for a Flutter developer is to build it and fix whatever the compiler reports.

## Build it

```sh
cd examples/preview
flutter pub get
flutter build web --release --base-href /sduikit-preview/
```

Then copy everything in `build/web/` to the dashboard's public folder as `sduikit-preview/`, so that
`/sduikit-preview/index.html` opens it. (For the Medivoy internal dashboard:
`medivoy-internal.dash/public/sduikit-preview/`.) The dashboard notices the file and switches from
its quick HTML preview to this exact one.

## For the preview to be truly exact

- **Use the app's real fonts.** The theme names the fonts (`fonts.body`, `fonts.heading`). Flutter web
  only uses a font that is bundled with this preview, so add the same font files to this app's
  `pubspec.yaml` that the real app uses. Without them it falls back to a default font.
- **Use the same Flutter and package versions as the app**, so spacing and text behave the same.
- Register the app's **own widgets** in `lib/main.dart` (next to `SduiWidgetRegistry.withBuiltIns()`),
  otherwise they show as skipped.

## How the dashboard talks to it

It is an `<iframe>`. The dashboard sends the page and the theme with `postMessage`:

| From | Message |
|---|---|
| dashboard → preview | `{ type: "sduikit-preview", document, theme, dark, dataSamples }` (an object) |
| preview → dashboard | `"sduikit-preview-ready"` once, when it can receive |
| preview → dashboard | JSON text `{ "type": "sduikit-preview-problem", "message": "…" }` when a widget is skipped or fails |
| preview → dashboard | JSON text `{ "type": "sduikit-preview-tap", "description": "…" }` when a widget with an action is tapped |

`theme` is the `theme` part of the manifest, `dark` switches the phone to dark mode, and
`dataSamples` holds example rows for `data_list` widgets, by name (for example
`{ "doctors_nearby": [ { "name": "Dr Rao" } ] }`). Taps never do anything for real in the preview.

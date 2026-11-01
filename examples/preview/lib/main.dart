// A page that draws a sduikit page the way the real app does (same package, same widgets, same theme).
// A dashboard puts it in an <iframe> inside a phone-sized frame and talks to it with postMessage:
//
//   dashboard -> preview   { type: "sduikit-preview", document: {...}, theme: {...}, dark: false,
//                            dataSamples: { "doctors_nearby": [ {...}, ... ] } }
//   preview -> dashboard   "sduikit-preview-ready"                        (once, when it can receive)
//   preview -> dashboard   { type: "sduikit-preview-problem", message }   (a widget was skipped or failed)
//   preview -> dashboard   { type: "sduikit-preview-tap", description }   (a tap on a widget with an action)
//
// Taps do not do anything for real here; they only tell the dashboard what would have happened.
import 'dart:collection';
import 'dart:convert';
import 'dart:js_interop';

import 'package:flutter/material.dart';
import 'package:sduikit/sduikit.dart';
import 'package:web/web.dart' as web;

void main() => runApp(const PreviewApp());

// Everything arrives as JavaScript objects. Turning them into JSON text and back gives plain Dart maps and lists.
Map<String, dynamic>? _asMap(JSAny? value) {
  if (value == null) return null;
  final plain = value.dartify();
  if (plain == null) return null;
  final decoded = jsonDecode(jsonEncode(plain));
  return decoded is Map<String, dynamic> ? decoded : null;
}

// Sends a message to the page around this one. A plain text goes as it is; anything else goes as JSON text,
// which the dashboard reads back with JSON.parse.
void _tellDashboard(Object message) {
  final text = message is String ? message : jsonEncode(message);
  web.window.parent?.postMessage(text.toJS, '*'.toJS);
}

class PreviewApp extends StatefulWidget {
  const PreviewApp({super.key});

  @override
  State<PreviewApp> createState() => _PreviewAppState();
}

class _PreviewAppState extends State<PreviewApp> {
  Map<String, dynamic>? _document;
  Map<String, dynamic> _theme = const {};
  bool _dark = false;
  Map<String, List<Map<String, dynamic>>> _dataSamples = {};
  final _messenger = GlobalKey<ScaffoldMessengerState>();

  late final SduiRender _render = SduiRender(
    registry: SduiWidgetRegistry.withBuiltIns(),
    // Nothing is opened or called in a preview; the dashboard is told what a tap would do.
    actions: SduiActionHandler(
      onOpenScreen: (context, id) => _tapped('Open the screen "$id"'),
      onOpenSheet: (context, id) => _tapped('Open "$id" as a bottom sheet'),
      onOpenUrl: (url, external) => _tapped('Open $url${external ? ' in the browser' : ''}'),
      onShare: (text, url) => _tapped('Share "$text"'),
      onCallApi: (name, params) async => _tapped('Call "$name" with $params'),
      onDismiss: (context) => _tapped('Close this screen'),
      nativeScreens: _AnyName(_tapped),
      onError: (error, stackTrace) => _tellDashboard({'type': 'sduikit-preview-problem', 'message': '$error'}),
    ),
    dataLoader: (name, params) async => _dataSamples[name] ?? const [],
    onError: (error, stackTrace) => _tellDashboard({'type': 'sduikit-preview-problem', 'message': '$error'}),
  );

  @override
  void initState() {
    super.initState();
    web.window.addEventListener('message', _onMessage.toJS);
    _tellDashboard('sduikit-preview-ready');
  }

  late final JSFunction _onMessage = ((web.MessageEvent event) {
    final data = _asMap(event.data);
    if (data == null || data['type'] != 'sduikit-preview') return;
    final document = data['document'];
    final samples = <String, List<Map<String, dynamic>>>{};
    final rawSamples = data['dataSamples'];
    if (rawSamples is Map) {
      for (final entry in rawSamples.entries) {
        if (entry.value is List) {
          samples['${entry.key}'] = [for (final row in entry.value as List) if (row is Map) Map<String, dynamic>.from(row)];
        }
      }
    }
    setState(() {
      _document = document is Map ? Map<String, dynamic>.from(document) : null;
      _theme = data['theme'] is Map ? Map<String, dynamic>.from(data['theme'] as Map) : const {};
      _dark = data['dark'] == true;
      _dataSamples = samples;
    });
  }).toJS;

  void _tapped(String description) {
    _tellDashboard({'type': 'sduikit-preview-tap', 'description': description});
    _messenger.currentState?.showSnackBar(SnackBar(content: Text('Tapped: $description'), duration: const Duration(seconds: 2)));
  }

  @override
  void dispose() {
    web.window.removeEventListener('message', _onMessage);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final document = _document;
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: _messenger,
      theme: sduiThemeData(_theme),
      darkTheme: sduiThemeData(_theme, brightness: Brightness.dark),
      themeMode: _dark ? ThemeMode.dark : ThemeMode.light,
      home: Scaffold(
        body: SafeArea(
          child: document == null || !SduiContent.canDraw(document)
              ? const Center(child: Text('Waiting for a page…'))
              : SduiContent(document: document, render: _render),
        ),
      ),
    );
  }
}

/// Lets any `open_native` name work in a preview, instead of needing every built-in screen of the app.
class _AnyName extends MapBase<String, SduiNativeScreen> {
  _AnyName(this._onTap);

  final void Function(String) _onTap;

  @override
  SduiNativeScreen? operator [](Object? key) =>
      key is String ? (context, params) => _onTap('Open the app screen "$key"${params.isEmpty ? '' : ' with $params'}') : null;

  @override
  void operator []=(String key, SduiNativeScreen value) {}

  @override
  void clear() {}

  @override
  Iterable<String> get keys => const [];

  @override
  SduiNativeScreen? remove(Object? key) => null;
}

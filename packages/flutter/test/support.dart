import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:sduikit/sduikit.dart';

/// Reads one of the shared sample files from /fixtures (tests run from packages/flutter).
Map<String, dynamic> loadFixture(String name) {
  final text = File('../../fixtures/valid/$name').readAsStringSync();
  return jsonDecode(text) as Map<String, dynamic>;
}

/// A page with one section holding the given widgets.
Map<String, dynamic> pageWith(List<Map<String, dynamic>> widgets) => {
      'schema': 1,
      'id': 'p',
      'revision': '1',
      'sections': [
        {'id': 's', 'widgets': widgets},
      ],
    };

Map<String, dynamic> textWidget(String id, String text) =>
    {'id': id, 'type': 'text', 'v': 1, 'data': {'text': text}};

/// A client that answers from a function, so each test decides what the "server" says.
class FakeClient implements SduiClient {
  FakeClient(this.respond);

  final Future<Map<String, dynamic>> Function() respond;
  int calls = 0;

  @override
  Future<Map<String, dynamic>> fetchPage(String id) {
    calls++;
    return respond();
  }

  @override
  Future<Map<String, dynamic>> fetchScreen(String id) {
    calls++;
    return respond();
  }

  @override
  Future<Map<String, dynamic>> fetchManifest() => respond();
}

/// Collects everything the package reports, so tests can check it.
class Reports {
  final errors = <Object>[];
  final analytics = <MapEntry<String, Map<String, dynamic>>>[];
}

/// The rows the "doctors_nearby" list gets in tests. The second doctor has no photo.
final sampleDoctors = <Map<String, dynamic>>[
  {'id': 7, 'name': 'Dr Rao', 'specialty': 'Dentist', 'fee': 150, 'photoUrl': 'https://example.com/rao.jpg'},
  {'id': 8, 'name': 'Dr Khan', 'specialty': 'Cardiologist', 'fee': 300},
];

Future<List<Map<String, dynamic>>> sampleDataLoader(String name, Map<String, dynamic> params) async {
  if (name == 'doctors_nearby') return sampleDoctors;
  throw StateError('There is no data called "$name".');
}

SduiRender makeRender(
  Reports reports, {
  SduiWidgetRegistry? registry,
  SduiActionHandler? actions,
  SduiDataLoader? dataLoader,
  bool withoutDataLoader = false,
  Set<String> killedWidgets = const {},
}) {
  return SduiRender(
    registry: registry ?? SduiWidgetRegistry.withBuiltIns(),
    actions: actions,
    dataLoader: withoutDataLoader ? null : (dataLoader ?? sampleDataLoader),
    killedWidgets: killedWidgets,
    onError: (error, stackTrace) => reports.errors.add(error),
    onAnalytics: (event, params) => reports.analytics.add(MapEntry(event, params)),
  );
}

Widget host(Widget child, {ThemeData? theme}) {
  return MaterialApp(theme: theme, home: Scaffold(body: child));
}

/// Shows a page the way an app would: the server answers right away with [document].
Widget pageHost(Map<String, dynamic> document, SduiRender render, {SduiCache? cache, Key? key}) {
  return host(
    SduiView(
      key: key,
      kind: SduiDocumentKind.page,
      id: 'p',
      client: FakeClient(() async => document),
      render: render,
      cache: cache,
    ),
  );
}

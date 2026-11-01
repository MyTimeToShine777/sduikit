// A tiny app that draws whatever the example server (examples/server) sends.
// Start the server first (`npm start --workspace sduikit-example-server`), then run this app.
// Change a page with a PUT to /admin/pages/home and reopen the app: the screen changes
// without rebuilding or reinstalling the app.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:sduikit/sduikit.dart';

void main() => runApp(const ExampleApp());

/// Asks the example server for documents. This is the part every app writes for its own API.
class HttpSduiClient implements SduiClient {
  HttpSduiClient({required this.baseUrl, required this.supportedWidgets, this.appVersion = '1.0.0', this.country});

  final String baseUrl;
  final Map<String, List<int>> supportedWidgets;
  final String appVersion;
  final String? country;

  Future<Map<String, dynamic>> _get(String path) async {
    // The app tells the server what it can draw, so the server only sends widgets that will work.
    final widgets = [
      for (final entry in supportedWidgets.entries)
        for (final version in entry.value) '${entry.key}:$version',
    ].join(',');
    final uri = Uri.parse(baseUrl).replace(
      path: path,
      queryParameters: {'appVersion': appVersion, if (country != null) 'country': country!, 'widgets': widgets},
    );
    final client = HttpClient();
    try {
      final response = await (await client.getUrl(uri)).close();
      final body = await response.transform(utf8.decoder).join();
      if (response.statusCode != 200) throw HttpException('The server answered ${response.statusCode}: $body', uri: uri);
      return jsonDecode(body) as Map<String, dynamic>;
    } finally {
      client.close();
    }
  }

  /// Rows for a data_list widget, e.g. fetchData('doctors_nearby', {'city': 'Dubai'}).
  Future<List<Map<String, dynamic>>> fetchData(String name, Map<String, dynamic> params) async {
    final uri = Uri.parse(baseUrl).replace(
      path: '/data/$name',
      queryParameters: {for (final entry in params.entries) entry.key: '${entry.value}'},
    );
    final client = HttpClient();
    try {
      final response = await (await client.getUrl(uri)).close();
      final body = await response.transform(utf8.decoder).join();
      if (response.statusCode != 200) throw HttpException('The server answered ${response.statusCode}: $body', uri: uri);
      return [for (final row in jsonDecode(body) as List) Map<String, dynamic>.from(row as Map)];
    } finally {
      client.close();
    }
  }

  @override
  Future<Map<String, dynamic>> fetchPage(String id) => _get('/pages/$id');

  @override
  Future<Map<String, dynamic>> fetchScreen(String id) => _get('/screens/$id');

  @override
  Future<Map<String, dynamic>> fetchManifest() => _get('/manifest');
}

class ExampleApp extends StatefulWidget {
  const ExampleApp({super.key});

  @override
  State<ExampleApp> createState() => _ExampleAppState();
}

class _ExampleAppState extends State<ExampleApp> {
  final _cache = MemorySduiCache();
  late final SduiWidgetRegistry _registry = SduiWidgetRegistry.withBuiltIns();
  late final HttpSduiClient _client = HttpSduiClient(
    // 10.0.2.2 is how the Android emulator reaches the computer it runs on.
    baseUrl: Platform.isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000',
    supportedWidgets: _registry.supported,
    country: 'AE',
  );
  ThemeData? _theme;

  @override
  void initState() {
    super.initState();
    _loadTheme();
  }

  // The look of the app also comes from the server, so staff can change colours without a release.
  Future<void> _loadTheme() async {
    try {
      final manifest = await _client.fetchManifest();
      setState(() => _theme = sduiThemeData(manifest['theme'] as Map<String, dynamic>));
    } catch (_) {
      // Keep the default look; the page below will show its own retry screen if the server is down.
    }
  }

  @override
  Widget build(BuildContext context) {
    final render = SduiRender(
      registry: _registry,
      dataLoader: _client.fetchData,
      actions: SduiActionHandler(
        onOpenScreen: (context, id) => debugPrint('open_screen $id'),
        onCallApi: (name, params) async => debugPrint('call_api $name $params'),
        nativeScreens: {
          // A built-in screen the server can open by name, with values taken from the tapped row.
          'doctor_profile': (context, params) => debugPrint('open the profile of doctor ${params['doctorId']}'),
        },
      ),
      onError: (error, stackTrace) => debugPrint('sduikit: $error'),
      onAnalytics: (event, params) => debugPrint('analytics: $event $params'),
    );
    return MaterialApp(
      title: 'sduikit example',
      theme: _theme,
      home: Scaffold(
        appBar: AppBar(title: const Text('sduikit example')),
        body: SduiView(kind: SduiDocumentKind.page, id: 'home', client: _client, render: render, cache: _cache),
      ),
    );
  }
}

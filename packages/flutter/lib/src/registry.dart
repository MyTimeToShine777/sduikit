import 'package:flutter/widgets.dart';

import 'builtin_widgets.dart';
import 'model.dart';
import 'render.dart';

typedef SduiWidgetBuilder = Widget Function(BuildContext context, SduiNode node, SduiRender render);

/// Which widget code draws which `type` + `v`. Your app adds its own widgets here
/// (a product tile, a map, a chart...) next to the built-in ones.
class SduiWidgetRegistry {
  SduiWidgetRegistry();

  /// A registry that already knows all 38 built-in widgets.
  factory SduiWidgetRegistry.withBuiltIns() {
    final registry = SduiWidgetRegistry();
    registerBuiltInWidgets(registry);
    return registry;
  }

  final Map<String, SduiWidgetBuilder> _builders = {};

  void register(String type, int version, SduiWidgetBuilder builder) {
    _builders['$type@$version'] = builder;
  }

  SduiWidgetBuilder? find(String type, int version) => _builders['$type@$version'];

  /// What this app can draw, in the form the server wants, e.g. `{'text': [1], 'banner': [1]}`.
  /// Send it with each request so the server only returns widgets the app can draw.
  Map<String, List<int>> get supported {
    final result = <String, List<int>>{};
    for (final key in _builders.keys) {
      final parts = key.split('@');
      result.putIfAbsent(parts[0], () => []).add(int.parse(parts[1]));
    }
    for (final versions in result.values) {
      versions.sort();
    }
    return result;
  }
}

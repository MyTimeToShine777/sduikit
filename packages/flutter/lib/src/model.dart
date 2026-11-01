/// One widget as the server described it (the outer shape plus its `data`).
class SduiNode {
  const SduiNode({
    required this.id,
    required this.type,
    required this.version,
    required this.data,
    this.style = const {},
    this.action,
    this.analyticsEvent,
    this.analyticsParams,
    this.fallback,
  });

  final String id;
  final String type;
  final int version;
  final Map<String, dynamic> data;
  final Map<String, dynamic> style;
  final Map<String, dynamic>? action;
  final String? analyticsEvent;
  final Map<String, dynamic>? analyticsParams;

  /// Drawn instead of this widget when this one cannot be drawn.
  final SduiNode? fallback;

  /// Reads a widget from decoded JSON. Returns null when it is not a usable widget,
  /// so one bad entry never stops the rest of the page.
  static SduiNode? tryParse(Object? json) {
    if (json is! Map) return null;
    final id = json['id'];
    final type = json['type'];
    final version = json['v'];
    final data = json['data'];
    if (id is! String || type is! String || version is! int || data is! Map) return null;

    final style = json['style'];
    final action = json['action'];
    final analytics = json['analytics'];
    return SduiNode(
      id: id,
      type: type,
      version: version,
      data: Map<String, dynamic>.from(data),
      style: style is Map ? Map<String, dynamic>.from(style) : const {},
      action: action is Map ? Map<String, dynamic>.from(action) : null,
      analyticsEvent: analytics is Map && analytics['event'] is String ? analytics['event'] as String : null,
      analyticsParams: analytics is Map && analytics['params'] is Map
          ? Map<String, dynamic>.from(analytics['params'] as Map)
          : null,
      fallback: tryParse(json['fallback']),
    );
  }

  /// A text value that must be there. Throws [SduiDataError] if it is missing or empty,
  /// so the widget is skipped instead of being drawn with an invented value.
  String requireString(String key) {
    final value = data[key];
    if (value is String && value.isNotEmpty) return value;
    throw SduiDataError(this, key);
  }

  String? string(String key) {
    final value = data[key];
    return value is String ? value : null;
  }

  double? number(String key) {
    final value = data[key];
    return value is num ? value.toDouble() : null;
  }

  int? integer(String key) {
    final value = data[key];
    return value is int ? value : null;
  }

  bool? boolean(String key) {
    final value = data[key];
    return value is bool ? value : null;
  }

  List<dynamic> list(String key) {
    final value = data[key];
    return value is List ? value : const [];
  }
}

/// A widget is missing something it cannot be drawn without.
class SduiDataError implements Exception {
  SduiDataError(this.node, this.field);

  final SduiNode node;
  final String field;

  @override
  String toString() => 'The "${node.type}" widget "${node.id}" is missing "$field", so it was not drawn.';
}

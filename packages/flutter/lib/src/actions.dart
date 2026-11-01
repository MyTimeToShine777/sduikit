import 'package:flutter/widgets.dart';

typedef SduiErrorHook = void Function(Object error, StackTrace? stackTrace);

/// A built-in screen of the app that the server can open by name (for example "booking").
typedef SduiNativeScreen = void Function(BuildContext context, Map<String, dynamic> params);

/// Does what an action says when someone taps. The package does not know how your app opens
/// screens or calls its API, so you pass those in. A failed action calls [onError] and never crashes.
class SduiActionHandler {
  SduiActionHandler({
    this.onOpenScreen,
    this.onOpenSheet,
    this.onOpenUrl,
    this.onShare,
    this.onCallApi,
    this.onDismiss,
    this.nativeScreens = const {},
    this.killedActions = const {},
    this.onError,
  });

  final void Function(BuildContext context, String screenId)? onOpenScreen;
  final void Function(BuildContext context, String screenId)? onOpenSheet;
  final void Function(String url, bool external)? onOpenUrl;
  final void Function(String text, String? url)? onShare;
  final Future<void> Function(String name, Map<String, dynamic> params)? onCallApi;

  /// Defaults to going back one screen.
  final void Function(BuildContext context)? onDismiss;

  /// The named built-in screens that `open_native` may open.
  final Map<String, SduiNativeScreen> nativeScreens;

  /// Action types the manifest switched off. They are ignored.
  final Set<String> killedActions;

  final SduiErrorHook? onError;

  Future<void> run(BuildContext context, Map<String, dynamic>? action) async {
    if (action == null) return;
    final type = action['type'];
    if (type is String && killedActions.contains(type)) return;

    try {
      switch (type) {
        case 'open_screen':
          _handlerFor(onOpenScreen, 'open_screen')(context, _text(action, 'screenId'));
        case 'open_sheet':
          _handlerFor(onOpenSheet, 'open_sheet')(context, _text(action, 'screenId'));
        case 'open_url':
          _handlerFor(onOpenUrl, 'open_url')(_text(action, 'url'), action['external'] == true);
        case 'open_native':
          final name = _text(action, 'name');
          final screen = nativeScreens[name];
          if (screen == null) throw StateError('No built-in screen is registered with the name "$name".');
          screen(context, _params(action));
        case 'call_api':
          await _handlerFor(onCallApi, 'call_api')(_text(action, 'name'), _params(action));
        case 'share':
          final url = action['url'];
          _handlerFor(onShare, 'share')(_text(action, 'text'), url is String ? url : null);
        case 'dismiss':
          (onDismiss ?? (BuildContext c) => Navigator.of(c).maybePop())(context);
        default:
          throw StateError('Unknown action type "$type".');
      }
    } catch (error, stackTrace) {
      onError?.call(error, stackTrace);
    }
  }

  T _handlerFor<T>(T? handler, String type) {
    if (handler == null) throw StateError('The app has no handler for the "$type" action.');
    return handler;
  }

  String _text(Map<String, dynamic> action, String key) {
    final value = action[key];
    if (value is String && value.isNotEmpty) return value;
    throw FormatException('The "${action['type']}" action needs "$key".');
  }

  Map<String, dynamic> _params(Map<String, dynamic> action) {
    final params = action['params'];
    return params is Map ? Map<String, dynamic>.from(params) : <String, dynamic>{};
  }
}

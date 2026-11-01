import 'dart:async';

import 'package:flutter/material.dart';

import 'actions.dart';
import 'model.dart';
import 'registry.dart';
import 'theme.dart';

typedef SduiAnalyticsHook = void Function(String event, Map<String, dynamic> params);

/// The server sent a widget this app cannot draw (unknown type, or a version it does not have).
class SduiUnknownWidget implements Exception {
  SduiUnknownWidget(this.node);

  final SduiNode node;

  @override
  String toString() => 'This app cannot draw the widget "${node.type}" version ${node.version}, so it was skipped.';
}

/// Draws widgets safely. Whatever goes wrong with one widget (unknown type, missing data, a bug
/// in its code) is reported to [onError] and that widget is skipped or replaced by its fallback.
/// The rest of the page is still drawn.
class SduiRender {
  SduiRender({
    required this.registry,
    SduiActionHandler? actions,
    this.onError,
    this.onAnalytics,
    this.killedWidgets = const {},
  }) : actions = actions ?? SduiActionHandler(onError: onError);

  final SduiWidgetRegistry registry;
  final SduiActionHandler actions;
  final SduiErrorHook? onError;
  final SduiAnalyticsHook? onAnalytics;

  /// Widget types the manifest switched off. They are not drawn (their fallback is, if there is one).
  final Set<String> killedWidgets;

  /// Draws one widget.
  Widget build(BuildContext context, SduiNode node) {
    if (killedWidgets.contains(node.type)) return _fallbackFor(context, node);

    final builder = registry.find(node.type, node.version);
    if (builder == null) {
      onError?.call(SduiUnknownWidget(node), null);
      return _fallbackFor(context, node);
    }
    try {
      return builder(context, node, this);
    } catch (error, stackTrace) {
      onError?.call(error, stackTrace);
      return _fallbackFor(context, node);
    }
  }

  /// Draws a list of widgets from decoded JSON, skipping entries that are not usable widgets.
  List<Widget> children(BuildContext context, List<dynamic> json) {
    final widgets = <Widget>[];
    for (final item in json) {
      final node = SduiNode.tryParse(item);
      if (node == null) {
        onError?.call(const FormatException('An entry in a widget list is not a usable widget and was skipped.'), null);
        continue;
      }
      widgets.add(build(context, node));
    }
    return widgets;
  }

  Widget _fallbackFor(BuildContext context, SduiNode node) {
    final fallback = node.fallback;
    return fallback == null ? const SizedBox.shrink() : build(context, fallback);
  }

  /// Reports the analytics event (if any), then runs the action (if any).
  void tap(BuildContext context, {Map<String, dynamic>? action, String? event, Map<String, dynamic>? params}) {
    if (event != null) onAnalytics?.call(event, params ?? const {});
    unawaited(actions.run(context, action));
  }

  /// Applies the shared `style` tokens (padding, background, corners) and makes the widget tappable
  /// when it has an action. Pass `tappable: false` when the child handles taps itself (a button).
  Widget wrap(
    BuildContext context,
    Widget child, {
    Map<String, dynamic> style = const {},
    Map<String, dynamic>? action,
    String? event,
    Map<String, dynamic>? params,
    bool tappable = true,
  }) {
    final tokens = context.sduiTokens;
    final padding = tokens.space(style['spacing']);
    final background = tokens.color(style['color']);
    final radius = tokens.radius(style['radius']);

    var result = child;
    if (padding != null || background != null || radius != null) {
      result = Container(
        padding: padding == null ? null : EdgeInsets.all(padding),
        clipBehavior: radius == null ? Clip.none : Clip.antiAlias,
        decoration: BoxDecoration(
          color: background,
          borderRadius: radius == null ? null : BorderRadius.circular(radius),
        ),
        child: result,
      );
    }
    if (tappable && action != null) {
      result = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => tap(context, action: action, event: event, params: params),
        child: result,
      );
    }
    return result;
  }

  /// [wrap] using the style, action and analytics that belong to a widget.
  Widget wrapNode(BuildContext context, SduiNode node, Widget child, {bool tappable = true}) {
    return wrap(
      context,
      child,
      style: node.style,
      action: node.action,
      event: node.analyticsEvent,
      params: node.analyticsParams,
      tappable: tappable,
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';

import 'actions.dart';
import 'client.dart';
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
    this.dataLoader,
    this.killedWidgets = const {},
    DateTime Function()? clock,
  })  : actions = actions ?? SduiActionHandler(onError: onError),
        now = clock ?? DateTime.now;

  final SduiWidgetRegistry registry;
  final SduiActionHandler actions;

  /// How `data_list` widgets get their rows. Without one, those widgets are skipped and reported.
  final SduiDataLoader? dataLoader;
  final SduiErrorHook? onError;
  final SduiAnalyticsHook? onAnalytics;

  /// Widget types the manifest switched off. They are not drawn (their fallback is, if there is one).
  final Set<String> killedWidgets;

  /// The current time. Widgets like the countdown read it from here, so tests can set it.
  final DateTime Function() now;

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

  /// Widgets that run from one edge of the screen to the other. Everything else gets a side margin on a page.
  static const Set<String> fullBleedWidgets = {'hero', 'banner', 'gallery', 'video_card', 'image', 'carousel', 'divider'};

  /// Like [children], for widgets placed directly on a page: each gets a side margin of 16, except the
  /// full-width ones (pictures, banners, carousels). Inside other widgets, use [children] (no extra margin).
  List<Widget> pageChildren(BuildContext context, List<dynamic> json) {
    final widgets = <Widget>[];
    for (final item in json) {
      final node = SduiNode.tryParse(item);
      if (node == null) {
        onError?.call(const FormatException('An entry in a widget list is not a usable widget and was skipped.'), null);
        continue;
      }
      final built = build(context, node);
      widgets.add(fullBleedWidgets.contains(node.type)
          ? built
          : Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: built));
    }
    return widgets;
  }

  Widget _fallbackFor(BuildContext context, SduiNode node) {
    final fallback = node.fallback;
    return fallback == null ? const SizedBox.shrink() : build(context, fallback);
  }

  /// Reports the analytics event (if any), then runs the action (if any).
  /// [extraParams] are added to the action's own `params` (a form uses this to send what was typed).
  void tap(
    BuildContext context, {
    Map<String, dynamic>? action,
    String? event,
    Map<String, dynamic>? params,
    Map<String, dynamic>? extraParams,
  }) {
    if (event != null) onAnalytics?.call(event, params ?? const {});
    var toRun = action;
    if (action != null && extraParams != null) {
      final own = action['params'];
      toRun = {
        ...action,
        'params': {if (own is Map) ...Map<String, dynamic>.from(own), ...extraParams},
      };
    }
    unawaited(actions.run(context, toRun));
  }

  /// Applies the shared `style` (space, margin, size, colours, corners, border, shadow, opacity, text look)
  /// and makes the widget tappable when it has an action. Pass `tappable: false` when the child handles taps
  /// itself (a button). Every value in the style is a theme name or an exact value.
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
    final spacing = tokens.space(style['spacing']);
    final padding = _sides(tokens, style['padding'], spacing ?? 0);
    final margin = _sides(tokens, style['margin'], 0);
    final background = tokens.color(style['color']);
    final radius = tokens.radius(style['radius']);
    final borderWidth = style['borderWidth'] is num ? (style['borderWidth'] as num).toDouble() : null;
    final borderColor = tokens.color(style['borderColor']);
    final hasBorder = (borderWidth != null && borderWidth > 0) || borderColor != null;
    final shadow = _shadowFor(style['shadow']);
    final width = _length(style['width']);
    final height = _length(style['height']);

    var result = child;

    // Text look: colour, size, weight, italic, and alignment reach the text inside.
    final textColor = tokens.color(style['textColor']);
    final textSize = tokens.textSize(style['textSize']);
    final weight = switch (style['fontWeight']) {
      'bold' => FontWeight.w700,
      'medium' => FontWeight.w500,
      'normal' => FontWeight.w400,
      _ => null,
    };
    final italic = style['italic'] == true;
    final align = switch (style['align']) {
      'start' => TextAlign.start,
      'center' => TextAlign.center,
      'end' => TextAlign.end,
      _ => null,
    };
    if (textColor != null || textSize != null || weight != null || italic || align != null) {
      result = DefaultTextStyle.merge(
        style: TextStyle(
          color: textColor,
          fontSize: textSize,
          fontWeight: weight,
          fontStyle: italic ? FontStyle.italic : null,
        ),
        textAlign: align,
        child: result,
      );
    }

    if (padding != EdgeInsets.zero || background != null || radius != null || hasBorder || shadow.isNotEmpty) {
      result = Container(
        padding: padding == EdgeInsets.zero ? null : padding,
        clipBehavior: radius == null ? Clip.none : Clip.antiAlias,
        decoration: BoxDecoration(
          color: background,
          borderRadius: radius == null ? null : BorderRadius.circular(radius),
          border: hasBorder ? Border.all(width: borderWidth ?? 1, color: borderColor ?? const Color(0x33000000)) : null,
          boxShadow: shadow.isEmpty ? null : shadow,
        ),
        child: result,
      );
    }
    if (width != null || height != null) result = SizedBox(width: width, height: height, child: result);
    if (margin != EdgeInsets.zero) result = Padding(padding: margin, child: result);
    if (style['opacity'] is num) result = Opacity(opacity: (style['opacity'] as num).toDouble().clamp(0.0, 1.0), child: result);

    if (tappable && action != null) {
      result = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => tap(context, action: action, event: event, params: params),
        child: result,
      );
    }
    return result;
  }

  // Four sides from {top,right,bottom,left}; a side that is not given uses [fallback].
  EdgeInsets _sides(SduiTokens tokens, Object? value, double fallback) {
    if (value is! Map) return EdgeInsets.all(fallback);
    double side(String key) => tokens.space(value[key]) ?? fallback;
    return EdgeInsets.fromLTRB(side('left'), side('top'), side('right'), side('bottom'));
  }

  double? _length(Object? value) => value is num ? value.toDouble() : (value == 'fill' ? double.infinity : null);

  List<BoxShadow> _shadowFor(Object? name) => switch (name) {
        'small' => const [BoxShadow(color: Color(0x33000000), blurRadius: 3, offset: Offset(0, 1))],
        'medium' => const [BoxShadow(color: Color(0x38000000), blurRadius: 12, offset: Offset(0, 4))],
        'large' => const [BoxShadow(color: Color(0x47000000), blurRadius: 28, offset: Offset(0, 12))],
        _ => const [],
      };

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

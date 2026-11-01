import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'model.dart';
import 'registry.dart';
import 'render.dart';
import 'theme.dart';

/// Adds the building blocks, named after the Flutter widgets they draw: row, column, stack, positioned,
/// padding, align, center, sized_box, expanded, flexible, aspect_ratio, fractionally_sized_box,
/// constrained_box, fitted_box, wrap, single_child_scroll_view, list_view, grid_view, indexed_stack, opacity,
/// transform, rotated_box, clip, box (Flutter's Container), visibility, backdrop_blur, ink_well, safe_area.
///
/// Expanded, flexible and positioned give back the Flutter widget itself, with no style wrapped around it,
/// because Flutter only lets them sit directly inside a row, column or stack.
void registerBuildingBlocks(SduiWidgetRegistry registry) {
  registry
    ..register('row', 1, (c, n, r) => _flex(c, n, r, Axis.horizontal))
    ..register('column', 1, (c, n, r) => _flex(c, n, r, Axis.vertical))
    ..register('stack', 1, _stack)
    ..register('positioned', 1, _positioned)
    ..register('padding', 1, _padding)
    ..register('align', 1, _align)
    ..register('center', 1, _center)
    ..register('sized_box', 1, _sizedBox)
    ..register('expanded', 1, _expanded)
    ..register('flexible', 1, _flexible)
    ..register('aspect_ratio', 1, _aspectRatio)
    ..register('fractionally_sized_box', 1, _fractionallySizedBox)
    ..register('constrained_box', 1, _constrainedBox)
    ..register('fitted_box', 1, _fittedBox)
    ..register('wrap', 1, _wrap)
    ..register('single_child_scroll_view', 1, _singleChildScrollView)
    ..register('list_view', 1, _listView)
    ..register('grid_view', 1, _gridView)
    ..register('indexed_stack', 1, _indexedStack)
    ..register('opacity', 1, _opacity)
    ..register('transform', 1, _transform)
    ..register('rotated_box', 1, _rotatedBox)
    ..register('clip', 1, _clip)
    ..register('box', 1, _box)
    ..register('visibility', 1, _visibility)
    ..register('backdrop_blur', 1, _backdropBlur)
    ..register('ink_well', 1, _inkWell)
    ..register('safe_area', 1, _safeArea);
}

// ── Reading values the way Flutter names them ──

Alignment _alignment(Object? value, [Alignment fallback = Alignment.topLeft]) => switch (value) {
      'topLeft' => Alignment.topLeft,
      'topCenter' => Alignment.topCenter,
      'topRight' => Alignment.topRight,
      'centerLeft' => Alignment.centerLeft,
      'center' => Alignment.center,
      'centerRight' => Alignment.centerRight,
      'bottomLeft' => Alignment.bottomLeft,
      'bottomCenter' => Alignment.bottomCenter,
      'bottomRight' => Alignment.bottomRight,
      _ => fallback,
    };

MainAxisAlignment _mainAxis(Object? value) => switch (value) {
      'end' => MainAxisAlignment.end,
      'center' => MainAxisAlignment.center,
      'spaceBetween' => MainAxisAlignment.spaceBetween,
      'spaceAround' => MainAxisAlignment.spaceAround,
      'spaceEvenly' => MainAxisAlignment.spaceEvenly,
      _ => MainAxisAlignment.start,
    };

CrossAxisAlignment _crossAxis(Object? value) => switch (value) {
      'end' => CrossAxisAlignment.end,
      'center' => CrossAxisAlignment.center,
      'stretch' => CrossAxisAlignment.stretch,
      _ => CrossAxisAlignment.start,
    };

WrapAlignment _wrapAlignment(Object? value) => switch (value) {
      'end' => WrapAlignment.end,
      'center' => WrapAlignment.center,
      'spaceBetween' => WrapAlignment.spaceBetween,
      'spaceAround' => WrapAlignment.spaceAround,
      'spaceEvenly' => WrapAlignment.spaceEvenly,
      _ => WrapAlignment.start,
    };

WrapCrossAlignment _wrapCrossAlignment(Object? value) => switch (value) {
      'end' => WrapCrossAlignment.end,
      'center' => WrapCrossAlignment.center,
      _ => WrapCrossAlignment.start,
    };

BoxFit _boxFit(Object? value) => switch (value) {
      'cover' => BoxFit.cover,
      'fill' => BoxFit.fill,
      'fitWidth' => BoxFit.fitWidth,
      'fitHeight' => BoxFit.fitHeight,
      'none' => BoxFit.none,
      'scaleDown' => BoxFit.scaleDown,
      _ => BoxFit.contain,
    };

Axis _axis(Object? value) => value == 'horizontal' ? Axis.horizontal : Axis.vertical;

double? _number(Object? value) => value is num ? value.toDouble() : null;

// A size is a number, or "fill" to take all the room there is.
double? _length(Object? value) => value is num ? value.toDouble() : (value == 'fill' ? double.infinity : null);

/// Four sides from {top, right, bottom, left}; each side is a theme name or a number.
EdgeInsets _insets(BuildContext context, Object? value) {
  if (value is! Map) return EdgeInsets.zero;
  final tokens = context.sduiTokens;
  double side(String key) => tokens.space(value[key]) ?? 0;
  return EdgeInsets.fromLTRB(side('left'), side('top'), side('right'), side('bottom'));
}

List<Widget> _kids(BuildContext context, SduiNode node, SduiRender render) => render.children(context, node.list('children'));

/// The one widget inside a wrapper, or null when it is empty.
Widget? _only(BuildContext context, SduiNode node, SduiRender render) {
  final kids = _kids(context, node, render);
  return kids.isEmpty ? null : kids.first;
}

// Puts a gap between the widgets of a row or column.
List<Widget> _spaced(List<Widget> kids, double gap, Axis axis) => [
      for (var index = 0; index < kids.length; index++) ...[
        if (index > 0 && gap > 0) SizedBox(width: axis == Axis.horizontal ? gap : 0, height: axis == Axis.vertical ? gap : 0),
        kids[index],
      ],
    ];

// ── Layout ──

Widget _flex(BuildContext context, SduiNode node, SduiRender render, Axis axis) {
  final gap = context.sduiTokens.space(node.data['spacing']) ?? 0;
  return render.wrapNode(
    context,
    node,
    Flex(
      direction: axis,
      mainAxisAlignment: _mainAxis(node.data['mainAxisAlignment']),
      crossAxisAlignment: _crossAxis(node.data['crossAxisAlignment']),
      mainAxisSize: node.data['mainAxisSize'] == 'min' ? MainAxisSize.min : MainAxisSize.max,
      children: _spaced(_kids(context, node, render), gap, axis),
    ),
  );
}

Widget _stack(BuildContext context, SduiNode node, SduiRender render) {
  Widget stack = Stack(
    alignment: _alignment(node.data['alignment']),
    fit: node.data['fit'] == 'expand' ? StackFit.expand : StackFit.loose,
    clipBehavior: node.data['clip'] == false ? Clip.none : Clip.hardEdge,
    children: _kids(context, node, render),
  );
  final width = _length(node.data['width']);
  final height = _length(node.data['height']);
  if (width != null || height != null) stack = SizedBox(width: width, height: height, child: stack);
  return render.wrapNode(context, node, stack);
}

// Positioned only works directly inside a stack, so it is given back as it is (no style around it).
Widget _positioned(BuildContext context, SduiNode node, SduiRender render) {
  final child = _only(context, node, render);
  if (child == null) throw SduiDataError(node, 'children');
  return Positioned(
    left: _number(node.data['left']),
    top: _number(node.data['top']),
    right: _number(node.data['right']),
    bottom: _number(node.data['bottom']),
    width: _number(node.data['width']),
    height: _number(node.data['height']),
    child: child,
  );
}

Widget _padding(BuildContext context, SduiNode node, SduiRender render) {
  final child = _only(context, node, render);
  return render.wrapNode(context, node, Padding(padding: _insets(context, node.data['padding']), child: child));
}

Widget _align(BuildContext context, SduiNode node, SduiRender render) => render.wrapNode(
      context,
      node,
      Align(
        alignment: _alignment(node.data['alignment'], Alignment.center),
        widthFactor: _number(node.data['widthFactor']),
        heightFactor: _number(node.data['heightFactor']),
        child: _only(context, node, render),
      ),
    );

Widget _center(BuildContext context, SduiNode node, SduiRender render) =>
    render.wrapNode(context, node, Center(child: _only(context, node, render)));

Widget _sizedBox(BuildContext context, SduiNode node, SduiRender render) => render.wrapNode(
      context,
      node,
      SizedBox(width: _length(node.data['width']), height: _length(node.data['height']), child: _only(context, node, render)),
    );

// Expanded and flexible only work directly inside a row or column, so they are given back as they are.
Widget _expanded(BuildContext context, SduiNode node, SduiRender render) {
  final child = _only(context, node, render);
  if (child == null) throw SduiDataError(node, 'children');
  return Expanded(flex: node.integer('flex') ?? 1, child: child);
}

Widget _flexible(BuildContext context, SduiNode node, SduiRender render) {
  final child = _only(context, node, render);
  if (child == null) throw SduiDataError(node, 'children');
  return Flexible(
    flex: node.integer('flex') ?? 1,
    fit: node.data['fit'] == 'tight' ? FlexFit.tight : FlexFit.loose,
    child: child,
  );
}

Widget _aspectRatio(BuildContext context, SduiNode node, SduiRender render) {
  final ratio = node.number('aspectRatio');
  if (ratio == null || ratio <= 0) throw SduiDataError(node, 'aspectRatio');
  return render.wrapNode(context, node, AspectRatio(aspectRatio: ratio, child: _only(context, node, render)));
}

Widget _fractionallySizedBox(BuildContext context, SduiNode node, SduiRender render) => render.wrapNode(
      context,
      node,
      FractionallySizedBox(
        alignment: _alignment(node.data['alignment'], Alignment.center),
        widthFactor: _number(node.data['widthFactor']),
        heightFactor: _number(node.data['heightFactor']),
        child: _only(context, node, render),
      ),
    );

Widget _constrainedBox(BuildContext context, SduiNode node, SduiRender render) => render.wrapNode(
      context,
      node,
      ConstrainedBox(
        constraints: BoxConstraints(
          minWidth: _number(node.data['minWidth']) ?? 0,
          maxWidth: _number(node.data['maxWidth']) ?? double.infinity,
          minHeight: _number(node.data['minHeight']) ?? 0,
          maxHeight: _number(node.data['maxHeight']) ?? double.infinity,
        ),
        child: _only(context, node, render),
      ),
    );

Widget _fittedBox(BuildContext context, SduiNode node, SduiRender render) => render.wrapNode(
      context,
      node,
      FittedBox(
        fit: _boxFit(node.data['fit']),
        alignment: _alignment(node.data['alignment'], Alignment.center),
        child: _only(context, node, render),
      ),
    );

Widget _wrap(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  return render.wrapNode(
    context,
    node,
    Wrap(
      direction: node.data['direction'] == 'vertical' ? Axis.vertical : Axis.horizontal,
      alignment: _wrapAlignment(node.data['alignment']),
      runAlignment: _wrapAlignment(node.data['runAlignment']),
      crossAxisAlignment: _wrapCrossAlignment(node.data['crossAxisAlignment']),
      spacing: tokens.space(node.data['spacing']) ?? 0,
      runSpacing: tokens.space(node.data['runSpacing']) ?? 0,
      children: _kids(context, node, render),
    ),
  );
}

Widget _singleChildScrollView(BuildContext context, SduiNode node, SduiRender render) => render.wrapNode(
      context,
      node,
      SingleChildScrollView(
        scrollDirection: _axis(node.data['scrollDirection']),
        reverse: node.data['reverse'] == true,
        padding: _insets(context, node.data['padding']),
        child: _only(context, node, render),
      ),
    );

// A list that scrolls inside its own `height`. With no height it is as tall as its contents and the page
// scrolls instead (a list inside a scrolling page needs one or the other).
Widget _listView(BuildContext context, SduiNode node, SduiRender render) {
  final axis = _axis(node.data['scrollDirection']);
  final gap = context.sduiTokens.space(node.data['spacing']) ?? 0;
  final kids = _spaced(_kids(context, node, render), gap, axis);
  final padding = _insets(context, node.data['padding']);
  final reverse = node.data['reverse'] == true;
  final height = _number(node.data['height']);

  Widget list;
  if (height != null) {
    list = SizedBox(
      height: height,
      child: ListView(scrollDirection: axis, reverse: reverse, padding: padding, children: kids),
    );
  } else if (axis == Axis.horizontal) {
    // A sideways list with no height cannot ask a ListView for one, so lay it out as a scrolling row.
    list = SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      reverse: reverse,
      padding: padding,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: kids),
    );
  } else {
    list = ListView(
      shrinkWrap: true,
      reverse: reverse,
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      children: kids,
    );
  }
  return render.wrapNode(context, node, list);
}

Widget _gridView(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  final height = _number(node.data['height']);
  Widget grid = GridView.count(
    crossAxisCount: node.integer('crossAxisCount') ?? 2,
    mainAxisSpacing: tokens.space(node.data['mainAxisSpacing']) ?? 0,
    crossAxisSpacing: tokens.space(node.data['crossAxisSpacing']) ?? 0,
    childAspectRatio: _number(node.data['childAspectRatio']) ?? 1,
    scrollDirection: _axis(node.data['scrollDirection']),
    padding: _insets(context, node.data['padding']),
    shrinkWrap: height == null,
    physics: height == null ? const NeverScrollableScrollPhysics() : null,
    children: _kids(context, node, render),
  );
  if (height != null) grid = SizedBox(height: height, child: grid);
  return render.wrapNode(context, node, grid);
}

Widget _indexedStack(BuildContext context, SduiNode node, SduiRender render) => render.wrapNode(
      context,
      node,
      IndexedStack(
        index: node.integer('index') ?? 0,
        alignment: _alignment(node.data['alignment']),
        children: _kids(context, node, render),
      ),
    );

// ── Effects ──

Widget _opacity(BuildContext context, SduiNode node, SduiRender render) {
  final value = node.number('opacity');
  if (value == null) throw SduiDataError(node, 'opacity');
  return render.wrapNode(context, node, Opacity(opacity: value.clamp(0.0, 1.0), child: _only(context, node, render)));
}

Widget _transform(BuildContext context, SduiNode node, SduiRender render) {
  final scale = node.number('scale') ?? 1;
  // Move, then turn, then resize. These three always work the same on every Flutter version.
  final matrix = Matrix4.translationValues(node.number('translateX') ?? 0, node.number('translateY') ?? 0, 0) *
      Matrix4.rotationZ((node.number('rotate') ?? 0) * math.pi / 180) *
      Matrix4.diagonal3Values(
        (node.number('scaleX') ?? scale) * (node.data['flipX'] == true ? -1 : 1),
        node.number('scaleY') ?? scale,
        1,
      );
  return render.wrapNode(
    context,
    node,
    Transform(alignment: _alignment(node.data['alignment'], Alignment.center), transform: matrix, child: _only(context, node, render)),
  );
}

Widget _rotatedBox(BuildContext context, SduiNode node, SduiRender render) {
  final turns = node.integer('quarterTurns');
  if (turns == null) throw SduiDataError(node, 'quarterTurns');
  return render.wrapNode(context, node, RotatedBox(quarterTurns: turns, child: _only(context, node, render)));
}

Widget _clip(BuildContext context, SduiNode node, SduiRender render) {
  final child = _only(context, node, render);
  final radius = context.sduiTokens.radius(node.data['radius']) ?? 8;
  final Widget clipped = switch (node.data['shape']) {
    'oval' => ClipOval(child: child),
    'rect' => ClipRect(child: child),
    _ => ClipRRect(borderRadius: BorderRadius.circular(radius), child: child),
  };
  return render.wrapNode(context, node, clipped);
}

// Flutter's Container: size, space inside and outside, colour or gradient, border, corners, shadows, a picture.
Widget _box(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  final data = node.data;
  final radius = tokens.radius(data['borderRadius']);
  final isCircle = data['shape'] == 'circle';
  final borderWidth = _number(data['borderWidth']);
  final borderColor = tokens.color(data['borderColor']);
  final image = data['backgroundImageUrl'];

  final decoration = BoxDecoration(
    color: tokens.color(data['color']),
    gradient: _gradient(context, data['gradient']),
    shape: isCircle ? BoxShape.circle : BoxShape.rectangle,
    borderRadius: isCircle || radius == null ? null : BorderRadius.circular(radius),
    border: (borderWidth != null && borderWidth > 0) || borderColor != null
        ? Border.all(width: borderWidth ?? 1, color: borderColor ?? const Color(0x33000000))
        : null,
    boxShadow: _shadows(context, data['shadows']),
    image: image is String && image.isNotEmpty
        ? DecorationImage(image: NetworkImage(image), fit: _boxFit(data['backgroundFit'] ?? 'cover'))
        : null,
  );
  final hasMargin = data['margin'] is Map;
  final box = Container(
    alignment: data['alignment'] == null ? null : _alignment(data['alignment']),
    width: _length(data['width']),
    height: _length(data['height']),
    padding: data['padding'] is Map ? _insets(context, data['padding']) : null,
    margin: hasMargin ? _insets(context, data['margin']) : null,
    clipBehavior: radius != null || isCircle ? Clip.antiAlias : Clip.none,
    decoration: decoration,
    child: _only(context, node, render),
  );
  return render.wrapNode(context, node, box);
}

Gradient? _gradient(BuildContext context, Object? value) {
  if (value is! Map) return null;
  final tokens = context.sduiTokens;
  final colors = <Color>[
    for (final entry in (value['colors'] is List ? value['colors'] as List : const []))
      if (tokens.color(entry) != null) tokens.color(entry)!,
  ];
  if (colors.length < 2) return null;
  if (value['type'] == 'radial') return RadialGradient(colors: colors);
  return LinearGradient(
    colors: colors,
    begin: _alignment(value['begin'], Alignment.topCenter),
    end: _alignment(value['end'], Alignment.bottomCenter),
  );
}

List<BoxShadow>? _shadows(BuildContext context, Object? value) {
  if (value is! List) return null;
  final tokens = context.sduiTokens;
  return [
    for (final entry in value)
      if (entry is Map)
        BoxShadow(
          color: tokens.color(entry['color']) ?? const Color(0x40000000),
          offset: Offset(_number(entry['offsetX']) ?? 0, _number(entry['offsetY']) ?? 0),
          blurRadius: _number(entry['blur']) ?? 0,
          spreadRadius: _number(entry['spread']) ?? 0,
        ),
  ];
}

Widget _visibility(BuildContext context, SduiNode node, SduiRender render) {
  final visible = node.boolean('visible');
  if (visible == null) throw SduiDataError(node, 'visible');
  final keepSpace = node.data['maintainSpace'] == true;
  return render.wrapNode(
    context,
    node,
    Visibility(
      visible: visible,
      maintainSize: keepSpace,
      maintainAnimation: keepSpace,
      maintainState: keepSpace,
      child: _only(context, node, render) ?? const SizedBox.shrink(),
    ),
  );
}

Widget _backdropBlur(BuildContext context, SduiNode node, SduiRender render) {
  final sigma = node.number('sigma') ?? 8;
  return render.wrapNode(
    context,
    node,
    ClipRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
        child: _only(context, node, render) ?? const SizedBox.shrink(),
      ),
    ),
  );
}

// Anything inside gets the Material tap ripple and runs the widget's own action when tapped.
Widget _inkWell(BuildContext context, SduiNode node, SduiRender render) {
  final radius = context.sduiTokens.radius(node.data['borderRadius']);
  return render.wrapNode(
    context,
    node,
    Material(
      type: MaterialType.transparency,
      child: InkWell(
        borderRadius: radius == null ? null : BorderRadius.circular(radius),
        onTap: node.action == null
            ? null
            : () => render.tap(context, action: node.action, event: node.analyticsEvent, params: node.analyticsParams),
        child: _only(context, node, render),
      ),
    ),
    tappable: false,
  );
}

Widget _safeArea(BuildContext context, SduiNode node, SduiRender render) => SafeArea(
      top: node.data['top'] != false,
      bottom: node.data['bottom'] != false,
      left: node.data['left'] != false,
      right: node.data['right'] != false,
      child: _only(context, node, render) ?? const SizedBox.shrink(),
    );

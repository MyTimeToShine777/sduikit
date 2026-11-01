import 'package:flutter/material.dart';

import 'layout.dart';
import 'model.dart';
import 'render.dart';
import 'theme.dart';

Map<String, dynamic> _asMap(Object? value) => value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

// The leaf blocks are the same things as the starter widgets, so they reuse that drawing code.
const _leafBlocks = {'text', 'image', 'button', 'spacer', 'divider'};

/// Draws one building block of a custom screen (and the blocks inside it).
/// A broken block is reported to `render.onError` and skipped; the rest of the screen is drawn.
Widget buildBlock(BuildContext context, SduiRender render, Object? json) {
  if (json is! Map) {
    render.onError?.call(const FormatException('A block on this screen is not valid and was skipped.'), null);
    return const SizedBox.shrink();
  }
  final block = Map<String, dynamic>.from(json);
  final kind = block['block'];
  final style = _asMap(block['style']);
  final action = block['action'] is Map ? _asMap(block['action']) : null;
  final gap = context.sduiTokens.space(block['gap']) ?? 0;

  List<Widget> childBlocks() {
    final children = block['children'];
    if (children is! List) return const [];
    return [for (final child in children) buildBlock(context, render, child)];
  }

  // Puts a gap between neighbours, in the direction of the layout.
  List<Widget> withGaps(List<Widget> children, {required bool horizontal}) {
    if (gap == 0) return children;
    return [
      for (var index = 0; index < children.length; index++) ...[
        if (index > 0) SizedBox(width: horizontal ? gap : 0, height: horizontal ? 0 : gap),
        children[index],
      ],
    ];
  }

  Widget styled(Widget child) => render.wrap(context, child, style: style, action: action);

  if (_leafBlocks.contains(kind)) {
    final data = Map<String, dynamic>.from(block)
      ..remove('block')
      ..remove('style')
      ..remove('action');
    return render.build(
      context,
      SduiNode(id: 'block', type: kind as String, version: 1, data: data, style: style, action: action),
    );
  }

  switch (kind) {
    case 'column':
      return styled(Column(crossAxisAlignment: CrossAxisAlignment.start, children: withGaps(childBlocks(), horizontal: false)));
    case 'row':
      return styled(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          // Flexible lets long text wrap instead of running off the screen.
          children: withGaps([for (final child in childBlocks()) Flexible(child: child)], horizontal: true),
        ),
      );
    case 'stack':
      return styled(Stack(children: childBlocks()));
    case 'grid':
      final columns = block['columns'];
      if (columns is! int || columns < 1) {
        render.onError?.call(const FormatException('A grid block needs "columns" of 1 or more.'), null);
        return const SizedBox.shrink();
      }
      return styled(SduiGridRows(columns: columns, gap: gap == 0 ? 8 : gap, children: childBlocks()));
    case 'scroll':
      return styled(
        SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: childBlocks()),
        ),
      );
    case 'widget':
      final node = SduiNode.tryParse(block['widget']);
      if (node == null) {
        render.onError?.call(const FormatException('A widget block does not hold a usable widget.'), null);
        return const SizedBox.shrink();
      }
      return render.build(context, node);
    default:
      render.onError?.call(FormatException('Unknown block "$kind", so it was skipped.'), null);
      return const SizedBox.shrink();
  }
}

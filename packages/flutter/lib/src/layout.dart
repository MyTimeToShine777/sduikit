import 'package:flutter/widgets.dart';

/// Lays children out in rows of [columns]. Works inside any parent, scrolling or not,
/// because it is plain rows in a column. [rowGap] and [columnGap] default to [gap]; [aspectRatio]
/// (width divided by height) gives every cell the same shape.
class SduiGridRows extends StatelessWidget {
  const SduiGridRows({
    super.key,
    required this.columns,
    required this.children,
    this.gap = 8,
    this.rowGap,
    this.columnGap,
    this.aspectRatio,
  });

  final int columns;
  final List<Widget> children;
  final double gap;
  final double? rowGap;
  final double? columnGap;
  final double? aspectRatio;

  @override
  Widget build(BuildContext context) {
    final across = columnGap ?? gap;
    final down = rowGap ?? gap;
    final rows = <Widget>[];
    for (var start = 0; start < children.length; start += columns) {
      final cells = <Widget>[];
      for (var offset = 0; offset < columns; offset++) {
        final index = start + offset;
        Widget cell = index < children.length ? children[index] : const SizedBox.shrink();
        if (aspectRatio != null && index < children.length) cell = AspectRatio(aspectRatio: aspectRatio!, child: ClipRect(child: cell));
        // The last row may have empty spots; keep them so every column stays the same width.
        cells.add(Expanded(child: cell));
        if (offset < columns - 1) cells.add(SizedBox(width: across));
      }
      rows.add(Row(crossAxisAlignment: CrossAxisAlignment.start, children: cells));
      if (start + columns < children.length) rows.add(SizedBox(height: down));
    }
    return Column(children: rows);
  }
}

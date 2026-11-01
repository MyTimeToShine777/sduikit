import 'package:flutter/widgets.dart';

/// Lays children out in rows of [columns]. Works inside any parent, scrolling or not,
/// because it is plain rows in a column.
class SduiGridRows extends StatelessWidget {
  const SduiGridRows({super.key, required this.columns, required this.children, this.gap = 8});

  final int columns;
  final List<Widget> children;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var start = 0; start < children.length; start += columns) {
      final cells = <Widget>[];
      for (var offset = 0; offset < columns; offset++) {
        final index = start + offset;
        // The last row may have empty spots; keep them so every column stays the same width.
        cells.add(Expanded(child: index < children.length ? children[index] : const SizedBox.shrink()));
        if (offset < columns - 1) cells.add(SizedBox(width: gap));
      }
      rows.add(Row(crossAxisAlignment: CrossAxisAlignment.start, children: cells));
      if (start + columns < children.length) rows.add(SizedBox(height: gap));
    }
    return Column(children: rows);
  }
}

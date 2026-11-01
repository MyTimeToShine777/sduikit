import 'dart:convert';

import 'package:flutter/material.dart';

import 'client.dart';
import 'layout.dart';
import 'model.dart';
import 'render.dart';
import 'template.dart';
import 'theme.dart';

/// The `data_list` widget: asks the app's data loader for rows and draws the template once per row.
Widget buildDataList(BuildContext context, SduiNode node, SduiRender render) {
  final source = node.data['source'];
  final name = source is Map && source['name'] is String ? source['name'] as String : '';
  if (name.isEmpty) throw SduiDataError(node, 'source');

  final template = node.list('template');
  if (template.isEmpty || template.first is! Map) throw SduiDataError(node, 'template');

  final loader = render.dataLoader;
  if (loader == null) {
    throw StateError('This app has no data loader, so the list "$name" could not be loaded.');
  }

  final params = source is Map && source['params'] is Map
      ? Map<String, dynamic>.from(source['params'] as Map)
      : <String, dynamic>{};
  return render.wrapNode(
    context,
    node,
    _SduiDataList(
      // A new key when the source changes makes the list load again.
      key: ValueKey('${node.id}|$name|${jsonEncode(params)}'),
      name: name,
      params: params,
      template: template.first,
      layout: node.string('layout') ?? 'list',
      columns: node.integer('columns') ?? 2,
      emptyText: node.string('emptyText'),
      spacing: context.sduiTokens.space(node.data['spacing']) ?? 0,
      dividers: node.boolean('dividers') ?? false,
      loadingRows: node.integer('loadingRows') ?? 3,
      errorText: node.string('errorText'),
      retryLabel: node.string('retryLabel'),
      itemWidth: node.number('itemWidth') ?? 0.85,
      height: node.number('height'),
      loader: loader,
      render: render,
      node: node,
    ),
  );
}

class _SduiDataList extends StatefulWidget {
  const _SduiDataList({
    super.key,
    required this.name,
    required this.params,
    required this.template,
    required this.layout,
    required this.columns,
    required this.emptyText,
    required this.spacing,
    required this.dividers,
    required this.loadingRows,
    required this.errorText,
    required this.retryLabel,
    required this.itemWidth,
    required this.height,
    required this.loader,
    required this.render,
    required this.node,
  });

  final String name;
  final Map<String, dynamic> params;
  final Object? template;
  final String layout;
  final int columns;
  final String? emptyText;
  final double spacing; // space between rows
  final bool dividers; // a line between rows
  final int loadingRows; // how many grey rows show while loading
  final String? errorText; // shown when the rows could not be loaded
  final String? retryLabel; // the retry button's words
  final double itemWidth; // in the carousel layout, how much of the width one row takes
  final double? height; // gives the list a fixed height that scrolls
  final SduiDataLoader loader;
  final SduiRender render;
  final SduiNode node;

  @override
  State<_SduiDataList> createState() => _SduiDataListState();
}

class _SduiDataListState extends State<_SduiDataList> {
  List<Map<String, dynamic>>? _rows;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await widget.loader(widget.name, widget.params).timeout(const Duration(seconds: 10));
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _failed = false;
      });
    } catch (error, stackTrace) {
      widget.render.onError?.call(error, stackTrace);
      if (!mounted) return;
      setState(() => _failed = true);
    }
  }

  void _retry() {
    setState(() => _failed = false);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) return _InlineRetry(onRetry: _retry, text: widget.errorText, retryLabel: widget.retryLabel);
    final rows = _rows;
    if (rows == null) return _LoadingRows(count: widget.loadingRows);

    if (rows.isEmpty) {
      final text = widget.emptyText;
      return text == null ? const SizedBox.shrink() : Padding(padding: const EdgeInsets.all(16), child: Text(text));
    }

    final items = <Widget>[];
    for (final row in rows) {
      final node = SduiNode.tryParse(fillTemplate(widget.template, row));
      if (node == null) {
        widget.render.onError?.call(const FormatException('A row of live data could not be turned into a widget.'), null);
        continue;
      }
      items.add(widget.render.part(context, widget.node, 'item', widget.render.build(context, node)));
    }

    final Widget list = switch (widget.layout) {
      'carousel' => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var index = 0; index < items.length; index++) ...[
                if (index > 0 && widget.spacing > 0) SizedBox(width: widget.spacing),
                SizedBox(width: MediaQuery.sizeOf(context).width * widget.itemWidth, child: items[index]),
              ],
            ],
          ),
        ),
      'grid' => SduiGridRows(columns: widget.columns, gap: widget.spacing > 0 ? widget.spacing : 8, children: items),
      _ => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var index = 0; index < items.length; index++) ...[
              if (index > 0 && widget.dividers) Divider(height: widget.spacing > 0 ? widget.spacing : null) else if (index > 0 && widget.spacing > 0) SizedBox(height: widget.spacing),
              items[index],
            ],
          ],
        ),
    };
    // With a `height`, the list scrolls inside that height.
    final height = widget.height;
    return height == null || widget.layout == 'carousel' ? list : SizedBox(height: height, child: SingleChildScrollView(child: list));
  }
}

class _LoadingRows extends StatelessWidget {
  const _LoadingRows({this.count = 3});

  final int count;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Padding(
      key: const Key('sdui-data-loading'),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          for (var i = 0; i < count; i++)
            Container(
              height: 64,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
            ),
        ],
      ),
    );
  }
}

class _InlineRetry extends StatelessWidget {
  const _InlineRetry({required this.onRetry, this.text, this.retryLabel});

  final VoidCallback onRetry;
  final String? text;
  final String? retryLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(text ?? 'We could not load this list.'),
          TextButton(onPressed: onRetry, child: Text(retryLabel ?? 'Try again')),
        ],
      ),
    );
  }
}

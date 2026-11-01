import 'dart:convert';

import 'package:flutter/material.dart';

import 'client.dart';
import 'layout.dart';
import 'model.dart';
import 'render.dart';
import 'template.dart';

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
    if (_failed) return _InlineRetry(onRetry: _retry);
    final rows = _rows;
    if (rows == null) return const _LoadingRows();

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

    switch (widget.layout) {
      case 'carousel':
        final width = MediaQuery.sizeOf(context).width * 0.85;
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [for (final item in items) SizedBox(width: width, child: item)],
          ),
        );
      case 'grid':
        return SduiGridRows(columns: widget.columns, children: items);
      default:
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: items);
    }
  }
}

class _LoadingRows extends StatelessWidget {
  const _LoadingRows();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Padding(
      key: const Key('sdui-data-loading'),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          for (var i = 0; i < 3; i++)
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
  const _InlineRetry({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Text('We could not load this list.'),
          TextButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

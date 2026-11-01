import 'package:flutter/material.dart';

import 'data_list_widget.dart';
import 'layout.dart';
import 'model.dart';
import 'registry.dart';
import 'render.dart';
import 'theme.dart';

/// Adds the 12 starter widgets (version 1) to a registry.
void registerBuiltInWidgets(SduiWidgetRegistry registry) {
  registry
    ..register('text', 1, _text)
    ..register('image', 1, _image)
    ..register('button', 1, _button)
    ..register('spacer', 1, _spacer)
    ..register('divider', 1, _divider)
    ..register('section_header', 1, _sectionHeader)
    ..register('card', 1, _card)
    ..register('banner', 1, _banner)
    ..register('carousel', 1, _carousel)
    ..register('list', 1, _list)
    ..register('grid', 1, _grid)
    ..register('tabs', 1, _tabs)
    ..register('data_list', 1, buildDataList);
}

TextAlign? _textAlign(Object? token) => switch (token) {
      'start' => TextAlign.start,
      'center' => TextAlign.center,
      'end' => TextAlign.end,
      _ => null,
    };

// Shown instead of a picture that cannot be loaded. The page layout stays the same.
class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder({this.height = 120});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      alignment: Alignment.center,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: const Icon(Icons.image_not_supported_outlined),
    );
  }
}

Widget _networkImage(String url, {double? height, BoxFit fit = BoxFit.cover, String? description}) {
  return Image.network(
    url,
    height: height,
    width: double.infinity,
    fit: fit,
    semanticLabel: description,
    errorBuilder: (context, error, stackTrace) => _ImagePlaceholder(height: height ?? 120),
  );
}

Widget _text(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  final align = _textAlign(node.style['align']);
  final maxLines = node.integer('maxLines');
  Widget text = Text(
    node.requireString('text'),
    maxLines: maxLines,
    overflow: maxLines == null ? null : TextOverflow.ellipsis,
    textAlign: align,
    style: TextStyle(
      fontSize: tokens.textSize(node.style['textSize']),
      color: tokens.color(node.style['textColor']),
    ),
  );
  // Text only lines up left/centre/right if it is as wide as the space it has.
  if (align != null) text = SizedBox(width: double.infinity, child: text);
  return render.wrapNode(context, node, text);
}

Widget _image(BuildContext context, SduiNode node, SduiRender render) {
  final image = _networkImage(
    node.requireString('url'),
    fit: node.string('fit') == 'contain' ? BoxFit.contain : BoxFit.cover,
    description: node.string('alt'),
  );
  final ratio = node.number('aspectRatio');
  return render.wrapNode(context, node, ratio == null ? image : AspectRatio(aspectRatio: ratio, child: image));
}

Widget _button(BuildContext context, SduiNode node, SduiRender render) {
  final label = node.requireString('label');
  void onPressed() => render.tap(
        context,
        action: node.action,
        event: node.analyticsEvent,
        params: node.analyticsParams,
      );
  final Widget button = switch (node.string('variant')) {
    'outline' => OutlinedButton(onPressed: onPressed, child: Text(label)),
    'text' => TextButton(onPressed: onPressed, child: Text(label)),
    _ => FilledButton(onPressed: onPressed, child: Text(label)),
  };
  return render.wrapNode(context, node, button, tappable: false);
}

Widget _spacer(BuildContext context, SduiNode node, SduiRender render) {
  final size = context.sduiTokens.space(node.requireString('size'));
  if (size == null) throw SduiDataError(node, 'size');
  return SizedBox(width: size, height: size);
}

Widget _divider(BuildContext context, SduiNode node, SduiRender render) {
  return render.wrapNode(context, node, const Divider());
}

Widget _sectionHeader(BuildContext context, SduiNode node, SduiRender render) {
  final title = node.requireString('title');
  final subtitle = node.string('subtitle');
  final actionLabel = node.string('actionLabel');
  final theme = Theme.of(context);
  final header = Row(
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: theme.textTheme.titleMedium),
            if (subtitle != null) Text(subtitle, style: theme.textTheme.bodySmall),
          ],
        ),
      ),
      if (actionLabel != null)
        TextButton(
          onPressed: () => render.tap(
            context,
            action: node.action,
            event: node.analyticsEvent,
            params: node.analyticsParams,
          ),
          child: Text(actionLabel),
        ),
    ],
  );
  // With an action label the button handles the tap; without one the whole header does.
  return render.wrapNode(context, node, header, tappable: actionLabel == null);
}

Widget _card(BuildContext context, SduiNode node, SduiRender render) {
  final title = node.string('title');
  final subtitle = node.string('subtitle');
  final imageUrl = node.string('imageUrl');
  final inside = node.list('children');
  if (title == null && subtitle == null && imageUrl == null && inside.isEmpty) {
    throw SduiDataError(node, 'title');
  }
  final theme = Theme.of(context);
  return render.wrapNode(
    context,
    node,
    Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (imageUrl != null) _networkImage(imageUrl, height: 120),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (title != null) Text(title, style: theme.textTheme.titleMedium),
                if (subtitle != null) Text(subtitle, style: theme.textTheme.bodySmall),
                ...render.children(context, inside),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _banner(BuildContext context, SduiNode node, SduiRender render) {
  final imageUrl = node.requireString('imageUrl');
  final title = node.string('title');
  final subtitle = node.string('subtitle');
  const onImage = TextStyle(color: Colors.white, shadows: [Shadow(blurRadius: 4)]);
  return render.wrapNode(
    context,
    node,
    SizedBox(
      height: 160,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _networkImage(imageUrl, height: 160),
          if (title != null || subtitle != null)
            Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (title != null)
                    Text(title, style: onImage.copyWith(fontSize: 20, fontWeight: FontWeight.bold)),
                  if (subtitle != null) Text(subtitle, style: onImage),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

Widget _carousel(BuildContext context, SduiNode node, SduiRender render) {
  final items = node.list('items');
  if (items.isEmpty) throw SduiDataError(node, 'items');
  // Each card is a fraction of the screen wide, so the next one peeks in and invites a swipe.
  final cardWidth = MediaQuery.sizeOf(context).width * (node.number('viewportFraction') ?? 0.85);
  final cards = render.children(context, items);
  return render.wrapNode(
    context,
    node,
    SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [for (final card in cards) SizedBox(width: cardWidth, child: card)],
      ),
    ),
  );
}

Widget _list(BuildContext context, SduiNode node, SduiRender render) {
  final items = node.list('items');
  if (items.isEmpty) throw SduiDataError(node, 'items');
  final rows = render.children(context, items);
  final withDividers = node.boolean('dividers') ?? false;
  return render.wrapNode(
    context,
    node,
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < rows.length; index++) ...[
          if (index > 0 && withDividers) const Divider(),
          rows[index],
        ],
      ],
    ),
  );
}

Widget _grid(BuildContext context, SduiNode node, SduiRender render) {
  final columns = node.integer('columns');
  if (columns == null || columns < 1) throw SduiDataError(node, 'columns');
  final items = node.list('items');
  if (items.isEmpty) throw SduiDataError(node, 'items');
  return render.wrapNode(
    context,
    node,
    SduiGridRows(columns: columns, children: render.children(context, items)),
  );
}

class _TabData {
  const _TabData(this.label, this.widgets);

  final String label;
  final List<dynamic> widgets;
}

Widget _tabs(BuildContext context, SduiNode node, SduiRender render) {
  final tabs = <_TabData>[];
  for (final raw in node.list('tabs')) {
    if (raw is Map && raw['label'] is String && raw['widgets'] is List) {
      tabs.add(_TabData(raw['label'] as String, raw['widgets'] as List));
    }
  }
  if (tabs.isEmpty) throw SduiDataError(node, 'tabs');
  return render.wrapNode(context, node, _SduiTabs(tabs: tabs, render: render));
}

class _SduiTabs extends StatefulWidget {
  const _SduiTabs({required this.tabs, required this.render});

  final List<_TabData> tabs;
  final SduiRender render;

  @override
  State<_SduiTabs> createState() => _SduiTabsState();
}

class _SduiTabsState extends State<_SduiTabs> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = widget.tabs;
    final selected = _selected < tabs.length ? _selected : 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (var index = 0; index < tabs.length; index++)
              ChoiceChip(
                label: Text(tabs[index].label),
                selected: index == selected,
                onSelected: (_) => setState(() => _selected = index),
              ),
          ],
        ),
        ...widget.render.children(context, tabs[selected].widgets),
      ],
    );
  }
}

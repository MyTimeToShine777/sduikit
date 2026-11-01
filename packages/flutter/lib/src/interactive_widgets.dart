import 'dart:async';

import 'package:flutter/material.dart';

import 'icons.dart';
import 'images.dart';
import 'layout.dart';
import 'model.dart';
import 'registry.dart';
import 'render.dart';
import 'theme.dart';

/// Adds the widgets people tap or that change over time: search_bar, chips, quick_actions,
/// accordion, countdown, gallery, video_card, hero, pricing_card, container.
void registerInteractiveWidgets(SduiWidgetRegistry registry) {
  registry
    ..register('search_bar', 1, _searchBar)
    ..register('chips', 1, _chips)
    ..register('quick_actions', 1, _quickActions)
    ..register('accordion', 1, _accordion)
    ..register('countdown', 1, _countdown)
    ..register('gallery', 1, _gallery)
    ..register('video_card', 1, _videoCard)
    ..register('hero', 1, _hero)
    ..register('pricing_card', 1, _pricingCard)
    ..register('container', 1, _container);
}

Map<String, dynamic>? _actionOf(Object? value) => value is Map ? Map<String, dynamic>.from(value) : null;

Widget _searchBar(BuildContext context, SduiNode node, SduiRender render) {
  final placeholder = node.requireString('placeholder');
  final theme = Theme.of(context);
  // A tap target that looks like a search box. The action says where the search happens
  // (for example open a search screen), so the page itself needs no text input.
  return render.wrapNode(
    context,
    node,
    render.part(
      context,
      node,
      'field',
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(color: theme.colorScheme.outline),
          borderRadius: BorderRadius.circular(context.sduiTokens.radius('full') ?? 24),
        ),
        child: Row(
          children: [
            const Icon(Icons.search),
            const SizedBox(width: 8),
            Expanded(
              child: render.partText(context, node, 'field', placeholder, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ),
          ],
        ),
      ),
    ),
  );
}

Widget _chips(BuildContext context, SduiNode node, SduiRender render) {
  final chips = [
    for (final raw in node.list('chips'))
      if (raw is Map && raw['label'] is String && (raw['label'] as String).isNotEmpty) Map<String, dynamic>.from(raw),
  ];
  if (chips.isEmpty) throw SduiDataError(node, 'chips');
  return render.wrapNode(
    context,
    node,
    Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final chip in chips)
          // Which chip looks selected comes from the page. A chip's action (usually call_api)
          // tells the server about the choice, and the next page load shows the new selection.
          FilterChip(
            label: render.partText(context, node, 'chip', chip['label'] as String),
            backgroundColor: context.sduiTokens.color(render.partLook(node, 'chip')['color']),
            shape: context.sduiTokens.radius(render.partLook(node, 'chip')['radius']) == null
                ? null
                : RoundedRectangleBorder(borderRadius: BorderRadius.circular(context.sduiTokens.radius(render.partLook(node, 'chip')['radius'])!)),
            selected: chip['selected'] == true,
            onSelected: (_) => render.tap(context, action: _actionOf(chip['action'])),
          ),
      ],
    ),
    tappable: false,
  );
}

Widget _quickActions(BuildContext context, SduiNode node, SduiRender render) {
  final theme = Theme.of(context);
  final cells = <Widget>[];
  for (final raw in node.list('items')) {
    if (raw is! Map || raw['label'] is! String) continue;
    final iconLook = render.partLook(node, 'icon');
    final tokens = context.sduiTokens;
    final circle = iconLook['width'] is num ? (iconLook['width'] as num).toDouble() / 2 : 24.0;
    cells.add(render.part(
      context,
      node,
      'item',
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => render.tap(context, action: _actionOf(raw['action'])),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: circle,
              backgroundColor: tokens.color(iconLook['color']) ?? theme.colorScheme.primaryContainer,
              child: Icon(
                sduiIcon(raw['icon']),
                size: tokens.textSize(iconLook['textSize']),
                color: tokens.color(iconLook['textColor']) ?? theme.colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: 6),
            render.partText(
              context,
              node,
              'label',
              raw['label'] as String,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelSmall,
            ),
          ],
        ),
      ),
    ));
  }
  if (cells.isEmpty) throw SduiDataError(node, 'items');
  return render.wrapNode(context, node, SduiGridRows(columns: node.integer('columns') ?? 4, children: cells), tappable: false);
}

Widget _accordion(BuildContext context, SduiNode node, SduiRender render) {
  final items = [
    for (final raw in node.list('items'))
      if (raw is Map && raw['title'] is String && raw['widgets'] is List) raw,
  ];
  if (items.isEmpty) throw SduiDataError(node, 'items');
  return render.wrapNode(
    context,
    node,
    _SduiAccordion(items: items, allowMultiple: node.boolean('allowMultiple') ?? false, render: render, node: node),
  );
}

class _SduiAccordion extends StatefulWidget {
  const _SduiAccordion({required this.items, required this.allowMultiple, required this.render, required this.node});

  final List<Map<dynamic, dynamic>> items;
  final bool allowMultiple;
  final SduiRender render;
  final SduiNode node;

  @override
  State<_SduiAccordion> createState() => _SduiAccordionState();
}

class _SduiAccordionState extends State<_SduiAccordion> {
  final Set<int> _open = {};

  void _toggle(int index) {
    setState(() {
      if (_open.contains(index)) {
        _open.remove(index);
      } else {
        if (!widget.allowMultiple) _open.clear();
        _open.add(index);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < widget.items.length; index++) ...[
          InkWell(
            onTap: () => _toggle(index),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  Expanded(child: widget.render.partText(context, widget.node, 'header', widget.items[index]['title'] as String, style: Theme.of(context).textTheme.titleSmall)),
                  Icon(_open.contains(index) ? Icons.expand_less : Icons.expand_more),
                ],
              ),
            ),
          ),
          if (_open.contains(index))
            widget.render.part(
              context,
              widget.node,
              'content',
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: widget.render.children(context, widget.items[index]['widgets'] as List)),
            ),
          const Divider(height: 1),
        ],
      ],
    );
  }
}

Widget _countdown(BuildContext context, SduiNode node, SduiRender render) {
  final until = DateTime.tryParse(node.requireString('until'));
  if (until == null) throw SduiDataError(node, 'until');
  return render.wrapNode(
    context,
    node,
    _SduiCountdown(until: until, label: node.string('label'), endedText: node.string('endedText'), now: render.now),
  );
}

class _SduiCountdown extends StatefulWidget {
  const _SduiCountdown({required this.until, required this.label, required this.endedText, required this.now});

  final DateTime until;
  final String? label;
  final String? endedText;
  final DateTime Function() now;

  @override
  State<_SduiCountdown> createState() => _SduiCountdownState();
}

class _SduiCountdownState extends State<_SduiCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Minutes are the smallest unit shown, so refreshing every 30 seconds is plenty.
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _remainingText(Duration left) {
    final days = left.inDays;
    final hours = left.inHours % 24;
    final minutes = left.inMinutes % 60;
    if (days > 0) return '${days}d ${hours}h ${minutes}m';
    if (left.inHours > 0) return '${left.inHours}h ${minutes}m';
    return '${left.inMinutes}m';
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.until.difference(widget.now());
    if (left.isNegative || left == Duration.zero) {
      final ended = widget.endedText;
      return ended == null ? const SizedBox.shrink() : Text(ended);
    }
    final label = widget.label;
    return Text(label == null ? _remainingText(left) : '$label ${_remainingText(left)}', style: Theme.of(context).textTheme.titleMedium);
  }
}

Widget _gallery(BuildContext context, SduiNode node, SduiRender render) {
  final images = [
    for (final raw in node.list('images'))
      if (raw is Map && raw['url'] is String) raw,
  ];
  if (images.isEmpty) throw SduiDataError(node, 'images');
  return render.wrapNode(
    context,
    node,
    _SduiGallery(images: images, aspectRatio: node.number('aspectRatio') ?? 16 / 9, showDots: node.boolean('showDots') ?? true, render: render, node: node),
  );
}

class _SduiGallery extends StatefulWidget {
  const _SduiGallery({required this.images, required this.aspectRatio, required this.showDots, required this.render, required this.node});

  final List<Map<dynamic, dynamic>> images;
  final double aspectRatio;
  final bool showDots;
  final SduiRender render;
  final SduiNode node;

  @override
  State<_SduiGallery> createState() => _SduiGalleryState();
}

class _SduiGalleryState extends State<_SduiGallery> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final tokens = context.sduiTokens;
    final dots = widget.render.partLook(widget.node, 'dots');
    final dotSize = dots['width'] is num ? (dots['width'] as num).toDouble() : 8.0;
    return Column(
      children: [
        AspectRatio(
          aspectRatio: widget.aspectRatio,
          child: PageView(
            onPageChanged: (page) => setState(() => _page = page),
            children: [
              for (final image in widget.images)
                widget.render.part(context, widget.node, 'image', sduiNetworkImage(image['url'] as String, description: image['alt'] is String ? image['alt'] as String : null)),
            ],
          ),
        ),
        if (widget.showDots && widget.images.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var index = 0; index < widget.images.length; index++)
                  Container(
                    key: Key('sdui-gallery-dot-$index'),
                    width: dotSize,
                    height: dotSize,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: index == _page
                          ? (tokens.color(dots['color']) ?? Theme.of(context).colorScheme.primary)
                          : (tokens.color(dots['borderColor']) ?? Theme.of(context).colorScheme.outlineVariant),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

Widget _videoCard(BuildContext context, SduiNode node, SduiRender render) {
  final thumbnail = node.requireString('thumbnailUrl');
  final title = node.string('title');
  final duration = node.string('duration');
  const onImage = TextStyle(color: Colors.white, shadows: [Shadow(blurRadius: 4)]);
  // The package does not play video itself. The action (usually open_url or open_native) hands
  // the video to the app, which can use whichever player it prefers.
  return render.wrapNode(
    context,
    node,
    AspectRatio(
      aspectRatio: 16 / 9,
      child: Stack(
        fit: StackFit.expand,
        children: [
          render.part(context, node, 'image', sduiNetworkImage(thumbnail)),
          Center(
            child: CircleAvatar(
              radius: render.partLook(node, 'play')['width'] is num ? (render.partLook(node, 'play')['width'] as num).toDouble() / 2 : 28,
              backgroundColor: context.sduiTokens.color(render.partLook(node, 'play')['color']) ?? Colors.black54,
              child: Icon(
                Icons.play_arrow,
                color: context.sduiTokens.color(render.partLook(node, 'play')['textColor']) ?? Colors.white,
                size: context.sduiTokens.textSize(render.partLook(node, 'play')['textSize']) ?? 32,
              ),
            ),
          ),
          if (title != null) Positioned(left: 12, bottom: 12, right: 64, child: render.partText(context, node, 'title', title, style: onImage.copyWith(fontWeight: FontWeight.bold))),
          if (duration != null) Positioned(right: 12, bottom: 12, child: render.partText(context, node, 'duration', duration, style: onImage)),
        ],
      ),
    ),
  );
}

Widget _hero(BuildContext context, SduiNode node, SduiRender render) {
  final imageUrl = node.requireString('imageUrl');
  final title = node.requireString('title');
  final subtitle = node.string('subtitle');
  final ctaLabel = node.string('ctaLabel');
  const onImage = TextStyle(color: Colors.white, shadows: [Shadow(blurRadius: 6)]);
  return render.wrapNode(
    context,
    node,
    SizedBox(
      height: 240,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          render.part(context, node, 'image', sduiNetworkImage(imageUrl, height: 240)),
          const DecoratedBox(
            decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black54])),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                render.partText(context, node, 'title', title, style: onImage.copyWith(fontSize: 26, fontWeight: FontWeight.bold)),
                if (subtitle != null) render.partText(context, node, 'subtitle', subtitle, style: onImage.copyWith(fontSize: 16)),
                if (ctaLabel != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: render.partButton(
                      context,
                      node,
                      'button',
                      (style) => FilledButton(
                        style: style,
                        onPressed: () => render.tap(context, action: node.action, event: node.analyticsEvent, params: node.analyticsParams),
                        child: Text(ctaLabel),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
    tappable: ctaLabel == null,
  );
}

Widget _pricingCard(BuildContext context, SduiNode node, SduiRender render) {
  final name = node.requireString('name');
  final price = node.requireString('price');
  final period = node.string('period');
  final features = [for (final feature in node.list('features')) if (feature is String) feature];
  final highlighted = node.boolean('highlighted') ?? false;
  final ctaLabel = node.string('ctaLabel');
  final theme = Theme.of(context);
  return render.wrapNode(
    context,
    node,
    Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: highlighted ? theme.colorScheme.primary : theme.colorScheme.outlineVariant, width: highlighted ? 2 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            render.partText(context, node, 'name', name, style: theme.textTheme.titleMedium),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                render.partText(context, node, 'price', price, style: theme.textTheme.headlineMedium),
                if (period != null)
                  Padding(padding: const EdgeInsetsDirectional.only(start: 6, bottom: 4), child: render.partText(context, node, 'period', period, style: theme.textTheme.bodySmall)),
              ],
            ),
            const SizedBox(height: 8),
            for (final feature in features)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(children: [Icon(Icons.check, size: 18, color: theme.colorScheme.primary), const SizedBox(width: 8), Expanded(child: render.partText(context, node, 'feature', feature))]),
              ),
            if (ctaLabel != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: SizedBox(
                  width: double.infinity,
                  child: render.partButton(
                    context,
                    node,
                    'button',
                    (style) => FilledButton(
                      style: style,
                      onPressed: () => render.tap(context, action: node.action, event: node.analyticsEvent, params: node.analyticsParams),
                      child: Text(ctaLabel),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
    tappable: ctaLabel == null,
  );
}

Widget _container(BuildContext context, SduiNode node, SduiRender render) {
  final children = render.children(context, node.list('children'));
  if (node.list('children').isEmpty) throw SduiDataError(node, 'children');
  final gap = context.sduiTokens.space(node.string('gap')) ?? 0;
  final horizontal = node.string('direction') == 'horizontal';
  final spaced = <Widget>[
    for (var index = 0; index < children.length; index++) ...[
      if (index > 0) SizedBox(width: horizontal ? gap : 0, height: horizontal ? 0 : gap),
      horizontal ? Flexible(child: children[index]) : children[index],
    ],
  ];
  return render.wrapNode(
    context,
    node,
    horizontal
        ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: spaced)
        : Column(crossAxisAlignment: CrossAxisAlignment.start, children: spaced),
  );
}

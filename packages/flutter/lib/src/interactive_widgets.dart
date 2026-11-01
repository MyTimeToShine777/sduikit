import 'dart:async';

import 'package:flutter/material.dart';

import 'icons.dart';
import 'images.dart';
import 'layout.dart';
import 'model.dart';
import 'options.dart';
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
  final leading = node.string('leadingIcon');
  final trailing = node.string('trailingIcon');
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
        height: node.number('height'),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: node.boolean('filled') == true ? theme.colorScheme.surfaceContainerHighest : null,
          border: node.boolean('filled') == true ? null : Border.all(color: theme.colorScheme.outline),
          borderRadius: BorderRadius.circular(context.sduiTokens.radius('full') ?? 24),
        ),
        child: Row(
          children: [
            Icon(leading == null ? Icons.search : sduiIcon(leading)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                placeholder,
                style: (theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant) ?? const TextStyle()).merge(render.partTextStyle(context, node, 'field')),
              ),
            ),
            if (trailing != null) Icon(sduiIcon(trailing)),
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
  final tokens = context.sduiTokens;
  final look = render.partLook(node, 'chip');
  final background = tokens.color(look['color']);
  final radius = tokens.radius(look['radius']);
  final shape = radius == null ? null : RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius));
  final variant = node.string('variant') ?? 'filter';

  Widget chipFor(Map<String, dynamic> chip) {
    // The chip itself takes the part's colour and corners; the text takes its text look.
    final label = Text(chip['label'] as String, style: render.partTextStyle(context, node, 'chip'));
    final disabled = chip['disabled'] == true;
    final selected = chip['selected'] == true;
    final Widget? avatar = chip['avatarUrl'] is String
        ? CircleAvatar(backgroundImage: NetworkImage(chip['avatarUrl'] as String), onBackgroundImageError: (_, __) {})
        : (chip['icon'] is String ? Icon(sduiIcon(chip['icon']), size: 18) : null);
    // Which chip looks selected comes from the page. A chip's action (usually call_api)
    // tells the server about the choice, and the next page load shows the new selection.
    void press() => render.tap(context, action: _actionOf(chip['action']));
    return switch (variant) {
      'choice' => ChoiceChip(label: label, avatar: avatar, selected: selected, backgroundColor: background, shape: shape, onSelected: disabled ? null : (_) => press()),
      'input' => InputChip(label: label, avatar: avatar, selected: selected, backgroundColor: background, shape: shape, onSelected: disabled ? null : (_) => press(), onDeleted: disabled ? null : press),
      'assist' => ActionChip(label: label, avatar: avatar, backgroundColor: background, shape: shape, onPressed: disabled ? null : press),
      _ => FilterChip(label: label, avatar: avatar, selected: selected, backgroundColor: background, shape: shape, onSelected: disabled ? null : (_) => press()),
    };
  }

  final spacing = tokens.space(node.data['spacing']) ?? 8;
  final runSpacing = tokens.space(node.data['runSpacing']) ?? 8;
  final Widget group = node.boolean('scrollable') == true
      ? SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [for (var index = 0; index < chips.length; index++) ...[if (index > 0) SizedBox(width: spacing), chipFor(chips[index])]]),
        )
      : Wrap(
          spacing: spacing,
          runSpacing: runSpacing,
          alignment: sduiWrapAlignment(node.string('alignment')),
          children: [for (final chip in chips) chipFor(chip)],
        );
  return render.wrapNode(context, node, group, tappable: false);
}

Widget _quickActions(BuildContext context, SduiNode node, SduiRender render) {
  final theme = Theme.of(context);
  final tokens = context.sduiTokens;
  final cells = <Widget>[];
  final iconLook = render.partLook(node, 'icon');
  final diameter = node.number('size') ?? (iconLook['width'] is num ? (iconLook['width'] as num).toDouble() : 48.0);
  final shape = node.string('shape');
  final showLabels = node.boolean('showLabels') != false;
  for (final raw in node.list('items')) {
    if (raw is! Map || raw['label'] is! String) continue;
    final badge = raw['badge'] is String ? raw['badge'] as String : null;
    final circle = Container(
      width: diameter,
      height: diameter,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tokens.color(iconLook['color']) ?? theme.colorScheme.primaryContainer,
        shape: shape == null || shape == 'circle' ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: shape == 'rounded' ? BorderRadius.circular(diameter / 3.4) : null,
      ),
      child: Icon(
        sduiIcon(raw['icon']),
        size: node.number('iconSize') ?? tokens.textSize(iconLook['textSize']),
        color: tokens.color(iconLook['textColor']) ?? theme.colorScheme.onPrimaryContainer,
      ),
    );
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
            // A small red label in the corner, such as a count of new things.
            badge == null
                ? circle
                : Stack(
                    clipBehavior: Clip.none,
                    children: [
                      circle,
                      Positioned(
                        top: -4,
                        right: -4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(color: theme.colorScheme.error, borderRadius: BorderRadius.circular(10)),
                          child: Text(badge, style: TextStyle(color: theme.colorScheme.onError, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
            if (showLabels) ...[
              const SizedBox(height: 6),
              render.partText(
                context,
                node,
                'label',
                raw['label'] as String,
                textAlign: TextAlign.center,
                maxLines: node.integer('labelMaxLines') ?? 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall,
              ),
            ],
          ],
        ),
      ),
    ));
  }
  if (cells.isEmpty) throw SduiDataError(node, 'items');
  final gap = tokens.space(node.data['spacing']);
  return render.wrapNode(
    context,
    node,
    SduiGridRows(columns: node.integer('columns') ?? 4, gap: gap ?? 8, children: cells),
    tappable: false,
  );
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
  late final Set<int> _open = _startOpen();

  // Which sections are open to begin with (`initiallyOpen`); only the first one if several may not be open at once.
  Set<int> _startOpen() {
    final wanted = [for (final index in widget.node.list('initiallyOpen')) if (index is int && index >= 0 && index < widget.items.length) index];
    return (widget.allowMultiple ? wanted : wanted.take(1)).toSet();
  }

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
    final iconAtStart = widget.node.string('iconPosition') == 'start';
    final dividers = widget.node.boolean('dividers') != false;
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
                  if (iconAtStart) Icon(_open.contains(index) ? Icons.expand_less : Icons.expand_more),
                  if (iconAtStart) const SizedBox(width: 12),
                  if (widget.items[index]['icon'] is String) ...[Icon(sduiIcon(widget.items[index]['icon'])), const SizedBox(width: 8)],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        widget.render.partText(context, widget.node, 'header', widget.items[index]['title'] as String, style: Theme.of(context).textTheme.titleSmall),
                        if (widget.items[index]['subtitle'] is String)
                          Text(widget.items[index]['subtitle'] as String, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  if (!iconAtStart) Icon(_open.contains(index) ? Icons.expand_less : Icons.expand_more),
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
          if (dividers) const Divider(height: 1),
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
    _SduiCountdown(
      until: until,
      label: node.string('label'),
      endedText: node.string('endedText'),
      now: render.now,
      format: node.string('format') ?? 'compact',
      showSeconds: node.boolean('showSeconds') ?? false,
      hideWhenEnded: node.boolean('hideWhenEnded') ?? false,
      prefix: node.string('prefix') ?? '',
      suffix: node.string('suffix') ?? '',
    ),
  );
}

class _SduiCountdown extends StatefulWidget {
  const _SduiCountdown({
    required this.until,
    required this.label,
    required this.endedText,
    required this.now,
    required this.format,
    required this.showSeconds,
    required this.hideWhenEnded,
    required this.prefix,
    required this.suffix,
  });

  final DateTime until;
  final String? label;
  final String? endedText;
  final DateTime Function() now;
  final String format; // compact, long or clock
  final bool showSeconds;
  final bool hideWhenEnded;
  final String prefix;
  final String suffix;

  @override
  State<_SduiCountdown> createState() => _SduiCountdownState();
}

class _SduiCountdownState extends State<_SduiCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Minutes are the smallest unit shown unless seconds are asked for, so otherwise every 30 seconds is plenty.
    _timer = Timer.periodic(widget.showSeconds ? const Duration(seconds: 1) : const Duration(seconds: 30), (_) => setState(() {}));
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
    final seconds = left.inSeconds % 60;
    String two(int value) => value.toString().padLeft(2, '0');
    String plural(int value, String word) => '$value $word${value == 1 ? '' : 's'}';
    if (widget.format == 'clock') {
      return '${two(left.inHours)}:${two(minutes)}${widget.showSeconds ? ':${two(seconds)}' : ''}';
    }
    if (widget.format == 'long') {
      return [
        if (days > 0) plural(days, 'day'),
        if (days > 0 || hours > 0) plural(hours, 'hour'),
        plural(minutes, 'minute'),
        if (widget.showSeconds) plural(seconds, 'second'),
      ].join(' ');
    }
    final compact = days > 0 ? '${days}d ${hours}h ${minutes}m' : (left.inHours > 0 ? '${left.inHours}h ${minutes}m' : '${left.inMinutes}m');
    return widget.showSeconds ? '$compact ${seconds}s' : compact;
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.until.difference(widget.now());
    if (left.isNegative || left == Duration.zero) {
      final ended = widget.endedText;
      return (ended == null || widget.hideWhenEnded) ? const SizedBox.shrink() : Text(ended);
    }
    final label = widget.label;
    final text = label == null ? _remainingText(left) : '$label ${_remainingText(left)}';
    return Text('${widget.prefix}$text${widget.suffix}', style: Theme.of(context).textTheme.titleMedium);
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
    _SduiGallery(
      images: images,
      aspectRatio: node.number('aspectRatio') ?? 16 / 9,
      showDots: node.boolean('showDots') ?? true,
      render: render,
      node: node,
    ),
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
  late final PageController _controller = PageController(viewportFraction: widget.node.number('viewportFraction') ?? 1);
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    if (widget.node.boolean('autoplay') == true && widget.images.length > 1) {
      final seconds = widget.node.number('autoplayInterval') ?? 4;
      _timer = Timer.periodic(Duration(milliseconds: (seconds * 1000).round()), (_) => _next());
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (!mounted || !_controller.hasClients) return;
    final atEnd = _page >= widget.images.length - 1;
    // With `loop` it starts again after the last picture; without, it stops there.
    if (atEnd && widget.node.boolean('loop') == false) return;
    _controller.animateToPage(atEnd ? 0 : _page + 1, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.sduiTokens;
    final dots = widget.render.partLook(widget.node, 'dots');
    final dotSize = dots['width'] is num ? (dots['width'] as num).toDouble() : 8.0;
    final fit = sduiBoxFit(widget.node.string('fit'));
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Stack(
          children: [
            AspectRatio(
              aspectRatio: widget.aspectRatio,
              child: PageView(
                controller: _controller,
                onPageChanged: (page) => setState(() => _page = page),
                children: [
                  for (final image in widget.images)
                    widget.render.part(
                      context,
                      widget.node,
                      'image',
                      Stack(
                        fit: StackFit.expand,
                        children: [
                          sduiNetworkImage(image['url'] as String, fit: fit, description: image['alt'] is String ? image['alt'] as String : null),
                          if (image['caption'] is String)
                            Positioned(
                              left: 12,
                              right: 12,
                              bottom: 12,
                              child: Text(image['caption'] as String, style: const TextStyle(color: Colors.white, shadows: [Shadow(blurRadius: 4)])),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            // "2 / 5" in the corner.
            if (widget.node.boolean('showCounter') == true)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
                  child: Text('${_page + 1} / ${widget.images.length}', style: const TextStyle(color: Colors.white, fontSize: 12)),
                ),
              ),
          ],
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
                          ? (tokens.color(dots['color']) ?? scheme.primary)
                          : (tokens.color(dots['borderColor']) ?? scheme.outlineVariant),
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
  final subtitle = node.string('subtitle');
  final duration = node.string('duration');
  final badge = node.string('badge');
  final tokens = context.sduiTokens;
  const onImage = TextStyle(color: Colors.white, shadows: [Shadow(blurRadius: 4)]);
  final playLook = render.partLook(node, 'play');
  // The package does not play video itself. The action (usually open_url or open_native) hands
  // the video to the app, which can use whichever player it prefers.
  return render.wrapNode(
    context,
    node,
    AspectRatio(
      aspectRatio: node.number('aspectRatio') ?? 16 / 9,
      child: Stack(
        fit: StackFit.expand,
        children: [
          render.part(context, node, 'image', sduiNetworkImage(thumbnail)),
          // A fade to dark at the bottom keeps the text readable.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black.withValues(alpha: node.number('overlayOpacity') ?? 0.55)],
                ),
              ),
            ),
          ),
          if (node.boolean('showPlay') != false)
            Center(
              child: CircleAvatar(
                radius: playLook['width'] is num ? (playLook['width'] as num).toDouble() / 2 : 28,
                backgroundColor: tokens.color(playLook['color']) ?? Colors.black54,
                child: Icon(
                  Icons.play_arrow,
                  color: tokens.color(playLook['textColor']) ?? Colors.white,
                  size: tokens.textSize(playLook['textSize']) ?? 32,
                ),
              ),
            ),
          if (badge != null)
            Positioned(
              left: 12,
              top: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(12)),
                child: Text(badge, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ),
          if (title != null || subtitle != null)
            Positioned(
              left: 12,
              bottom: 12,
              right: 64,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (title != null) render.partText(context, node, 'title', title, style: onImage.copyWith(fontWeight: FontWeight.bold)),
                  if (subtitle != null) Text(subtitle, style: onImage.copyWith(fontSize: 12)),
                ],
              ),
            ),
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
  final height = node.number('height') ?? 240;
  final place = sduiAlignment(node.string('contentAlignment'), Alignment.bottomLeft);
  const onImage = TextStyle(color: Colors.white, shadows: [Shadow(blurRadius: 6)]);
  return render.wrapNode(
    context,
    node,
    SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          render.part(context, node, 'image', sduiNetworkImage(imageUrl, height: height, fit: sduiBoxFit(node.string('imageFit')))),
          sduiPictureOverlay(context, node, render),
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Align(
                alignment: place,
                child: Column(
                  crossAxisAlignment: sduiCrossFor(place),
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    render.partText(context, node, 'title', title, style: onImage.copyWith(fontSize: 26, fontWeight: FontWeight.bold), textAlign: sduiTextAlignFor(place)),
                    if (subtitle != null) render.partText(context, node, 'subtitle', subtitle, style: onImage.copyWith(fontSize: 16), textAlign: sduiTextAlignFor(place)),
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
  final disabled = [for (final feature in node.list('disabledFeatures')) if (feature is String) feature];
  final highlighted = node.boolean('highlighted') ?? false;
  final ctaLabel = node.string('ctaLabel');
  final badge = node.string('badge');
  final originalPrice = node.string('originalPrice');
  final description = node.string('description');
  final featureIcon = node.string('featureIcon');
  final theme = Theme.of(context);
  final card = Card(
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
          if (description != null) Text(description, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // The old price, crossed out, before the new one.
              if (originalPrice != null)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8, bottom: 4),
                  child: Text(originalPrice, style: theme.textTheme.titleSmall?.copyWith(decoration: TextDecoration.lineThrough, color: theme.colorScheme.onSurfaceVariant)),
                ),
              render.partText(context, node, 'price', price, style: theme.textTheme.headlineMedium),
              if (period != null)
                Padding(padding: const EdgeInsetsDirectional.only(start: 6, bottom: 4), child: render.partText(context, node, 'period', period, style: theme.textTheme.bodySmall)),
            ],
          ),
          const SizedBox(height: 8),
          for (final feature in features)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(children: [
                Icon(featureIcon == null ? Icons.check : sduiIcon(featureIcon), size: 18, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Expanded(child: render.partText(context, node, 'feature', feature)),
              ]),
            ),
          // Things this plan does not include: greyed out and crossed out.
          for (final feature in disabled)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(children: [
                Icon(Icons.close, size: 18, color: theme.colorScheme.outline),
                const SizedBox(width: 8),
                Expanded(
                  child: render.partText(context, node, 'feature', feature, style: TextStyle(decoration: TextDecoration.lineThrough, color: theme.colorScheme.outline)),
                ),
              ]),
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
  );
  return render.wrapNode(
    context,
    node,
    badge == null
        ? card
        : Stack(
            clipBehavior: Clip.none,
            children: [
              card,
              PositionedDirectional(
                top: -4,
                end: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(12)),
                  child: Text(badge, style: TextStyle(color: theme.colorScheme.onPrimary, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
    tappable: ctaLabel == null,
  );
}

Widget _container(BuildContext context, SduiNode node, SduiRender render) {
  final children = render.children(context, node.list('children'));
  if (node.list('children').isEmpty) throw SduiDataError(node, 'children');
  final gap = context.sduiTokens.space(node.string('gap')) ?? 0;
  final horizontal = node.string('direction') == 'horizontal';
  // `wrap` lets the children flow onto a new line when they run out of room.
  if (node.boolean('wrap') == true) {
    return render.wrapNode(
      context,
      node,
      Wrap(
        direction: horizontal ? Axis.horizontal : Axis.vertical,
        spacing: gap,
        runSpacing: gap,
        children: children,
      ),
    );
  }
  final spaced = <Widget>[
    for (var index = 0; index < children.length; index++) ...[
      if (index > 0) SizedBox(width: horizontal ? gap : 0, height: horizontal ? 0 : gap),
      horizontal ? Flexible(child: children[index]) : children[index],
    ],
  ];
  final main = sduiMainAxis(node.string('mainAxisAlignment'));
  final cross = sduiCrossAxis(node.string('crossAxisAlignment'));
  return render.wrapNode(
    context,
    node,
    horizontal
        ? Row(mainAxisAlignment: main, crossAxisAlignment: cross, children: spaced)
        : Column(mainAxisAlignment: main, crossAxisAlignment: cross, children: spaced),
  );
}

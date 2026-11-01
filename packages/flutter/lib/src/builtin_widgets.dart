import 'dart:async';

import 'package:flutter/material.dart';

import 'building_blocks.dart';
import 'data_list_widget.dart';
import 'display_widgets.dart';
import 'form_widget.dart';
import 'icons.dart';
import 'images.dart';
import 'interactive_widgets.dart';
import 'layout.dart';
import 'model.dart';
import 'options.dart';
import 'registry.dart';
import 'render.dart';
import 'theme.dart';

/// Adds every built-in widget (all 66, version 1) to a registry. The first 14 are registered here;
/// the display, interactive and building-block widgets are registered by their own files (last three lines).
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
    ..register('data_list', 1, buildDataList)
    ..register('form', 1, buildForm);
  registerDisplayWidgets(registry);
  registerInteractiveWidgets(registry);
  registerBuildingBlocks(registry);
}

TextAlign? _textAlign(Object? token) => switch (token) {
      'start' => TextAlign.start,
      'center' => TextAlign.center,
      'end' => TextAlign.end,
      _ => null,
    };

Widget _text(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  final align = _textAlign(node.style['align']);
  final maxLines = node.integer('maxLines');
  final value = node.requireString('text');
  final style = TextStyle(
    fontSize: tokens.textSize(node.style['textSize']),
    color: tokens.color(node.style['textColor']),
  );
  // `selectable` lets the person select and copy the text.
  Widget text = node.boolean('selectable') == true
      ? SelectableText(value, maxLines: maxLines, textAlign: align, style: style)
      : Text(
          value,
          maxLines: maxLines,
          // The widget's own `maxLines` ends with "..." unless the style says otherwise; the style's own limit is applied around it.
          overflow: maxLines == null ? null : TextOverflow.ellipsis,
          textAlign: align,
          semanticsLabel: node.string('semanticsLabel'),
          style: style,
        );
  // Text only lines up left/centre/right if it is as wide as the space it has.
  if (align != null) text = SizedBox(width: double.infinity, child: text);
  return render.wrapNode(context, node, text);
}

Widget _image(BuildContext context, SduiNode node, SduiRender render) {
  final image = sduiNetworkImage(
    node.requireString('url'),
    fit: sduiBoxFit(node.string('fit')),
    description: node.string('alt'),
    alignment: sduiAlignment(node.string('alignment')),
    repeat: sduiRepeat(node.string('repeat')),
    grayscale: node.boolean('grayscale') == true,
    placeholderColor: context.sduiTokens.color(node.string('placeholderColor')),
    errorText: node.string('errorText'),
    showLoader: node.boolean('showLoader') == true,
  );
  final ratio = node.number('aspectRatio');
  return render.wrapNode(context, node, render.part(context, node, 'image', ratio == null ? image : AspectRatio(aspectRatio: ratio, child: image)));
}

Widget _button(BuildContext context, SduiNode node, SduiRender render) {
  final label = node.requireString('label');
  final loading = node.boolean('loading') == true;
  final enabled = node.boolean('enabled') != false && !loading;
  void onPressed() => render.tap(
        context,
        action: node.action,
        event: node.analyticsEvent,
        params: node.analyticsParams,
      );

  // An icon before or after the label; while loading, a small spinner takes the icon's place.
  final iconName = node.string('icon');
  final Widget? mark = loading
      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
      : (iconName == null ? null : Icon(sduiIcon(iconName), size: 18));
  final iconAtEnd = node.string('iconPosition') == 'end' && !loading;
  final Widget content = mark == null
      ? Text(label)
      : Row(
          mainAxisSize: MainAxisSize.min,
          children: iconAtEnd ? [Text(label), const SizedBox(width: 8), mark] : [mark, const SizedBox(width: 8), Text(label)],
        );

  // Small and large change the padding and the text size.
  final sizeStyle = switch (node.string('size')) {
    'small' => const ButtonStyle(
        padding: WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 12, vertical: 4)),
        textStyle: WidgetStatePropertyAll(TextStyle(fontSize: 12)),
        minimumSize: WidgetStatePropertyAll(Size(0, 32)),
      ),
    'large' => const ButtonStyle(
        padding: WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 32, vertical: 16)),
        textStyle: WidgetStatePropertyAll(TextStyle(fontSize: 16)),
        minimumSize: WidgetStatePropertyAll(Size(0, 52)),
      ),
    _ => null,
  };

  Widget button = render.partButton(context, node, 'button', (look) {
    final style = sizeStyle == null ? look : (look == null ? sizeStyle : sizeStyle.merge(look));
    final VoidCallback? press = enabled ? onPressed : null;
    return switch (node.string('variant')) {
      'outline' => OutlinedButton(style: style, onPressed: press, child: content),
      'text' => TextButton(style: style, onPressed: press, child: content),
      'tonal' => FilledButton.tonal(style: style, onPressed: press, child: content),
      'elevated' => ElevatedButton(style: style, onPressed: press, child: content),
      _ => FilledButton(style: style, onPressed: press, child: content),
    };
  });
  if (node.boolean('fullWidth') == true) button = SizedBox(width: double.infinity, child: button);
  final tip = node.string('tooltip');
  if (tip != null) button = Tooltip(message: tip, child: button);
  return render.wrapNode(context, node, button, tappable: false);
}

Widget _spacer(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  final size = tokens.space(node.data['size']);
  // `width` and `height` each override `size` for their own direction.
  final width = tokens.space(node.data['width']) ?? size;
  final height = tokens.space(node.data['height']) ?? size;
  if (width == null && height == null) throw SduiDataError(node, 'size');
  return SizedBox(width: width ?? 0, height: height ?? 0);
}

Widget _divider(BuildContext context, SduiNode node, SduiRender render) {
  final line = render.partLook(node, 'line');
  final tokens = context.sduiTokens;
  final thickness = line['height'] is num ? (line['height'] as num).toDouble() : node.number('thickness');
  final color = tokens.color(line['color']) ?? tokens.color(node.data['color']);
  final extent = tokens.space(node.data['space']);
  final indent = (line['margin'] is Map ? tokens.space((line['margin'] as Map)['left']) : null) ?? tokens.space(node.data['indent']);
  final endIndent = (line['margin'] is Map ? tokens.space((line['margin'] as Map)['right']) : null) ?? tokens.space(node.data['endIndent']);
  final Widget divider = node.boolean('vertical') == true
      ? IntrinsicHeight(child: VerticalDivider(width: extent, thickness: thickness, indent: indent, endIndent: endIndent, color: color))
      : Divider(height: extent, thickness: thickness, indent: indent, endIndent: endIndent, color: color);
  return render.wrapNode(context, node, divider);
}

Widget _sectionHeader(BuildContext context, SduiNode node, SduiRender render) {
  final title = node.requireString('title');
  final subtitle = node.string('subtitle');
  final actionLabel = node.string('actionLabel');
  final iconName = node.string('icon');
  final actionIcon = node.string('actionIcon');
  final theme = Theme.of(context);
  final header = Row(
    children: [
      if (iconName != null) ...[Icon(sduiIcon(iconName)), const SizedBox(width: 8)],
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            render.partText(
              context,
              node,
              'title',
              node.boolean('uppercase') == true ? title.toUpperCase() : title,
              style: theme.textTheme.titleMedium,
              maxLines: node.integer('titleMaxLines'),
              overflow: node.integer('titleMaxLines') == null ? null : TextOverflow.ellipsis,
            ),
            if (subtitle != null) render.partText(context, node, 'subtitle', subtitle, style: theme.textTheme.bodySmall),
          ],
        ),
      ),
      if (actionLabel != null)
        render.partButton(context, node, 'action', (style) {
          void press() => render.tap(
                context,
                action: node.action,
                event: node.analyticsEvent,
                params: node.analyticsParams,
              );
          return actionIcon == null
              ? TextButton(style: style, onPressed: press, child: Text(actionLabel))
              : TextButton.icon(style: style, onPressed: press, icon: Icon(sduiIcon(actionIcon), size: 18), label: Text(actionLabel), iconAlignment: IconAlignment.end);
        }),
    ],
  );
  final Widget content = node.boolean('showDivider') == true ? Column(children: [header, const Divider()]) : header;
  // With an action label the button handles the tap; without one the whole header does.
  return render.wrapNode(context, node, content, tappable: actionLabel == null);
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
  final fit = sduiBoxFit(node.string('imageFit'));
  final aspect = node.number('imageAspectRatio');
  Widget? picture;
  if (imageUrl != null) {
    picture = render.part(
      context,
      node,
      'image',
      aspect != null
          ? AspectRatio(aspectRatio: aspect, child: sduiNetworkImage(imageUrl, fit: fit))
          : sduiNetworkImage(imageUrl, height: node.number('imageHeight') ?? 120, fit: fit),
    );
  }
  final body = render.part(
    context,
    node,
    'body',
    Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (title != null) render.partText(context, node, 'title', title, style: theme.textTheme.titleMedium),
          if (subtitle != null) render.partText(context, node, 'subtitle', subtitle, style: theme.textTheme.bodySmall),
          ...render.children(context, inside),
        ],
      ),
    ),
  );
  final pictureAtBottom = node.string('imagePosition') == 'bottom';
  return render.wrapNode(
    context,
    node,
    Card(
      clipBehavior: Clip.antiAlias,
      elevation: node.number('elevation'),
      shape: node.boolean('outlined') == true
          ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: theme.colorScheme.outlineVariant))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: pictureAtBottom ? [body, if (picture != null) picture] : [if (picture != null) picture, body],
      ),
    ),
  );
}

Widget _banner(BuildContext context, SduiNode node, SduiRender render) {
  final imageUrl = node.requireString('imageUrl');
  final title = node.string('title');
  final subtitle = node.string('subtitle');
  final ctaLabel = node.string('ctaLabel');
  final height = node.number('height') ?? 160;
  final place = sduiAlignment(node.string('contentAlignment'), Alignment.bottomLeft);
  const onImage = TextStyle(color: Colors.white, shadows: [Shadow(blurRadius: 4)]);
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
          if (title != null || subtitle != null || ctaLabel != null)
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Align(
                  alignment: place,
                  child: Column(
                    crossAxisAlignment: sduiCrossFor(place),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (title != null)
                        render.partText(context, node, 'title', title, style: onImage.copyWith(fontSize: 20, fontWeight: FontWeight.bold), textAlign: sduiTextAlignFor(place)),
                      if (subtitle != null) render.partText(context, node, 'subtitle', subtitle, style: onImage, textAlign: sduiTextAlignFor(place)),
                      if (ctaLabel != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
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

Widget _carousel(BuildContext context, SduiNode node, SduiRender render) {
  final items = node.list('items');
  if (items.isEmpty) throw SduiDataError(node, 'items');
  final tokens = context.sduiTokens;
  // Each card is a fraction of the screen wide, so the next one peeks in and invites a swipe.
  final cardWidth = MediaQuery.sizeOf(context).width * (node.number('viewportFraction') ?? 0.85);
  final cards = [for (final card in render.children(context, items)) render.part(context, node, 'item', card)];
  return render.wrapNode(
    context,
    node,
    _SduiCarousel(
      cardWidth: cardWidth,
      autoplay: node.boolean('autoplay') ?? false,
      cards: cards,
      height: node.number('height'),
      interval: Duration(milliseconds: ((node.number('autoplayInterval') ?? 4) * 1000).round()),
      animation: Duration(milliseconds: node.integer('animationDuration') ?? 400),
      showDots: node.boolean('showDots') ?? false,
      spacing: tokens.space(node.data['spacing']) ?? 0,
      enlargeCenter: node.boolean('enlargeCenter') ?? false,
      initialIndex: node.integer('initialIndex') ?? 0,
      loop: node.boolean('loop') ?? true,
    ),
  );
}

/// Scrolls sideways. With `autoplay` it moves to the next card every few seconds and (with `loop`) goes back
/// to the first card after the last. Touching or dragging it pauses the automatic movement for a while.
class _SduiCarousel extends StatefulWidget {
  const _SduiCarousel({
    required this.cardWidth,
    required this.autoplay,
    required this.cards,
    required this.height,
    required this.interval,
    required this.animation,
    required this.showDots,
    required this.spacing,
    required this.enlargeCenter,
    required this.initialIndex,
    required this.loop,
  });

  final double cardWidth;
  final bool autoplay;
  final List<Widget> cards;
  final double? height;
  final Duration interval;
  final Duration animation;
  final bool showDots;
  final double spacing;
  final bool enlargeCenter;
  final int initialIndex;
  final bool loop;

  @override
  State<_SduiCarousel> createState() => _SduiCarouselState();
}

class _SduiCarouselState extends State<_SduiCarousel> {
  late final ScrollController _controller;
  Timer? _timer;
  bool _pausedByTouch = false;
  int _page = 0;

  double get _step => widget.cardWidth + widget.spacing;

  @override
  void initState() {
    super.initState();
    final start = widget.initialIndex.clamp(0, widget.cards.length - 1);
    _page = start;
    _controller = ScrollController(initialScrollOffset: start * _step)..addListener(_onScroll);
    if (widget.autoplay && widget.cards.length > 1) {
      _timer = Timer.periodic(widget.interval, (_) => _next());
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    final page = (_controller.offset / _step).round().clamp(0, widget.cards.length - 1);
    if (page != _page) setState(() => _page = page);
  }

  void _next() {
    if (!mounted || !_controller.hasClients) return;
    if (_pausedByTouch) {
      // Skip this round, then start moving again.
      _pausedByTouch = false;
      return;
    }
    final position = _controller.position;
    final atEnd = position.pixels >= position.maxScrollExtent - 1;
    if (atEnd && !widget.loop) return;
    final target = atEnd ? 0.0 : (position.pixels + _step).clamp(0.0, position.maxScrollExtent);
    _controller.animateTo(target, duration: widget.animation, curve: Curves.easeInOut);
  }

  @override
  Widget build(BuildContext context) {
    final cards = [
      for (var index = 0; index < widget.cards.length; index++)
        Padding(
          padding: EdgeInsetsDirectional.only(end: index < widget.cards.length - 1 ? widget.spacing : 0),
          child: SizedBox(
            width: widget.cardWidth,
            // The card in the middle is a little bigger than the ones beside it.
            child: widget.enlargeCenter
                ? AnimatedScale(scale: index == _page ? 1 : 0.92, duration: const Duration(milliseconds: 200), child: widget.cards[index])
                : widget.cards[index],
          ),
        ),
    ];
    Widget row = Row(crossAxisAlignment: CrossAxisAlignment.start, children: cards);
    if (widget.height != null) row = SizedBox(height: widget.height, child: row);
    final scroller = Listener(
      onPointerDown: (_) => _pausedByTouch = true,
      child: SingleChildScrollView(controller: _controller, scrollDirection: Axis.horizontal, child: row),
    );
    if (!widget.showDots || widget.cards.length < 2) return scroller;
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        scroller,
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var index = 0; index < widget.cards.length; index++)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: index == _page ? scheme.primary : scheme.outlineVariant),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

Widget _list(BuildContext context, SduiNode node, SduiRender render) {
  final items = node.list('items');
  if (items.isEmpty) throw SduiDataError(node, 'items');
  final tokens = context.sduiTokens;
  final rows = [for (final row in render.children(context, items)) render.part(context, node, 'item', row)];
  final withDividers = node.boolean('dividers') ?? false;
  final gap = tokens.space(node.data['spacing']) ?? 0;
  final reverse = node.boolean('reverse') == true;
  final column = Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    verticalDirection: reverse ? VerticalDirection.up : VerticalDirection.down,
    children: [
      for (var index = 0; index < rows.length; index++) ...[
        if (index > 0 && withDividers)
          render.part(
            context,
            node,
            'divider',
            Divider(
              height: gap > 0 ? gap : null,
              indent: tokens.space(node.data['dividerIndent']),
              thickness: node.number('dividerThickness'),
            ),
          )
        else if (index > 0 && gap > 0)
          SizedBox(height: gap),
        rows[index],
      ],
    ],
  );
  final height = node.number('height');
  return render.wrapNode(context, node, height == null ? column : SizedBox(height: height, child: SingleChildScrollView(reverse: reverse, child: column)));
}

Widget _grid(BuildContext context, SduiNode node, SduiRender render) {
  final columns = node.integer('columns');
  if (columns == null || columns < 1) throw SduiDataError(node, 'columns');
  final items = node.list('items');
  if (items.isEmpty) throw SduiDataError(node, 'items');
  final tokens = context.sduiTokens;
  return render.wrapNode(
    context,
    node,
    SduiGridRows(
      columns: columns,
      rowGap: tokens.space(node.data['mainAxisSpacing']),
      columnGap: tokens.space(node.data['crossAxisSpacing']),
      aspectRatio: node.number('childAspectRatio'),
      children: [for (final cell in render.children(context, items)) render.part(context, node, 'item', cell)],
    ),
  );
}

class _TabData {
  const _TabData(this.label, this.widgets, this.icon);

  final String label;
  final List<dynamic> widgets;
  final String? icon;
}

Widget _tabs(BuildContext context, SduiNode node, SduiRender render) {
  final tabs = <_TabData>[];
  for (final raw in node.list('tabs')) {
    if (raw is Map && raw['label'] is String && raw['widgets'] is List) {
      tabs.add(_TabData(raw['label'] as String, raw['widgets'] as List, raw['icon'] is String ? raw['icon'] as String : null));
    }
  }
  if (tabs.isEmpty) throw SduiDataError(node, 'tabs');
  return render.wrapNode(context, node, _SduiTabs(tabs: tabs, render: render, node: node));
}

class _SduiTabs extends StatefulWidget {
  const _SduiTabs({required this.tabs, required this.render, required this.node});

  final List<_TabData> tabs;
  final SduiRender render;
  final SduiNode node;

  @override
  State<_SduiTabs> createState() => _SduiTabsState();
}

class _SduiTabsState extends State<_SduiTabs> {
  late int _selected = (widget.node.integer('initialIndex') ?? 0).clamp(0, widget.tabs.length - 1);

  // The row of tab buttons, as chips (the default), an underlined row, or one joined segmented button.
  Widget _bar(BuildContext context, int selected) {
    final tabs = widget.tabs;
    final variant = widget.node.string('variant') ?? 'chips';
    final alignment = widget.node.string('tabAlignment') ?? 'start';
    final scheme = Theme.of(context).colorScheme;
    final main = switch (alignment) {
      'center' => MainAxisAlignment.center,
      'end' => MainAxisAlignment.end,
      _ => MainAxisAlignment.start,
    };
    final stretch = alignment == 'stretch';
    Widget label(int index) => widget.render.partText(context, widget.node, 'tab', tabs[index].label);
    Widget? icon(int index) => tabs[index].icon == null ? null : Icon(sduiIcon(tabs[index].icon), size: 18);

    if (variant == 'segmented') {
      final bar = SegmentedButton<int>(
        showSelectedIcon: false,
        segments: [
          for (var index = 0; index < tabs.length; index++) ButtonSegment<int>(value: index, label: label(index), icon: icon(index)),
        ],
        selected: {selected},
        onSelectionChanged: (value) => setState(() => _selected = value.first),
      );
      return Align(
        alignment: alignment == 'center' ? Alignment.center : (alignment == 'end' ? Alignment.centerRight : Alignment.centerLeft),
        child: stretch ? SizedBox(width: double.infinity, child: bar) : bar,
      );
    }

    final Widget bar;
    if (variant == 'underline') {
      Widget tab(int index) => InkWell(
            onTap: () => setState(() => _selected = index),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(width: 2, color: index == selected ? scheme.primary : Colors.transparent)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [if (icon(index) != null) ...[icon(index)!, const SizedBox(width: 6)], label(index)],
              ),
            ),
          );
      bar = DecoratedBox(
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: scheme.outlineVariant))),
        child: Row(
          mainAxisAlignment: main,
          children: [for (var index = 0; index < tabs.length; index++) stretch ? Expanded(child: tab(index)) : tab(index)],
        ),
      );
    } else {
      Widget chip(int index) => ChoiceChip(
            label: label(index),
            avatar: icon(index),
            selected: index == selected,
            onSelected: (_) => setState(() => _selected = index),
          );
      bar = stretch
          ? Row(children: [for (var index = 0; index < tabs.length; index++) Expanded(child: Padding(padding: const EdgeInsets.only(right: 8), child: chip(index)))])
          : Wrap(spacing: 8, alignment: sduiWrapAlignment(alignment), children: [for (var index = 0; index < tabs.length; index++) chip(index)]);
    }
    return widget.node.boolean('scrollable') == true ? SingleChildScrollView(scrollDirection: Axis.horizontal, child: bar) : bar;
  }

  @override
  Widget build(BuildContext context) {
    final tabs = widget.tabs;
    final selected = _selected < tabs.length ? _selected : 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _bar(context, selected),
        widget.render.part(
          context,
          widget.node,
          'content',
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: widget.render.children(context, tabs[selected].widgets)),
        ),
      ],
    );
  }
}

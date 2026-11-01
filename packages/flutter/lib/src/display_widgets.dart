import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'icons.dart';
import 'images.dart';
import 'model.dart';
import 'options.dart';
import 'registry.dart';
import 'render.dart';
import 'theme.dart';

/// Adds the widgets that show information (no tapping needed): rich_text, quote, icon, avatar,
/// badge, alert, progress, stat, key_value, list_item, empty_state, rating, table, steps.
void registerDisplayWidgets(SduiWidgetRegistry registry) {
  registry
    ..register('rich_text', 1, _richText)
    ..register('quote', 1, _quote)
    ..register('icon', 1, _icon)
    ..register('avatar', 1, _avatar)
    ..register('badge', 1, _badge)
    ..register('alert', 1, _alert)
    ..register('progress', 1, _progress)
    ..register('stat', 1, _stat)
    ..register('key_value', 1, _keyValue)
    ..register('list_item', 1, _listItem)
    ..register('empty_state', 1, _emptyState)
    ..register('rating', 1, _rating)
    ..register('table', 1, _table)
    ..register('steps', 1, _steps);
}

/// The colour that goes with a tone, for the badge and alert backgrounds and text.
Color toneColor(BuildContext context, Object? tone) {
  final scheme = Theme.of(context).colorScheme;
  final tokens = context.sduiTokens;
  return switch (tone) {
    'info' => tokens.color('secondary') ?? scheme.secondary,
    'success' => tokens.color('success') ?? Colors.green,
    'warning' => tokens.color('warning') ?? Colors.orange,
    'error' => tokens.color('error') ?? scheme.error,
    _ => scheme.onSurfaceVariant,
  };
}

IconData _toneIcon(Object? tone) => switch (tone) {
      'success' => Icons.check_circle_outline,
      'warning' => Icons.warning_amber_outlined,
      'error' => Icons.error_outline,
      _ => Icons.info_outline,
    };

Widget _richText(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  final spans = <InlineSpan>[];
  for (final raw in node.list('spans')) {
    if (raw is Map && raw['text'] is String && (raw['text'] as String).isNotEmpty) {
      final hasAction = raw['action'] is Map;
      final decorations = [
        if (raw['underline'] == true || hasAction) TextDecoration.underline,
        if (raw['strikethrough'] == true) TextDecoration.lineThrough,
      ];
      final style = TextStyle(
        fontWeight: switch (raw['weight']) {
          'bold' => FontWeight.w700,
          'medium' => FontWeight.w500,
          'normal' => FontWeight.w400,
          _ => raw['bold'] == true ? FontWeight.bold : null,
        },
        fontStyle: raw['italic'] == true ? FontStyle.italic : null,
        decoration: decorations.isEmpty ? null : TextDecoration.combine(decorations),
        color: tokens.color(raw['color']) ?? (hasAction ? Theme.of(context).colorScheme.primary : null),
        backgroundColor: tokens.color(raw['background']),
        letterSpacing: raw['letterSpacing'] is num ? (raw['letterSpacing'] as num).toDouble() : null,
        fontSize: tokens.textSize(raw['size']),
      );
      if (hasAction) {
        // A piece of text that does something when tapped.
        spans.add(WidgetSpan(
          alignment: PlaceholderAlignment.baseline,
          baseline: TextBaseline.alphabetic,
          child: GestureDetector(
            onTap: () => render.tap(context, action: Map<String, dynamic>.from(raw['action'] as Map)),
            child: Text(raw['text'] as String, style: DefaultTextStyle.of(context).style.merge(style)),
          ),
        ));
      } else {
        spans.add(TextSpan(text: raw['text'] as String, style: style));
      }
    }
  }
  if (spans.isEmpty) throw SduiDataError(node, 'spans');
  final whole = TextSpan(style: DefaultTextStyle.of(context).style, children: spans);
  return render.wrapNode(
    context,
    node,
    node.boolean('selectable') == true ? SelectableText.rich(whole) : Text.rich(whole),
  );
}

Widget _quote(BuildContext context, SduiNode node, SduiRender render) {
  final text = node.requireString('text');
  final who = [node.string('author'), node.string('role')].whereType<String>().where((part) => part.isNotEmpty).join(', ');
  final avatarUrl = node.string('avatarUrl');
  final theme = Theme.of(context);
  final tokens = context.sduiTokens;
  final showBar = node.boolean('showBar') != false;
  final barColor = tokens.color(node.string('barColor')) ?? theme.colorScheme.primary;
  final avatarSize = node.number('avatarSize') ?? 28;
  final italic = node.boolean('italic') != false;
  return render.wrapNode(
    context,
    node,
    Container(
      padding: EdgeInsetsDirectional.only(start: showBar ? 12 : 0, top: 4, bottom: 4),
      // BorderDirectional puts the bar on the right in right-to-left languages.
      decoration: showBar ? BoxDecoration(border: BorderDirectional(start: BorderSide(width: node.number('barWidth') ?? 4, color: barColor))) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          render.partText(
            context,
            node,
            'text',
            node.boolean('showQuoteMark') == true ? '“$text' : text,
            style: theme.textTheme.bodyLarge?.copyWith(fontStyle: italic ? FontStyle.italic : FontStyle.normal),
          ),
          if (who.isNotEmpty || avatarUrl != null) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (avatarUrl != null) ...[
                  render.part(context, node, 'avatar', CircleAvatar(radius: avatarSize / 2, backgroundImage: NetworkImage(avatarUrl), onBackgroundImageError: (_, __) {})),
                  const SizedBox(width: 8),
                ],
                if (who.isNotEmpty) render.partText(context, node, 'author', who, style: theme.textTheme.bodySmall),
              ],
            ),
          ],
        ],
      ),
    ),
  );
}

Widget _icon(BuildContext context, SduiNode node, SduiRender render) {
  final tokens = context.sduiTokens;
  Widget icon = Icon(
    sduiIcon(node.requireString('name')),
    size: sduiSized(node.data['size'], small: 16, medium: 24, large: 40),
    color: tokens.color(node.string('color')) ?? tokens.color(node.style['textColor']),
  );
  final turns = node.number('rotation');
  if (turns != null || node.boolean('flipX') == true) {
    icon = Transform(
      alignment: Alignment.center,
      transform: Matrix4.rotationZ((turns ?? 0) * math.pi / 180) * Matrix4.diagonal3Values(node.boolean('flipX') == true ? -1.0 : 1.0, 1.0, 1.0),
      child: icon,
    );
  }
  // A coloured disc or square behind the icon.
  final shape = node.string('shape');
  final background = tokens.color(node.string('background'));
  if ((shape != null && shape != 'none') || background != null) {
    icon = Container(
      padding: EdgeInsets.all(tokens.space(node.data['padding']) ?? 8),
      decoration: BoxDecoration(
        color: background,
        shape: shape == 'circle' ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: shape == 'rounded' ? BorderRadius.circular(12) : null,
      ),
      child: icon,
    );
  }
  final tip = node.string('tooltip');
  if (tip != null) icon = Tooltip(message: tip, child: icon);
  return render.wrapNode(context, node, icon);
}

Widget _avatar(BuildContext context, SduiNode node, SduiRender render) {
  final imageUrl = node.string('imageUrl');
  final initials = node.string('initials');
  if (imageUrl == null && initials == null) throw SduiDataError(node, 'imageUrl');
  final tokens = context.sduiTokens;
  final scheme = Theme.of(context).colorScheme;
  final size = sduiSized(node.data['size'], small: 32, medium: 48, large: 80);
  final radius = switch (node.string('shape')) {
    'square' => 0.0,
    'rounded' => size / 5,
    _ => size / 2,
  };
  final borderWidth = node.number('borderWidth');
  final borderColor = tokens.color(node.string('borderColor'));
  final hasBorder = (borderWidth != null && borderWidth > 0) || borderColor != null;
  final foreground = tokens.color(node.string('foregroundColor')) ?? scheme.onPrimaryContainer;
  final avatar = ClipRRect(
    borderRadius: BorderRadius.circular(radius),
    child: SizedBox(
      width: size,
      height: size,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: tokens.color(node.string('backgroundColor')) ?? scheme.primaryContainer),
          if (initials != null)
            Center(
              child: DefaultTextStyle.merge(
                style: TextStyle(color: foreground, fontWeight: FontWeight.bold, fontSize: size / 2.6),
                child: render.partText(context, node, 'initials', initials),
              ),
            ),
          // If the picture fails, the initials underneath are what the person sees.
          if (imageUrl != null) Image.network(imageUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
          if (hasBorder)
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(radius),
                border: Border.all(width: borderWidth ?? 2, color: borderColor ?? scheme.outlineVariant),
              ),
            ),
        ],
      ),
    ),
  );
  // A small dot in the corner says if the person is online, away, busy or offline.
  final dot = switch (node.string('status')) {
    'online' => const Color(0xFF22C55E),
    'offline' => const Color(0xFF9CA3AF),
    'busy' => const Color(0xFFEF4444),
    'away' => const Color(0xFFF59E0B),
    _ => null,
  };
  return render.wrapNode(
    context,
    node,
    dot == null
        ? avatar
        : Stack(
            clipBehavior: Clip.none,
            children: [
              avatar,
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: math.max(8, size / 4),
                  height: math.max(8, size / 4),
                  decoration: BoxDecoration(color: dot, shape: BoxShape.circle, border: Border.all(color: scheme.surface, width: 2)),
                ),
              ),
            ],
          ),
  );
}

Widget _badge(BuildContext context, SduiNode node, SduiRender render) {
  final color = toneColor(context, node.string('tone'));
  // Just a dot, with no text.
  if (node.boolean('dot') == true) {
    return render.wrapNode(context, node, Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)));
  }
  final variant = node.string('variant');
  final solid = variant == 'solid';
  final padding = switch (node.string('size')) {
    'small' => const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
    'large' => const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
    _ => const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
  };
  final fontSize = switch (node.string('size')) {
    'small' => 9.0,
    'large' => 13.0,
    _ => null,
  };
  final radius = switch (node.string('shape')) {
    'square' => 0.0,
    'rounded' => 6.0,
    _ => 12.0,
  };
  final textColor = solid ? Colors.white : color;
  final iconName = node.string('icon');
  final label = Text(
    node.requireString('label'),
    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: textColor, fontWeight: FontWeight.bold, fontSize: fontSize),
  );
  return render.wrapNode(
    context,
    node,
    Container(
      padding: padding,
      decoration: BoxDecoration(
        color: solid ? color : (variant == 'outline' ? Colors.transparent : color.withValues(alpha: 0.15)),
        borderRadius: BorderRadius.circular(radius),
        border: variant == 'outline' ? Border.all(color: color) : null,
      ),
      child: iconName == null
          ? label
          : Row(mainAxisSize: MainAxisSize.min, children: [Icon(sduiIcon(iconName), size: 12, color: textColor), const SizedBox(width: 4), label]),
    ),
  );
}

Widget _alert(BuildContext context, SduiNode node, SduiRender render) {
  final message = node.requireString('message');
  final title = node.string('title');
  final tone = node.string('tone');
  final color = toneColor(context, tone);
  final theme = Theme.of(context);
  final variant = node.string('variant');
  final solid = variant == 'solid';
  final iconColor = solid ? Colors.white : color;
  final actionLabel = node.string('actionLabel');
  final iconName = node.string('icon');
  var closed = false;
  return render.wrapNode(
    context,
    node,
    StatefulBuilder(
      builder: (context, setState) {
        if (closed) return const SizedBox.shrink();
        final box = Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: solid ? color : (variant == 'outline' ? Colors.transparent : color.withValues(alpha: 0.12)),
            borderRadius: BorderRadius.circular(variant == 'accent' ? 4 : 8),
            border: variant == 'outline'
                ? Border.all(color: color)
                : (variant == 'accent' ? BorderDirectional(start: BorderSide(color: color, width: 4)) : null),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (node.boolean('showIcon') != false) ...[
                render.partIcon(context, node, 'icon', iconName == null ? _toneIcon(tone) : sduiIcon(iconName), color: iconColor),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: DefaultTextStyle.merge(
                  style: TextStyle(color: solid ? Colors.white : null),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title != null) render.partText(context, node, 'title', title, style: theme.textTheme.titleSmall?.copyWith(color: solid ? Colors.white : null)),
                      render.partText(context, node, 'message', message, style: theme.textTheme.bodyMedium?.copyWith(color: solid ? Colors.white : null)),
                      if (actionLabel != null)
                        TextButton(
                          onPressed: () => render.tap(context, action: node.action, event: node.analyticsEvent, params: node.analyticsParams),
                          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 28), foregroundColor: iconColor),
                          child: Text(actionLabel),
                        ),
                    ],
                  ),
                ),
              ),
              if (node.boolean('dismissible') == true)
                InkWell(onTap: () => setState(() => closed = true), child: Icon(Icons.close, size: 18, color: iconColor)),
            ],
          ),
        );
        return box;
      },
    ),
    // With an action button the button handles the tap; without one the whole alert does.
    tappable: actionLabel == null,
  );
}

Widget _progress(BuildContext context, SduiNode node, SduiRender render) {
  final indeterminate = node.boolean('indeterminate') == true;
  final value = node.number('value');
  if (!indeterminate && (value == null || value < 0 || value > 1)) throw SduiDataError(node, 'value');
  final label = node.string('label');
  final tokens = context.sduiTokens;
  final fill = tokens.color(render.partLook(node, 'fill')['color']);
  final track = tokens.color(render.partLook(node, 'track')['color']);
  final stroke = node.number('strokeWidth') ?? 4;
  final rounded = node.boolean('rounded') != false;
  final shown = indeterminate ? null : value;
  if (node.string('shape') == 'circular') {
    final diameter = node.number('size') ?? 56;
    return render.wrapNode(
      context,
      node,
      SizedBox(
        width: diameter,
        height: diameter,
        child: Stack(
          fit: StackFit.expand,
          alignment: Alignment.center,
          children: [
            CircularProgressIndicator(
              value: shown,
              semanticsLabel: label,
              strokeWidth: stroke,
              strokeCap: rounded ? StrokeCap.round : StrokeCap.butt,
              color: fill,
              backgroundColor: track,
            ),
            if (shown != null) Center(child: render.partText(context, node, 'label', '${(shown * 100).round()}%')),
          ],
        ),
      ),
    );
  }
  final trackHeight = render.partLook(node, 'track')['height'] is num ? (render.partLook(node, 'track')['height'] as num).toDouble() : stroke;
  final trackRadius = tokens.radius(render.partLook(node, 'track')['radius']);
  return render.wrapNode(
    context,
    node,
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null || (node.boolean('showPercent') == true && shown != null))
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (label != null) render.partText(context, node, 'label', label) else const SizedBox.shrink(),
                if (node.boolean('showPercent') == true && shown != null) Text('${(shown * 100).round()}%', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        LinearProgressIndicator(
          value: shown,
          semanticsLabel: label,
          color: fill,
          backgroundColor: track,
          minHeight: trackHeight,
          borderRadius: BorderRadius.circular(trackRadius ?? (rounded ? trackHeight / 2 : 0)),
        ),
      ],
    ),
  );
}

Widget _stat(BuildContext context, SduiNode node, SduiRender render) {
  final label = node.requireString('label');
  final value = node.requireString('value');
  final delta = node.string('delta');
  final trend = node.string('trend');
  final iconName = node.string('icon');
  final trendColor = switch (trend) {
    'up' => toneColor(context, 'success'),
    'down' => toneColor(context, 'error'),
    _ => toneColor(context, 'neutral'),
  };
  final theme = Theme.of(context);
  return render.wrapNode(
    context,
    node,
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (iconName != null) ...[Icon(sduiIcon(iconName), size: 16), const SizedBox(width: 4)],
            render.partText(context, node, 'label', label, style: theme.textTheme.bodySmall),
          ],
        ),
        render.partText(context, node, 'value', '${node.string('prefix') ?? ''}$value${node.string('suffix') ?? ''}', style: theme.textTheme.headlineSmall),
        if (delta != null)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (trend != null)
                Icon(
                  switch (trend) {
                    'up' => Icons.arrow_upward,
                    'down' => Icons.arrow_downward,
                    _ => Icons.remove,
                  },
                  size: 14,
                  color: trendColor,
                ),
              render.partText(context, node, 'delta', delta, style: theme.textTheme.bodySmall?.copyWith(color: trendColor)),
            ],
          ),
      ],
    ),
  );
}

Widget _keyValue(BuildContext context, SduiNode node, SduiRender render) {
  final rows = <Widget>[];
  final stacked = node.string('layout') == 'stacked';
  final valueAtStart = node.string('valueAlign') == 'start';
  final labelFraction = node.number('labelFraction');
  final muted = TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant);
  for (final raw in node.list('rows')) {
    if (raw is Map && raw['label'] is String && raw['value'] != null) {
      final iconName = raw['icon'] is String ? raw['icon'] as String : null;
      final label = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (iconName != null) ...[Icon(sduiIcon(iconName), size: 16), const SizedBox(width: 6)],
          Flexible(child: render.partText(context, node, 'label', raw['label'] as String, style: muted)),
        ],
      );
      final value = render.partText(
        context,
        node,
        'value',
        '${raw['value']}',
        style: const TextStyle(fontWeight: FontWeight.bold),
        textAlign: (valueAtStart || stacked) ? TextAlign.start : TextAlign.end,
      );
      final Widget line = stacked
          ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [label, value])
          : Row(
              children: [
                if (labelFraction != null)
                  Flexible(flex: (labelFraction * 100).round(), child: label)
                else
                  Expanded(child: label),
                const SizedBox(width: 12),
                if (labelFraction != null) Flexible(flex: ((1 - labelFraction) * 100).round(), child: value) else value,
              ],
            );
      rows.add(render.part(
        context,
        node,
        'row',
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: node.boolean('dividers') == true && rows.isNotEmpty ? Column(children: [const Divider(height: 12), line]) : line,
        ),
      ));
    }
  }
  if (rows.isEmpty) throw SduiDataError(node, 'rows');
  return render.wrapNode(context, node, Column(children: rows));
}

Widget _listItem(BuildContext context, SduiNode node, SduiRender render) {
  final title = node.requireString('title');
  final subtitle = node.string('subtitle');
  final icon = node.string('icon');
  final imageUrl = node.string('imageUrl');
  final trailingText = node.string('trailingText');
  final trailingIcon = node.string('trailingIcon');
  final badge = node.string('badge');
  final chevron = node.boolean('chevron') ?? false;
  final imageSize = node.number('imageSize') ?? 40;
  final imageRadius = switch (node.string('imageShape')) {
    'circle' => imageSize / 2,
    'square' => 0.0,
    _ => 8.0,
  };
  Widget? leading;
  if (imageUrl != null) {
    leading = render.part(
      context,
      node,
      'image',
      ClipRRect(
        borderRadius: BorderRadius.circular(imageRadius),
        child: SizedBox(width: imageSize, height: imageSize, child: sduiNetworkImage(imageUrl, height: imageSize)),
      ),
    );
  } else if (icon != null) {
    leading = render.partIcon(context, node, 'icon', sduiIcon(icon));
  }
  final scheme = Theme.of(context).colorScheme;
  return render.wrapNode(
    context,
    node,
    ListTile(
      contentPadding: EdgeInsets.zero,
      dense: node.boolean('dense') == true,
      selected: node.boolean('selected') == true,
      selectedTileColor: scheme.primary.withValues(alpha: 0.1),
      leading: leading,
      title: render.partText(
        context,
        node,
        'title',
        title,
        maxLines: node.integer('titleMaxLines'),
        overflow: node.integer('titleMaxLines') == null ? null : TextOverflow.ellipsis,
      ),
      subtitle: subtitle == null
          ? null
          : render.partText(
              context,
              node,
              'subtitle',
              subtitle,
              maxLines: node.integer('subtitleMaxLines'),
              overflow: node.integer('subtitleMaxLines') == null ? null : TextOverflow.ellipsis,
            ),
      trailing: (trailingText == null && trailingIcon == null && badge == null && !chevron)
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (badge != null)
                  Container(
                    margin: const EdgeInsetsDirectional.only(end: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: scheme.primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                    child: Text(badge, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: scheme.primary, fontWeight: FontWeight.bold)),
                  ),
                if (trailingText != null) render.partText(context, node, 'trailing', trailingText),
                if (trailingIcon != null) Icon(sduiIcon(trailingIcon)),
                // Directional arrow: points the way "forward" is in the current language.
                if (chevron) Icon(Directionality.of(context) == TextDirection.rtl ? Icons.chevron_left : Icons.chevron_right),
              ],
            ),
    ),
  );
}

Widget _emptyState(BuildContext context, SduiNode node, SduiRender render) {
  final title = node.requireString('title');
  final message = node.string('message');
  final icon = node.string('icon');
  final imageUrl = node.string('imageUrl');
  final actionLabel = node.string('actionLabel');
  final theme = Theme.of(context);
  return render.wrapNode(
    context,
    node,
    Padding(
      padding: EdgeInsets.all(node.boolean('compact') == true ? 8 : 24),
      child: Column(
        children: [
          if (imageUrl != null)
            Padding(padding: const EdgeInsets.only(bottom: 12), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 200), child: sduiNetworkImage(imageUrl, fit: BoxFit.contain))),
          if (icon != null) render.partIcon(context, node, 'icon', sduiIcon(icon), size: node.number('iconSize') ?? 48, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          render.partText(context, node, 'title', title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
          if (message != null) Padding(padding: const EdgeInsets.only(top: 4), child: render.partText(context, node, 'message', message, textAlign: TextAlign.center)),
          if (actionLabel != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: render.partButton(
                context,
                node,
                'button',
                (style) => FilledButton(
                  style: style,
                  onPressed: () => render.tap(context, action: node.action, event: node.analyticsEvent, params: node.analyticsParams),
                  child: Text(actionLabel),
                ),
              ),
            ),
        ],
      ),
    ),
    // With a button, the button handles the tap; without one, the whole block does.
    tappable: actionLabel == null,
  );
}

Widget _rating(BuildContext context, SduiNode node, SduiRender render) {
  final value = node.number('value');
  final marks = node.integer('max') ?? 5;
  if (value == null || value < 0 || value > marks) throw SduiDataError(node, 'value');
  final count = node.integer('count');
  final label = node.string('label');
  final tokens = context.sduiTokens;
  final summary = [
    if (node.boolean('showValue') != false) value.toStringAsFixed(1),
    if (count != null && node.boolean('showCount') != false) '($count)',
    if (label != null) label,
  ].join(' ');
  final (full, half, empty) = switch (node.string('icon')) {
    'heart' => (Icons.favorite, Icons.favorite, Icons.favorite_border),
    'thumb' => (Icons.thumb_up, Icons.thumb_up, Icons.thumb_up_off_alt),
    'circle' => (Icons.circle, Icons.contrast, Icons.circle_outlined),
    _ => (Icons.star, Icons.star_half, Icons.star_border),
  };
  final filledColor = tokens.color(node.string('color')) ?? Colors.amber;
  final emptyColor = tokens.color(node.string('emptyColor')) ?? filledColor;
  final size = node.number('size') ?? 18;
  return render.wrapNode(
    context,
    node,
    Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var mark = 1; mark <= marks; mark++)
          render.partIcon(
            context,
            node,
            'stars',
            value >= mark ? full : (value >= mark - 0.5 ? half : empty),
            size: size,
            color: value >= mark - 0.5 ? filledColor : emptyColor,
          ),
        if (summary.isNotEmpty) ...[const SizedBox(width: 8), render.partText(context, node, 'text', summary)],
      ],
    ),
  );
}

Widget _table(BuildContext context, SduiNode node, SduiRender render) {
  final columns = [for (final column in node.list('columns')) if (column is String) column];
  if (columns.isEmpty) throw SduiDataError(node, 'columns');
  final alignments = node.list('columnAlign');
  final weights = node.list('columnWidths');
  final dense = node.boolean('dense') == true;
  final scheme = Theme.of(context).colorScheme;
  Alignment alignmentOf(int index) => switch (index < alignments.length ? alignments[index] : null) {
        'center' => Alignment.center,
        'end' => Alignment.centerRight,
        _ => Alignment.centerLeft,
      };
  TableRow rowOf(List<String> cells, {bool header = false, bool shaded = false}) {
    return TableRow(
      decoration: shaded ? BoxDecoration(color: scheme.onSurface.withValues(alpha: 0.05)) : null,
      children: [
        for (var index = 0; index < columns.length; index++)
          Padding(
            padding: EdgeInsets.all(dense ? 4 : 8),
            child: Align(
              alignment: alignmentOf(index),
              // A row with too few cells gets empty ones; extra cells are ignored.
              child: render.partText(
                context,
                node,
                header ? 'header' : 'cell',
                index < cells.length ? cells[index] : '',
                style: header || (index == 0 && node.boolean('firstColumnBold') == true) ? const TextStyle(fontWeight: FontWeight.bold) : null,
              ),
            ),
          ),
      ],
    );
  }

  final rows = <TableRow>[rowOf(columns, header: true)];
  var position = 0;
  for (final raw in node.list('rows')) {
    if (raw is List) {
      rows.add(rowOf([for (final cell in raw) '$cell'], shaded: node.boolean('striped') == true && position.isOdd));
      position++;
    }
  }
  final line = BorderSide(color: scheme.outlineVariant);
  final border = switch (node.string('border')) {
    'none' => null,
    'horizontal' => TableBorder(horizontalInside: line, top: line, bottom: line),
    _ => TableBorder.all(color: scheme.outlineVariant),
  };
  return render.wrapNode(
    context,
    node,
    Table(
      border: border,
      columnWidths: {
        for (var index = 0; index < weights.length; index++)
          if (weights[index] is num) index: FlexColumnWidth((weights[index] as num).toDouble()),
      },
      children: rows,
    ),
  );
}

Widget _steps(BuildContext context, SduiNode node, SduiRender render) {
  final items = <Widget>[];
  final theme = Theme.of(context);
  final horizontal = node.string('direction') == 'horizontal';
  final numbered = node.boolean('numbered') == true;
  final connector = node.boolean('showConnector') == true;
  final all = [for (final raw in node.list('steps')) if (raw is Map && raw['title'] is String) raw];
  for (var index = 0; index < all.length; index++) {
    final raw = all[index];
    final state = raw['state'];
    final description = raw['description'];
    final color = state == 'todo' || state == null ? theme.colorScheme.outline : theme.colorScheme.primary;
    final custom = raw['icon'] is String ? sduiIcon(raw['icon']) : null;
    final Widget dot = (numbered && custom == null && state != 'done')
        ? render.part(
            context,
            node,
            'dot',
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: color, width: 2)),
              child: Text('${index + 1}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
            ),
          )
        : render.partIcon(
            context,
            node,
            'dot',
            custom ??
                switch (state) {
                  'done' => Icons.check_circle,
                  'current' => Icons.radio_button_checked,
                  _ => Icons.radio_button_unchecked,
                },
            color: color,
          );
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        render.partText(context, node, 'title', raw['title'] as String, style: theme.textTheme.titleSmall),
        if (description is String) render.partText(context, node, 'description', description, style: theme.textTheme.bodySmall),
      ],
    );
    if (horizontal) {
      items.add(Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [dot, const SizedBox(height: 6), text]))));
    } else {
      items.add(IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                dot,
                // The line down to the next step.
                if (connector && index < all.length - 1) Expanded(child: Container(width: 2, color: theme.colorScheme.outlineVariant)),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(child: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: text)),
          ],
        ),
      ));
    }
  }
  if (items.isEmpty) throw SduiDataError(node, 'steps');
  return render.wrapNode(context, node, horizontal ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: items) : Column(children: items));
}

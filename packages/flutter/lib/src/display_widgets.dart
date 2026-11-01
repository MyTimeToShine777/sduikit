import 'package:flutter/material.dart';

import 'icons.dart';
import 'images.dart';
import 'model.dart';
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

double _sizeFor(Object? name, {required double small, required double medium, required double large}) =>
    switch (name) { 'small' => small, 'large' => large, _ => medium };

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
      spans.add(TextSpan(
        text: raw['text'] as String,
        style: TextStyle(
          fontWeight: raw['bold'] == true ? FontWeight.bold : null,
          fontStyle: raw['italic'] == true ? FontStyle.italic : null,
          decoration: raw['underline'] == true ? TextDecoration.underline : null,
          color: tokens.color(raw['color']),
          fontSize: tokens.textSize(raw['size']),
        ),
      ));
    }
  }
  if (spans.isEmpty) throw SduiDataError(node, 'spans');
  return render.wrapNode(
    context,
    node,
    Text.rich(TextSpan(style: DefaultTextStyle.of(context).style, children: spans)),
  );
}

Widget _quote(BuildContext context, SduiNode node, SduiRender render) {
  final text = node.requireString('text');
  final who = [node.string('author'), node.string('role')].whereType<String>().where((part) => part.isNotEmpty).join(', ');
  final avatarUrl = node.string('avatarUrl');
  final theme = Theme.of(context);
  return render.wrapNode(
    context,
    node,
    Container(
      padding: const EdgeInsetsDirectional.only(start: 12, top: 4, bottom: 4),
      // BorderDirectional puts the bar on the right in right-to-left languages.
      decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(width: 4, color: theme.colorScheme.primary))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(text, style: theme.textTheme.bodyLarge?.copyWith(fontStyle: FontStyle.italic)),
          if (who.isNotEmpty || avatarUrl != null) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (avatarUrl != null) ...[
                  CircleAvatar(radius: 14, backgroundImage: NetworkImage(avatarUrl), onBackgroundImageError: (_, __) {}),
                  const SizedBox(width: 8),
                ],
                if (who.isNotEmpty) Text(who, style: theme.textTheme.bodySmall),
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
  return render.wrapNode(
    context,
    node,
    Icon(
      sduiIcon(node.requireString('name')),
      size: _sizeFor(node.string('size'), small: 16, medium: 24, large: 40),
      color: tokens.color(node.style['textColor']),
    ),
  );
}

Widget _avatar(BuildContext context, SduiNode node, SduiRender render) {
  final imageUrl = node.string('imageUrl');
  final initials = node.string('initials');
  if (imageUrl == null && initials == null) throw SduiDataError(node, 'imageUrl');
  final radius = _sizeFor(node.string('size'), small: 16, medium: 24, large: 40);
  return render.wrapNode(
    context,
    node,
    CircleAvatar(
      radius: radius,
      backgroundImage: imageUrl == null ? null : NetworkImage(imageUrl),
      // If the picture fails, the initials underneath are what the person sees.
      onBackgroundImageError: imageUrl == null ? null : (_, __) {},
      child: initials == null ? null : Text(initials),
    ),
  );
}

Widget _badge(BuildContext context, SduiNode node, SduiRender render) {
  final color = toneColor(context, node.string('tone'));
  return render.wrapNode(
    context,
    node,
    Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
      child: Text(
        node.requireString('label'),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.bold),
      ),
    ),
  );
}

Widget _alert(BuildContext context, SduiNode node, SduiRender render) {
  final message = node.requireString('message');
  final title = node.string('title');
  final tone = node.string('tone');
  final color = toneColor(context, tone);
  final theme = Theme.of(context);
  return render.wrapNode(
    context,
    node,
    Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_toneIcon(tone), color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) Text(title, style: theme.textTheme.titleSmall),
                Text(message, style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _progress(BuildContext context, SduiNode node, SduiRender render) {
  final value = node.number('value');
  if (value == null || value < 0 || value > 1) throw SduiDataError(node, 'value');
  final label = node.string('label');
  if (node.string('shape') == 'circular') {
    return render.wrapNode(
      context,
      node,
      SizedBox(
        width: 56,
        height: 56,
        child: Stack(
          fit: StackFit.expand,
          alignment: Alignment.center,
          children: [
            CircularProgressIndicator(value: value, semanticsLabel: label),
            Center(child: Text('${(value * 100).round()}%')),
          ],
        ),
      ),
    );
  }
  return render.wrapNode(
    context,
    node,
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(label)),
        LinearProgressIndicator(value: value, semanticsLabel: label),
      ],
    ),
  );
}

Widget _stat(BuildContext context, SduiNode node, SduiRender render) {
  final label = node.requireString('label');
  final value = node.requireString('value');
  final delta = node.string('delta');
  final trend = node.string('trend');
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
        Text(label, style: theme.textTheme.bodySmall),
        Text(value, style: theme.textTheme.headlineSmall),
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
              Text(delta, style: theme.textTheme.bodySmall?.copyWith(color: trendColor)),
            ],
          ),
      ],
    ),
  );
}

Widget _keyValue(BuildContext context, SduiNode node, SduiRender render) {
  final rows = <Widget>[];
  for (final raw in node.list('rows')) {
    if (raw is Map && raw['label'] is String && raw['value'] != null) {
      rows.add(Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(child: Text(raw['label'] as String, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant))),
            Text('${raw['value']}', style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
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
  final chevron = node.boolean('chevron') ?? false;
  Widget? leading;
  if (imageUrl != null) {
    leading = ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(width: 40, height: 40, child: sduiNetworkImage(imageUrl, height: 40)),
    );
  } else if (icon != null) {
    leading = Icon(sduiIcon(icon));
  }
  return render.wrapNode(
    context,
    node,
    ListTile(
      contentPadding: EdgeInsets.zero,
      leading: leading,
      title: Text(title),
      subtitle: subtitle == null ? null : Text(subtitle),
      trailing: (trailingText == null && !chevron)
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (trailingText != null) Text(trailingText),
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
  final actionLabel = node.string('actionLabel');
  final theme = Theme.of(context);
  return render.wrapNode(
    context,
    node,
    Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          if (icon != null) Icon(sduiIcon(icon), size: 48, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
          if (message != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(message, textAlign: TextAlign.center)),
          if (actionLabel != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: FilledButton(
                onPressed: () => render.tap(context, action: node.action, event: node.analyticsEvent, params: node.analyticsParams),
                child: Text(actionLabel),
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
  if (value == null || value < 0 || value > 5) throw SduiDataError(node, 'value');
  final count = node.integer('count');
  final label = node.string('label');
  final summary = [value.toStringAsFixed(1), if (count != null) '($count)', if (label != null) label].join(' ');
  return render.wrapNode(
    context,
    node,
    Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var star = 1; star <= 5; star++)
          Icon(
            value >= star ? Icons.star : (value >= star - 0.5 ? Icons.star_half : Icons.star_border),
            size: 18,
            color: Colors.amber,
          ),
        const SizedBox(width: 8),
        Text(summary),
      ],
    ),
  );
}

Widget _table(BuildContext context, SduiNode node, SduiRender render) {
  final columns = [for (final column in node.list('columns')) if (column is String) column];
  if (columns.isEmpty) throw SduiDataError(node, 'columns');
  TableRow rowOf(List<String> cells, {bool header = false}) {
    return TableRow(
      children: [
        for (var index = 0; index < columns.length; index++)
          Padding(
            padding: const EdgeInsets.all(8),
            // A row with too few cells gets empty ones; extra cells are ignored.
            child: Text(index < cells.length ? cells[index] : '', style: header ? const TextStyle(fontWeight: FontWeight.bold) : null),
          ),
      ],
    );
  }

  final rows = <TableRow>[rowOf(columns, header: true)];
  for (final raw in node.list('rows')) {
    if (raw is List) rows.add(rowOf([for (final cell in raw) '$cell']));
  }
  return render.wrapNode(
    context,
    node,
    Table(border: TableBorder.all(color: Theme.of(context).colorScheme.outlineVariant), children: rows),
  );
}

Widget _steps(BuildContext context, SduiNode node, SduiRender render) {
  final items = <Widget>[];
  final theme = Theme.of(context);
  for (final raw in node.list('steps')) {
    if (raw is! Map || raw['title'] is! String) continue;
    final state = raw['state'];
    final description = raw['description'];
    items.add(Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            switch (state) {
              'done' => Icons.check_circle,
              'current' => Icons.radio_button_checked,
              _ => Icons.radio_button_unchecked,
            },
            color: state == 'todo' || state == null ? theme.colorScheme.outline : theme.colorScheme.primary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(raw['title'] as String, style: theme.textTheme.titleSmall),
                if (description is String) Text(description, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    ));
  }
  if (items.isEmpty) throw SduiDataError(node, 'steps');
  return render.wrapNode(context, node, Column(children: items));
}

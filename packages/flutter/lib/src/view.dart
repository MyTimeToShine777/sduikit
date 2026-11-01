import 'package:flutter/material.dart';

import 'blocks.dart';
import 'client.dart';
import 'render.dart';
import 'theme.dart';

enum SduiDocumentKind { page, screen }

/// Loads a page or screen from the server and draws it.
///
/// - While loading with nothing saved: grey placeholder boxes.
/// - If a saved copy exists: it is shown at once, then replaced when the server answers.
/// - If the server fails or is too slow: the saved copy stays; with no copy, a friendly retry screen.
class SduiView extends StatefulWidget {
  const SduiView({
    super.key,
    required this.kind,
    required this.id,
    required this.client,
    required this.render,
    this.cache,
    this.timeout = const Duration(seconds: 10),
  });

  final SduiDocumentKind kind;
  final String id;
  final SduiClient client;
  final SduiRender render;
  final SduiCache? cache;

  /// How long to wait for the server before giving up.
  final Duration timeout;

  @override
  State<SduiView> createState() => _SduiViewState();
}

class _SduiViewState extends State<SduiView> {
  Map<String, dynamic>? _document;
  bool _failed = false;

  String get _cacheKey => '${widget.kind.name}:${widget.id}';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(SduiView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id || oldWidget.kind != widget.kind || oldWidget.client != widget.client) {
      _document = null;
      _load();
    }
  }

  Future<Map<String, dynamic>> _fetch() => widget.kind == SduiDocumentKind.page
      ? widget.client.fetchPage(widget.id)
      : widget.client.fetchScreen(widget.id);

  Future<void> _load() async {
    _failed = false;

    // Show the saved copy straight away so the screen is not empty while we ask the server.
    try {
      final saved = await widget.cache?.read(_cacheKey);
      if (!mounted) return;
      if (saved != null && _document == null) setState(() => _document = saved);
    } catch (error, stackTrace) {
      widget.render.onError?.call(error, stackTrace);
    }

    try {
      final fresh = await _fetch().timeout(widget.timeout);
      if (!mounted) return;
      setState(() => _document = fresh);
      try {
        await widget.cache?.write(_cacheKey, fresh);
      } catch (error, stackTrace) {
        widget.render.onError?.call(error, stackTrace);
      }
    } catch (error, stackTrace) {
      widget.render.onError?.call(error, stackTrace);
      if (!mounted) return;
      // Only show the retry screen when there is nothing at all to show.
      setState(() => _failed = _document == null);
    }
  }

  void _retry() {
    setState(() => _failed = false);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final document = _document;
    if (document != null) return _content(context, document);
    if (_failed) return _RetryView(onRetry: _retry);
    return const SduiSkeleton();
  }

  Widget _content(BuildContext context, Map<String, dynamic> document) {
    if (SduiContent.canDraw(document)) return SduiContent(document: document, render: widget.render);
    widget.render.onError?.call(const FormatException('The document has neither "sections" nor "root".'), null);
    return _RetryView(onRetry: _retry);
  }
}

/// Draws a page or screen that is already in hand, with no loading, saved copy or retry.
/// [SduiView] uses it once it has a document; a preview (for example inside a dashboard) uses it directly.
class SduiContent extends StatelessWidget {
  const SduiContent({super.key, required this.document, required this.render});

  final Map<String, dynamic> document;
  final SduiRender render;

  /// Whether this is a page (has "sections") or a screen (has "root").
  static bool canDraw(Map<String, dynamic> document) => document['sections'] is List || document['root'] != null;

  @override
  Widget build(BuildContext context) {
    final sections = document['sections'];
    if (sections is List) {
      final children = <Widget>[];
      for (final section in sections) {
        if (section is! Map) continue;
        final title = section['title'];
        final widgets = section['widgets'];
        if (title is String && title.isNotEmpty) {
          children.add(Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(title, style: Theme.of(context).textTheme.titleLarge),
          ));
        }
        if (widgets is List) children.addAll(render.pageChildren(context, widgets));
      }
      return SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
      );
    }
    if (document['root'] != null) return buildBlock(context, render, document['root']);
    return const SizedBox.shrink();
  }
}

/// Grey boxes shown while the first load is in progress.
class SduiSkeleton extends StatelessWidget {
  const SduiSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    final radius = context.sduiTokens.radius('md') ?? 8;
    Widget box(double height) => Container(
          height: height,
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(radius)),
        );
    return Padding(
      key: const Key('sdui-skeleton'),
      padding: const EdgeInsets.all(16),
      child: Column(children: [box(160), box(24), box(24), box(96)]),
    );
  }
}

class _RetryView extends StatelessWidget {
  const _RetryView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 48),
            const SizedBox(height: 16),
            const Text(
              'We could not load this screen. Check your connection and try again.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

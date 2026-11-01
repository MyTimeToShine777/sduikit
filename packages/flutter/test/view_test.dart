import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

import 'support.dart';

Widget viewHost(SduiClient client, SduiRender render, {SduiCache? cache, Duration? timeout, Key? key}) {
  return host(
    SduiView(
      key: key,
      kind: SduiDocumentKind.page,
      id: 'home',
      client: client,
      render: render,
      cache: cache,
      timeout: timeout ?? const Duration(seconds: 10),
    ),
  );
}

void main() {
  testWidgets('shows grey placeholders while loading, then the page', (tester) async {
    final answer = Completer<Map<String, dynamic>>();
    await tester.pumpWidget(viewHost(FakeClient(() => answer.future), makeRender(Reports())));

    expect(find.byKey(const Key('sdui-skeleton')), findsOneWidget);

    answer.complete(pageWith([textWidget('t', 'Loaded')]));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sdui-skeleton')), findsNothing);
    expect(find.text('Loaded'), findsOneWidget);
  });

  testWidgets('saves the page after a good answer', (tester) async {
    final cache = MemorySduiCache();
    final document = pageWith([textWidget('t', 'Loaded')]);
    await tester.pumpWidget(viewHost(FakeClient(() async => document), makeRender(Reports()), cache: cache));
    await tester.pumpAndSettle();

    expect(await cache.read('page:home'), document);
  });

  testWidgets('shows the saved copy when the server fails', (tester) async {
    final cache = MemorySduiCache();
    await cache.write('page:home', pageWith([textWidget('t', 'Saved copy')]));
    final reports = Reports();

    await tester.pumpWidget(viewHost(FakeClient(() async => throw Exception('offline')), makeRender(reports), cache: cache));
    await tester.pumpAndSettle();

    expect(find.text('Saved copy'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
    expect(reports.errors, hasLength(1)); // the failure was still reported
  });

  testWidgets('shows the saved copy at once and swaps in the fresh page when it arrives', (tester) async {
    final cache = MemorySduiCache();
    await cache.write('page:home', pageWith([textWidget('t', 'Old page')]));
    final answer = Completer<Map<String, dynamic>>();

    await tester.pumpWidget(viewHost(FakeClient(() => answer.future), makeRender(Reports()), cache: cache));
    await tester.pump();
    expect(find.text('Old page'), findsOneWidget);

    answer.complete(pageWith([textWidget('t', 'New page')]));
    await tester.pumpAndSettle();
    expect(find.text('Old page'), findsNothing);
    expect(find.text('New page'), findsOneWidget);
  });

  testWidgets('with nothing saved and a failing server: a friendly retry screen, and Try again works', (tester) async {
    var serverIsUp = false;
    final client = FakeClient(() async {
      if (!serverIsUp) throw Exception('offline');
      return pageWith([textWidget('t', 'Back online')]);
    });
    await tester.pumpWidget(viewHost(client, makeRender(Reports())));
    await tester.pumpAndSettle();

    expect(find.text('Try again'), findsOneWidget);
    expect(find.textContaining('could not load'), findsOneWidget);

    serverIsUp = true;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(find.text('Back online'), findsOneWidget);
    expect(client.calls, 2);
  });

  testWidgets('gives up after the time limit instead of waiting forever', (tester) async {
    final neverAnswers = Completer<Map<String, dynamic>>();
    await tester.pumpWidget(viewHost(
      FakeClient(() => neverAnswers.future),
      makeRender(Reports()),
      timeout: const Duration(milliseconds: 50),
    ));

    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump();

    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('a change on the server shows up the next time the page loads (no app release)', (tester) async {
    var current = loadFixture('page-home.json');
    final client = FakeClient(() async => current);
    final render = makeRender(Reports());

    await tester.pumpWidget(viewHost(client, render, key: const Key('first-open')));
    await tester.pumpAndSettle();
    expect(find.text('Welcome'), findsOneWidget);

    // Staff edit the banner title on the server...
    current = loadFixture('page-home.json');
    (((current['sections'] as List).first as Map)['widgets'] as List).first['data']['title'] = 'Winter offers are here';

    // ...and the app opens the page again.
    await tester.pumpWidget(viewHost(client, render, key: const Key('second-open')));
    await tester.pumpAndSettle();
    expect(find.text('Winter offers are here'), findsOneWidget);
    expect(find.text('Welcome'), findsNothing);
  });

  group('SduiContent (draws a page that is already in hand, for previews)', () {
    testWidgets('draws a page at once, with no loading and no client', (tester) async {
      await tester.pumpWidget(host(SduiContent(document: pageWith([textWidget('t', 'Right here')]), render: makeRender(Reports()))));
      expect(find.text('Right here'), findsOneWidget);
      expect(find.byKey(const Key('sdui-skeleton')), findsNothing);
    });

    testWidgets('draws a screen made of blocks', (tester) async {
      final screen = {'schema': 1, 'id': 's', 'revision': '1', 'root': {'block': 'text', 'text': 'A block'}};
      await tester.pumpWidget(host(SduiContent(document: screen, render: makeRender(Reports()))));
      expect(find.text('A block'), findsOneWidget);
    });

    test('canDraw tells pages and screens from anything else', () {
      expect(SduiContent.canDraw({'sections': []}), isTrue);
      expect(SduiContent.canDraw({'root': {'block': 'text'}}), isTrue);
      expect(SduiContent.canDraw({'schema': 1}), isFalse);
    });
  });

  testWidgets('a document with neither sections nor root is reported and shows the retry screen', (tester) async {
    final reports = Reports();
    await tester.pumpWidget(viewHost(FakeClient(() async => {'schema': 1}), makeRender(reports)));
    await tester.pumpAndSettle();
    expect(find.text('Try again'), findsOneWidget);
    expect(reports.errors, hasLength(1));
  });
}

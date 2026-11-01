import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/io.dart';
import 'package:sduikit/sduikit.dart';

import 'support.dart';

void main() {
  group('FileSduiCache', () {
    late Directory folder;

    setUp(() => folder = Directory.systemTemp.createTempSync('sduikit_cache_test'));
    tearDown(() => folder.deleteSync(recursive: true));

    test('gives back what was saved, even from a new cache object (like after the app restarts)', () async {
      final document = pageWith([textWidget('t', 'Saved')]);
      await FileSduiCache(folder).write('page:home', document);
      expect(await FileSduiCache(folder).read('page:home'), document);
    });

    test('returns null when nothing was saved', () async {
      expect(await FileSduiCache(folder).read('page:home'), isNull);
    });

    test('keeps different pages apart and replaces an older copy', () async {
      final cache = FileSduiCache(folder);
      await cache.write('page:home', {'id': 'home', 'v': 1});
      await cache.write('screen:home', {'id': 'screen'});
      await cache.write('page:home', {'id': 'home', 'v': 2});
      expect((await cache.read('page:home'))!['v'], 2);
      expect((await cache.read('screen:home'))!['id'], 'screen');
    });

    test('treats a damaged file as nothing saved instead of failing', () async {
      File('${folder.path}/page_home.json').writeAsStringSync('{ not json');
      expect(await FileSduiCache(folder).read('page:home'), isNull);
    });

    test('creates the folder if it is missing', () async {
      final nested = Directory('${folder.path}/a/b');
      await FileSduiCache(nested).write('page:home', {'id': 'home'});
      expect(await FileSduiCache(nested).read('page:home'), {'id': 'home'});
    });
  });

  // The direction is set inside the app, because MaterialApp sets its own from the language.
  Widget inDirection(TextDirection direction, Map<String, dynamic> document) {
    return host(
      Directionality(
        textDirection: direction,
        child: SduiView(
          kind: SduiDocumentKind.page,
          id: 'p',
          client: FakeClient(() async => document),
          render: makeRender(Reports()),
        ),
      ),
    );
  }

  group('right-to-left languages (Arabic)', () {
    testWidgets('the sample page draws without layout errors when the app is right-to-left', (tester) async {
      await tester.pumpWidget(inDirection(TextDirection.rtl, loadFixture('page-home.json')));
      await tester.pumpAndSettle();
      expect(find.text('Welcome'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('"start" alignment follows the reading direction', (tester) async {
      Future<double> leftEdgeOfText(TextDirection direction) async {
        final document = pageWith([
          {
            'id': 't',
            'type': 'text',
            'v': 1,
            'data': {'text': 'Hello'},
            'style': {'align': 'start'},
          },
        ]);
        await tester.pumpWidget(inDirection(direction, document));
        await tester.pumpAndSettle();
        return tester.getTopLeft(find.text('Hello')).dx;
      }

      final leftToRight = await leftEdgeOfText(TextDirection.ltr);
      final rightToLeft = await leftEdgeOfText(TextDirection.rtl);
      expect(rightToLeft, greaterThan(leftToRight)); // the text sits on the right in Arabic
    });
  });
}

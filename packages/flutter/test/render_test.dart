import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

import 'support.dart';

void main() {
  group('the sample page', () {
    testWidgets('draws every kind of widget', (tester) async {
      await tester.pumpWidget(pageHost(loadFixture('page-home.json'), makeRender(Reports())));
      await tester.pumpAndSettle();

      expect(find.text('Welcome'), findsOneWidget); // banner
      expect(find.text('Services'), findsOneWidget); // section title
      expect(find.text('Popular services'), findsOneWidget); // section_header
      expect(find.text('See all'), findsOneWidget);
      expect(find.text('Teeth cleaning'), findsOneWidget); // card inside carousel
      expect(find.text('A full check in one visit'), findsOneWidget); // widget inside a card
      expect(find.text('First item'), findsOneWidget); // list
      expect(find.byType(Divider), findsWidgets); // divider widget and list dividers
      expect(find.text('Book a visit'), findsOneWidget); // button
      expect(find.text('Upcoming'), findsOneWidget); // tabs
    });

    testWidgets('shows only the first tab, and switches when a tab is tapped', (tester) async {
      await tester.pumpWidget(pageHost(loadFixture('page-home.json'), makeRender(Reports())));
      await tester.pumpAndSettle();
      expect(find.text('No upcoming visits'), findsOneWidget);
      expect(find.text('No past visits'), findsNothing);

      await tester.ensureVisible(find.text('Past'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Past'));
      await tester.pumpAndSettle();

      expect(find.text('No past visits'), findsOneWidget);
      expect(find.text('No upcoming visits'), findsNothing);
    });

    testWidgets('a tapped button runs its action and reports its analytics event', (tester) async {
      final reports = Reports();
      String? calledName;
      Map<String, dynamic>? calledParams;
      final render = makeRender(
        reports,
        actions: SduiActionHandler(onCallApi: (name, params) async {
          calledName = name;
          calledParams = params;
        }),
      );
      await tester.pumpWidget(pageHost(loadFixture('page-home.json'), render));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Book a visit'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Book a visit'));
      await tester.pumpAndSettle();

      expect(calledName, 'start_booking');
      expect(calledParams, {'source': 'home'});
      expect(reports.analytics.single.key, 'home_book_tap');
      expect(reports.analytics.single.value, {'position': 'bottom'});
    });

    testWidgets('a tapped banner runs the action the server gave it', (tester) async {
      String? openedScreen;
      final render = makeRender(
        Reports(),
        actions: SduiActionHandler(onOpenScreen: (context, id) => openedScreen = id),
      );
      await tester.pumpWidget(pageHost(loadFixture('page-home.json'), render));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Welcome'));
      await tester.pumpAndSettle();

      expect(openedScreen, 'offers');
    });

    testWidgets('a picture that cannot load shows a placeholder, not an error', (tester) async {
      final reports = Reports();
      await tester.pumpWidget(pageHost(loadFixture('page-home.json'), makeRender(reports)));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.image_not_supported_outlined), findsWidgets);
      expect(tester.takeException(), isNull);
    });
  });

  group('the sample screen (building blocks)', () {
    testWidgets('draws the blocks and the widget embedded in them', (tester) async {
      final document = loadFixture('screen-offers.json');
      await tester.pumpWidget(host(
        SduiView(
          kind: SduiDocumentKind.screen,
          id: 'offers',
          client: FakeClient(() async => document),
          render: makeRender(Reports()),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text("This month's offers"), findsOneWidget);
      expect(find.text('Book now'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
      expect(find.text('New'), findsOneWidget); // inside the stack
      expect(find.text('One'), findsOneWidget); // inside the grid
      expect(find.text('Winter check-ups'), findsOneWidget); // banner widget in a block
    });

    testWidgets('a button block runs its action', (tester) async {
      String? nativeScreenParams;
      final render = makeRender(
        Reports(),
        actions: SduiActionHandler(nativeScreens: {'booking': (context, params) => nativeScreenParams = '${params['source']}'}),
      );
      final document = loadFixture('screen-offers.json');
      await tester.pumpWidget(host(
        SduiView(
          kind: SduiDocumentKind.screen,
          id: 'offers',
          client: FakeClient(() async => document),
          render: render,
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Book now'));
      await tester.pumpAndSettle();
      expect(nativeScreenParams, 'offers');
    });

    testWidgets('a block it does not know is skipped and reported', (tester) async {
      final reports = Reports();
      final document = {
        'schema': 1,
        'id': 's',
        'revision': '1',
        'root': {
          'block': 'column',
          'children': [
            {'block': 'hologram'},
            {'block': 'text', 'text': 'Still here'},
          ],
        },
      };
      await tester.pumpWidget(host(
        SduiView(
          kind: SduiDocumentKind.screen,
          id: 's',
          client: FakeClient(() async => document),
          render: makeRender(reports),
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Still here'), findsOneWidget);
      expect(reports.errors, hasLength(1));
    });
  });

  group('when something is wrong with one widget, the rest still draws', () {
    testWidgets('unknown type: skipped and reported', (tester) async {
      final reports = Reports();
      final document = pageWith([
        {'id': 'x', 'type': 'hologram', 'v': 1, 'data': {}},
        textWidget('t', 'Still here'),
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(reports)));
      await tester.pumpAndSettle();
      expect(find.text('Still here'), findsOneWidget);
      expect(reports.errors.single, isA<SduiUnknownWidget>());
    });

    testWidgets('unknown version: skipped and reported', (tester) async {
      final reports = Reports();
      final document = pageWith([
        {'id': 'x', 'type': 'text', 'v': 2, 'data': {'text': 'From the future'}},
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(reports)));
      await tester.pumpAndSettle();
      expect(find.text('From the future'), findsNothing);
      expect(reports.errors.single, isA<SduiUnknownWidget>());
    });

    testWidgets('unknown type with a fallback: the fallback is drawn', (tester) async {
      final document = pageWith([
        {'id': 'x', 'type': 'hologram', 'v': 1, 'data': {}, 'fallback': textWidget('f', 'Backup')},
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(Reports())));
      await tester.pumpAndSettle();
      expect(find.text('Backup'), findsOneWidget);
    });

    testWidgets('missing required data: skipped, nothing invented, reported', (tester) async {
      final reports = Reports();
      final document = pageWith([
        {'id': 'x', 'type': 'banner', 'v': 1, 'data': {}},
        {'id': 'y', 'type': 'text', 'v': 1, 'data': {}},
        textWidget('t', 'Still here'),
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(reports)));
      await tester.pumpAndSettle();
      expect(find.text('Still here'), findsOneWidget);
      expect(find.byType(Text), findsOneWidget); // no made-up title, rating or name anywhere
      expect(reports.errors, hasLength(2));
      expect(reports.errors, everyElement(isA<SduiDataError>()));
    });

    testWidgets('a widget whose own code crashes is skipped and reported', (tester) async {
      final reports = Reports();
      final registry = SduiWidgetRegistry.withBuiltIns()
        ..register('boom', 1, (context, node, render) => throw StateError('bug in my widget'));
      final document = pageWith([
        {'id': 'x', 'type': 'boom', 'v': 1, 'data': {}},
        textWidget('t', 'Still here'),
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(reports, registry: registry)));
      await tester.pumpAndSettle();
      expect(find.text('Still here'), findsOneWidget);
      expect(reports.errors.single, isA<StateError>());
    });

    testWidgets('an entry that is not a widget at all is skipped and reported', (tester) async {
      final reports = Reports();
      final document = pageWith([
        {'nonsense': true},
        textWidget('t', 'Still here'),
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(reports)));
      await tester.pumpAndSettle();
      expect(find.text('Still here'), findsOneWidget);
      expect(reports.errors, hasLength(1));
    });

    testWidgets('a kill switch hides a widget type without an error', (tester) async {
      final reports = Reports();
      final document = pageWith([textWidget('t', 'Hidden by the manifest')]);
      await tester.pumpWidget(pageHost(document, makeRender(reports, killedWidgets: {'text'})));
      await tester.pumpAndSettle();
      expect(find.text('Hidden by the manifest'), findsNothing);
      expect(reports.errors, isEmpty);
    });
  });

  group('the app\'s own widgets', () {
    testWidgets('are drawn once registered, and listed as supported', (tester) async {
      final registry = SduiWidgetRegistry.withBuiltIns()
        ..register('doctor_card', 1, (context, node, render) => Text('Dr ${node.requireString('name')}'));
      final document = pageWith([
        {'id': 'd', 'type': 'doctor_card', 'v': 1, 'data': {'name': 'Rao'}},
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(Reports(), registry: registry)));
      await tester.pumpAndSettle();

      expect(find.text('Dr Rao'), findsOneWidget);
      expect(registry.supported['doctor_card'], [1]);
      expect(registry.supported['text'], [1]);
    });

    testWidgets('can hold built-in widgets inside them', (tester) async {
      final registry = SduiWidgetRegistry.withBuiltIns()
        ..register('panel', 1, (context, node, render) => Column(children: render.children(context, node.list('items'))));
      final document = pageWith([
        {'id': 'p', 'type': 'panel', 'v': 1, 'data': {'items': [textWidget('a', 'Inside')]}},
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(Reports(), registry: registry)));
      await tester.pumpAndSettle();
      expect(find.text('Inside'), findsOneWidget);
    });
  });

  group('style tokens', () {
    testWidgets('padding and corner tokens come from the theme', (tester) async {
      final manifestTheme = loadFixture('manifest.json')['theme'] as Map<String, dynamic>;
      final document = pageWith([
        {
          'id': 't',
          'type': 'text',
          'v': 1,
          'data': {'text': 'Padded'},
          'style': {'spacing': 'lg', 'color': 'surface', 'radius': 'md'},
        },
      ]);
      await tester.pumpWidget(host(
        SduiView(
          kind: SduiDocumentKind.page,
          id: 'p',
          client: FakeClient(() async => document),
          render: makeRender(Reports()),
        ),
        theme: sduiThemeData(manifestTheme),
      ));
      await tester.pumpAndSettle();

      final box = tester.widget<Container>(find.ancestor(of: find.text('Padded'), matching: find.byType(Container)).first);
      expect(box.padding, const EdgeInsets.all(24)); // "lg" in the sample theme
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

import 'support.dart';

/// Opens the sample page that uses every new widget, with a fixed clock for the countdown.
Future<Reports> openShowcase(WidgetTester tester, {SduiActionHandler? actions, DateTime? now}) async {
  final reports = Reports();
  final render = makeRender(reports, actions: actions, clock: () => now ?? DateTime.utc(2026, 11, 30));
  // A fresh key makes the page start over, so the tests can open it again with another clock.
  await tester.pumpWidget(pageHost(loadFixture('page-showcase.json'), render, key: UniqueKey()));
  await tester.pumpAndSettle();
  return reports;
}

void main() {
  group('display widgets', () {
    testWidgets('draw their content', (tester) async {
      final reports = await openShowcase(tester);

      expect(find.text('Spring sale'), findsOneWidget); // hero
      expect(find.text('Up to 40% off'), findsOneWidget);
      expect(find.text('Search products'), findsOneWidget); // search_bar
      expect(find.text('Orders'), findsOneWidget); // quick_actions
      expect(find.text('Wishlist'), findsOneWidget);
      expect(find.text('All'), findsOneWidget); // chips
      expect(find.text('Latest'), findsOneWidget);
      expect(find.textContaining('Free delivery', findRichText: true), findsOneWidget); // rich_text
      expect(find.text('New'), findsOneWidget); // badge
      expect(find.text('Heads up'), findsOneWidget); // alert
      expect(find.text('Deliveries are slower this week.'), findsOneWidget);
      expect(find.text('60% complete'), findsOneWidget); // progress (linear)
      expect(find.text('25%'), findsOneWidget); // progress (circular)
      expect(find.text('Orders this month'), findsOneWidget); // stat
      expect(find.text('128'), findsOneWidget);
      expect(find.text('+12%'), findsOneWidget);
      expect(find.text('4.6 (212) Customer rating'), findsOneWidget); // rating
      expect(find.text('Order number'), findsOneWidget); // key_value
      expect(find.text('A-1042'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget); // list_item
      expect(find.text('Choose what you hear about'), findsOneWidget);
      expect(find.text('Setup took five minutes.'), findsOneWidget); // quote
      expect(find.text('Sam Lee, Founder'), findsOneWidget);
      expect(find.byType(Table), findsOneWidget); // table
      expect(find.text('10'), findsOneWidget);
      expect(find.text('Order placed'), findsOneWidget); // steps
      expect(find.text('We are packing it now'), findsOneWidget);
      expect(find.text('No messages yet'), findsOneWidget); // empty_state
      expect(find.text('Start a conversation'), findsOneWidget);
      expect(find.text('How it works'), findsOneWidget); // video_card
      expect(find.text('2:14'), findsOneWidget);
      expect(find.text('10 seats'), findsOneWidget); // pricing_card
      expect(find.text('Choose Team'), findsOneWidget);
      expect(find.text('One'), findsOneWidget); // container
      expect(find.text('Two'), findsOneWidget);

      expect(reports.errors, isEmpty); // nothing had to be skipped
    });

    testWidgets('the countdown shows the time left, and the ended text once it is over', (tester) async {
      await openShowcase(tester, now: DateTime.utc(2026, 11, 30));
      expect(find.text('Sale ends in 1d 0h 0m'), findsOneWidget);

      await openShowcase(tester, now: DateTime.utc(2026, 11, 30, 21, 30));
      expect(find.text('Sale ends in 2h 30m'), findsOneWidget);

      await openShowcase(tester, now: DateTime.utc(2027, 1, 1));
      expect(find.text('The sale has ended'), findsOneWidget);
    });

    testWidgets('the accordion opens one section at a time', (tester) async {
      await openShowcase(tester);
      expect(find.text('Return anything within 30 days.'), findsNothing);

      await tester.ensureVisible(find.text('Returns'));
      await tester.tap(find.text('Returns'));
      await tester.pumpAndSettle();
      expect(find.text('Return anything within 30 days.'), findsOneWidget);

      await tester.tap(find.text('Shipping'));
      await tester.pumpAndSettle();
      expect(find.text('Standard shipping takes 3 to 5 days.'), findsOneWidget);
      expect(find.text('Return anything within 30 days.'), findsNothing);
    });

    testWidgets('widgets with missing data are skipped and reported, not drawn half-empty', (tester) async {
      final reports = Reports();
      final document = pageWith([
        {'id': 'a', 'type': 'rating', 'v': 1, 'data': {'value': 9}},
        {'id': 'b', 'type': 'progress', 'v': 1, 'data': {}},
        {'id': 'c', 'type': 'countdown', 'v': 1, 'data': {'until': 'soon'}},
        {'id': 'd', 'type': 'avatar', 'v': 1, 'data': {}},
        {'id': 'e', 'type': 'table', 'v': 1, 'data': {'columns': [], 'rows': []}},
        textWidget('t', 'Still here'),
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(reports)));
      await tester.pumpAndSettle();

      expect(find.text('Still here'), findsOneWidget);
      expect(reports.errors, hasLength(5));
      expect(reports.errors, everyElement(isA<SduiDataError>()));
    });

    testWidgets('a table row with too few or too many cells still draws', (tester) async {
      final document = pageWith([
        {
          'id': 't',
          'type': 'table',
          'v': 1,
          'data': {
            'columns': ['A', 'B'],
            'rows': [
              ['only one'],
              ['x', 'y', 'extra'],
            ],
          },
        },
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(Reports())));
      await tester.pumpAndSettle();
      expect(find.text('only one'), findsOneWidget);
      expect(find.text('extra'), findsNothing);
    });

    testWidgets('an icon name this app does not know shows a plain square instead of failing', (tester) async {
      final document = pageWith([
        {'id': 'i', 'type': 'icon', 'v': 1, 'data': {'name': 'brand_new_icon'}},
      ]);
      await tester.pumpWidget(pageHost(document, makeRender(Reports())));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.apps), findsOneWidget);
    });
  });

  group('tapping', () {
    Future<List<String>> tapAndCollect(WidgetTester tester, Finder target) async {
      final calls = <String>[];
      await openShowcase(
        tester,
        actions: SduiActionHandler(
          onOpenScreen: (context, id) => calls.add('screen:$id'),
          onOpenUrl: (url, external) => calls.add('url:$url'),
          onCallApi: (name, params) async => calls.add('api:$name:${params.entries.map((e) => '${e.key}=${e.value}').join(',')}'),
        ),
      );
      await tester.ensureVisible(target);
      await tester.pumpAndSettle();
      await tester.tap(target);
      await tester.pumpAndSettle();
      return calls;
    }

    testWidgets('a quick action opens its screen', (tester) async {
      expect(await tapAndCollect(tester, find.text('Orders')), ['screen:orders']);
    });

    testWidgets('a chip sends its choice to the app', (tester) async {
      expect(await tapAndCollect(tester, find.text('Latest')), ['api:set_filter:category=new']);
    });

    testWidgets('a list item runs its action', (tester) async {
      expect(await tapAndCollect(tester, find.text('Notifications')), ['screen:notifications']);
    });

    testWidgets('the search bar runs its action', (tester) async {
      expect(await tapAndCollect(tester, find.text('Search products')), ['screen:search']);
    });

    testWidgets('the hero button runs the hero action', (tester) async {
      expect(await tapAndCollect(tester, find.text('Shop now')), ['screen:sale']);
    });

    testWidgets('the video card hands the video address to the app', (tester) async {
      expect(await tapAndCollect(tester, find.text('How it works')), ['url:https://example.com/video']);
    });

    testWidgets('the pricing card button runs its action with its own params', (tester) async {
      expect(await tapAndCollect(tester, find.text('Choose Team')), ['api:choose_plan:plan=team']);
    });

    testWidgets('the empty state button runs its action', (tester) async {
      expect(await tapAndCollect(tester, find.text('Start a conversation')), ['screen:compose']);
    });
  });

  group('forms', () {
    Map<String, dynamic> formPage() => pageWith([
          {
            'id': 'f',
            'type': 'form',
            'v': 1,
            'data': {
              'submitLabel': 'Send',
              'fields': [
                {'name': 'name', 'type': 'text', 'label': 'Your name', 'required': true},
                {'name': 'email', 'type': 'email', 'label': 'Email', 'required': true},
                {'name': 'age', 'type': 'number', 'label': 'Age'},
                {'name': 'subscribe', 'type': 'switch', 'label': 'Send me updates'},
                {'name': 'agree', 'type': 'checkbox', 'label': 'I agree', 'required': true},
              ],
            },
            'action': {'type': 'call_api', 'name': 'contact_us', 'params': {'source': 'test'}},
          },
        ]);

    Future<List<Map<String, dynamic>>> openForm(WidgetTester tester) async {
      final sent = <Map<String, dynamic>>[];
      final render = makeRender(
        Reports(),
        // "api" is the name of the API call; the form's own "name" field arrives inside params.
        actions: SduiActionHandler(onCallApi: (name, params) async => sent.add({'api': name, ...params})),
      );
      await tester.pumpWidget(pageHost(formPage(), render));
      await tester.pumpAndSettle();
      return sent;
    }

    Future<void> submit(WidgetTester tester) async {
      await tester.ensureVisible(find.text('Send'));
      await tester.tap(find.text('Send'));
      await tester.pumpAndSettle();
    }

    testWidgets('does not send anything while required fields are empty, and says what is missing', (tester) async {
      final sent = await openForm(tester);
      await submit(tester);

      expect(sent, isEmpty);
      expect(find.text('Please fill this in.'), findsNWidgets(2)); // name and email
      expect(find.text('Please tick this box.'), findsOneWidget);
    });

    testWidgets('checks the email and number formats', (tester) async {
      final sent = await openForm(tester);
      await tester.enterText(find.byType(TextFormField).at(0), 'Sam');
      await tester.enterText(find.byType(TextFormField).at(1), 'not an email');
      await tester.enterText(find.byType(TextFormField).at(2), 'abc');
      await tester.tap(find.byType(Checkbox));
      await submit(tester);

      expect(sent, isEmpty);
      expect(find.text('Enter a valid email address.'), findsOneWidget);
      expect(find.text('Enter a number.'), findsOneWidget);
    });

    testWidgets('sends what was typed together with the action\'s own params', (tester) async {
      final sent = await openForm(tester);
      await tester.enterText(find.byType(TextFormField).at(0), 'Sam Lee');
      await tester.enterText(find.byType(TextFormField).at(1), 'sam@example.com');
      await tester.enterText(find.byType(TextFormField).at(2), '31');
      await tester.tap(find.byType(Checkbox));
      await submit(tester);

      expect(sent, hasLength(1));
      expect(sent.single, {
        'api': 'contact_us',
        'source': 'test', // the action's own param is kept
        'name': 'Sam Lee',
        'email': 'sam@example.com',
        'age': 31, // a number stays a number
        'subscribe': false,
        'agree': true,
      });
    });

    testWidgets('leaves out optional fields that were not filled in', (tester) async {
      final sent = await openForm(tester);
      await tester.enterText(find.byType(TextFormField).at(0), 'Sam');
      await tester.enterText(find.byType(TextFormField).at(1), 'sam@example.com');
      await tester.tap(find.byType(Checkbox));
      await submit(tester);
      expect(sent.single.containsKey('age'), isFalse);
    });
  });
}

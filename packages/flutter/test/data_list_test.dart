import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

import 'support.dart';

Map<String, dynamic> doctorRowTemplate() => {
      'id': 'row',
      'type': 'card',
      'v': 1,
      'data': {
        'title': '{{name}}',
        'subtitle': '{{specialty}} · {{fee}} AED',
        'imageUrl': '{{photoUrl}}',
      },
      'action': {
        'type': 'open_native',
        'name': 'doctor_profile',
        'params': {'doctorId': '{{id}}'},
      },
    };

Map<String, dynamic> doctorList({String layout = 'list', String? emptyText, String source = 'doctors_nearby'}) => {
      'id': 'doctors',
      'type': 'data_list',
      'v': 1,
      'data': {
        'source': {'name': source, 'params': {'city': 'Dubai'}},
        'layout': layout,
        'columns': 2,
        if (emptyText != null) 'emptyText': emptyText,
        'template': [doctorRowTemplate()],
      },
    };

void main() {
  group('fillTemplate', () {
    final row = {
      'id': 7,
      'name': 'Dr Rao',
      'fee': 150,
      'clinic': {'name': 'Smile Clinic'},
    };

    test('fills text and keeps numbers as numbers when the placeholder is the whole value', () {
      final filled = fillTemplate({'title': '{{name}}', 'doctorId': '{{id}}', 'line': '{{name}} · {{fee}} AED'}, row);
      expect(filled, {'title': 'Dr Rao', 'doctorId': 7, 'line': 'Dr Rao · 150 AED'});
    });

    test('reads nested values with dots', () {
      expect(fillTemplate('{{clinic.name}}', row), 'Smile Clinic');
    });

    test('leaves out a field the row does not have, instead of inventing one', () {
      expect(fillTemplate({'photo': '{{photoUrl}}', 'title': '{{name}}'}, row), {'title': 'Dr Rao'});
    });

    test('makes a missing value inside longer text empty', () {
      expect(fillTemplate('Dr {{missing}}.', row), 'Dr .');
    });

    test('works inside lists and nested maps and leaves other values alone', () {
      expect(
        fillTemplate({'a': ['{{name}}', 3, true], 'b': {'c': 'plain'}}, row),
        {'a': ['Dr Rao', 3, true], 'b': {'c': 'plain'}},
      );
    });
  });

  group('data_list widget', () {
    testWidgets('draws one template per row with the row\'s values', (tester) async {
      await tester.pumpWidget(pageHost(pageWith([doctorList()]), makeRender(Reports())));
      await tester.pumpAndSettle();

      expect(find.text('Dr Rao'), findsOneWidget);
      expect(find.text('Dentist · 150 AED'), findsOneWidget); // a number inside text
      expect(find.text('Dr Khan'), findsOneWidget);
      expect(find.text('Cardiologist · 300 AED'), findsOneWidget);
    });

    testWidgets('a row without a photo simply has no picture (nothing is made up)', (tester) async {
      await tester.pumpWidget(pageHost(pageWith([doctorList()]), makeRender(Reports())));
      await tester.pumpAndSettle();
      // Dr Rao has a photo address (it fails to load in tests and shows the placeholder); Dr Khan has none.
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('tapping a row sends that row\'s id to the app\'s screen', (tester) async {
      Map<String, dynamic>? received;
      final render = makeRender(
        Reports(),
        actions: SduiActionHandler(nativeScreens: {'doctor_profile': (context, params) => received = params}),
      );
      await tester.pumpWidget(pageHost(pageWith([doctorList()]), render));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Dr Khan'));
      await tester.pumpAndSettle();
      expect(received, {'doctorId': 8}); // still a number
    });

    testWidgets('shows grey placeholders while loading', (tester) async {
      final answer = Completer<List<Map<String, dynamic>>>();
      final render = makeRender(Reports(), dataLoader: (name, params) => answer.future);
      await tester.pumpWidget(pageHost(pageWith([doctorList()]), render));
      await tester.pump();
      await tester.pump();

      expect(find.byKey(const Key('sdui-data-loading')), findsOneWidget);

      answer.complete(sampleDoctors);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('sdui-data-loading')), findsNothing);
      expect(find.text('Dr Rao'), findsOneWidget);
    });

    testWidgets('passes the source name and params to the app\'s loader', (tester) async {
      String? askedName;
      Map<String, dynamic>? askedParams;
      final render = makeRender(Reports(), dataLoader: (name, params) async {
        askedName = name;
        askedParams = params;
        return sampleDoctors;
      });
      await tester.pumpWidget(pageHost(pageWith([doctorList()]), render));
      await tester.pumpAndSettle();
      expect(askedName, 'doctors_nearby');
      expect(askedParams, {'city': 'Dubai'});
    });

    testWidgets('shows the empty text when there are no rows', (tester) async {
      final render = makeRender(Reports(), dataLoader: (name, params) async => []);
      await tester.pumpWidget(pageHost(pageWith([doctorList(emptyText: 'No doctors found nearby')]), render));
      await tester.pumpAndSettle();
      expect(find.text('No doctors found nearby'), findsOneWidget);
    });

    testWidgets('shows a retry when loading fails, and loads again on Try again', (tester) async {
      var up = false;
      final reports = Reports();
      final render = makeRender(reports, dataLoader: (name, params) async {
        if (!up) throw Exception('offline');
        return sampleDoctors;
      });
      await tester.pumpWidget(pageHost(pageWith([doctorList()]), render));
      await tester.pumpAndSettle();

      expect(find.text('We could not load this list.'), findsOneWidget);
      expect(reports.errors, hasLength(1));

      up = true;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Dr Rao'), findsOneWidget);
    });

    testWidgets('the rest of the page still draws when the list cannot load', (tester) async {
      final render = makeRender(Reports(), dataLoader: (name, params) async => throw Exception('offline'));
      await tester.pumpWidget(pageHost(pageWith([textWidget('t', 'Still here'), doctorList()]), render));
      await tester.pumpAndSettle();
      expect(find.text('Still here'), findsOneWidget);
    });

    testWidgets('without a data loader the list is skipped and reported, and the fallback is drawn', (tester) async {
      final reports = Reports();
      final list = doctorList()..['fallback'] = textWidget('f', 'Doctors are unavailable');
      await tester.pumpWidget(pageHost(pageWith([list]), makeRender(reports, withoutDataLoader: true)));
      await tester.pumpAndSettle();

      expect(find.text('Doctors are unavailable'), findsOneWidget);
      expect(reports.errors.single, isA<StateError>());
    });

    testWidgets('can lay rows out as a grid', (tester) async {
      await tester.pumpWidget(pageHost(pageWith([doctorList(layout: 'grid')]), makeRender(Reports())));
      await tester.pumpAndSettle();
      expect(find.text('Dr Rao'), findsOneWidget);
      expect(find.byType(SduiGridRows), findsOneWidget);
    });

    testWidgets('can lay rows out as a carousel', (tester) async {
      await tester.pumpWidget(pageHost(pageWith([doctorList(layout: 'carousel')]), makeRender(Reports())));
      await tester.pumpAndSettle();
      expect(find.text('Dr Khan'), findsOneWidget);
    });
  });
}

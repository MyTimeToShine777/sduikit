import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

import 'support.dart';

Map<String, dynamic> carouselWith({required bool autoplay, int cards = 4}) => {
      'id': 'c',
      'type': 'carousel',
      'v': 1,
      'data': {
        'autoplay': autoplay,
        'viewportFraction': 0.8,
        'items': [for (var index = 0; index < cards; index++) textWidget('card$index', 'Card $index')],
      },
    };

double scrolledBy(WidgetTester tester) {
  final scrollable = tester.state<ScrollableState>(find.byType(Scrollable).first);
  return scrollable.position.pixels;
}

void main() {
  testWidgets('with autoplay it moves to the next card by itself', (tester) async {
    await tester.pumpWidget(pageHost(pageWith([carouselWith(autoplay: true)]), makeRender(Reports())));
    await tester.pumpAndSettle();
    expect(scrolledBy(tester), 0);

    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    expect(scrolledBy(tester), greaterThan(0));
  });

  testWidgets('with autoplay it goes back to the first card after the last', (tester) async {
    await tester.pumpWidget(pageHost(pageWith([carouselWith(autoplay: true, cards: 3)]), makeRender(Reports())));
    await tester.pumpAndSettle();

    var reachedTheEnd = false;
    for (var round = 0; round < 6; round++) {
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
      final scrollable = tester.state<ScrollableState>(find.byType(Scrollable).first);
      if (scrollable.position.pixels >= scrollable.position.maxScrollExtent - 1) reachedTheEnd = true;
      if (reachedTheEnd && scrollable.position.pixels == 0) break;
    }
    expect(reachedTheEnd, isTrue);
    expect(scrolledBy(tester), 0); // and came back
  });

  testWidgets('without autoplay it stays where it is', (tester) async {
    await tester.pumpWidget(pageHost(pageWith([carouselWith(autoplay: false)]), makeRender(Reports())));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 10));
    await tester.pumpAndSettle();
    expect(scrolledBy(tester), 0);
  });

  testWidgets('a single card never moves, even with autoplay', (tester) async {
    await tester.pumpWidget(pageHost(pageWith([carouselWith(autoplay: true, cards: 1)]), makeRender(Reports())));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 10));
    await tester.pumpAndSettle();
    expect(scrolledBy(tester), 0);
  });

  testWidgets('touching the carousel pauses it for one round', (tester) async {
    await tester.pumpWidget(pageHost(pageWith([carouselWith(autoplay: true)]), makeRender(Reports())));
    await tester.pumpAndSettle();

    final gesture = await tester.startGesture(tester.getCenter(find.byType(SingleChildScrollView).first));
    await gesture.up();
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    expect(scrolledBy(tester), 0); // skipped this round

    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    expect(scrolledBy(tester), greaterThan(0)); // moves again
  });
}

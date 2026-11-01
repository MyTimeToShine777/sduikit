import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

void main() {
  // Actions need a BuildContext, so each test borrows one from a tiny app.
  Future<BuildContext> contextFrom(WidgetTester tester) async {
    late BuildContext context;
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (c) {
        context = c;
        return const SizedBox();
      }),
    ));
    return context;
  }

  testWidgets('open_screen and open_sheet pass the screen id', (tester) async {
    final context = await contextFrom(tester);
    final opened = <String>[];
    final handler = SduiActionHandler(
      onOpenScreen: (c, id) => opened.add('screen:$id'),
      onOpenSheet: (c, id) => opened.add('sheet:$id'),
    );
    await handler.run(context, {'type': 'open_screen', 'screenId': 'offers'});
    await handler.run(context, {'type': 'open_sheet', 'screenId': 'filters'});
    expect(opened, ['screen:offers', 'sheet:filters']);
  });

  testWidgets('open_url says whether to open outside the app (default: no)', (tester) async {
    final context = await contextFrom(tester);
    final calls = <String>[];
    final handler = SduiActionHandler(onOpenUrl: (url, external) => calls.add('$url|$external'));
    await handler.run(context, {'type': 'open_url', 'url': 'https://a.com'});
    await handler.run(context, {'type': 'open_url', 'url': 'https://b.com', 'external': true});
    expect(calls, ['https://a.com|false', 'https://b.com|true']);
  });

  testWidgets('call_api passes the name and params and waits for the answer', (tester) async {
    final context = await contextFrom(tester);
    String? name;
    Map<String, dynamic>? params;
    final handler = SduiActionHandler(onCallApi: (n, p) async {
      name = n;
      params = p;
    });
    await handler.run(context, {'type': 'call_api', 'name': 'start_booking', 'params': {'source': 'home'}});
    expect(name, 'start_booking');
    expect(params, {'source': 'home'});
  });

  testWidgets('share passes the text and the optional link', (tester) async {
    final context = await contextFrom(tester);
    final shared = <String>[];
    final handler = SduiActionHandler(onShare: (text, url) => shared.add('$text|$url'));
    await handler.run(context, {'type': 'share', 'text': 'Hello', 'url': 'https://a.com'});
    await handler.run(context, {'type': 'share', 'text': 'Hi'});
    expect(shared, ['Hello|https://a.com', 'Hi|null']);
  });

  testWidgets('open_native opens the screen registered under that name', (tester) async {
    final context = await contextFrom(tester);
    Map<String, dynamic>? received;
    final handler = SduiActionHandler(nativeScreens: {'booking': (c, params) => received = params});
    await handler.run(context, {'type': 'open_native', 'name': 'booking', 'params': {'source': 'offers'}});
    expect(received, {'source': 'offers'});
  });

  testWidgets('dismiss calls the app handler', (tester) async {
    final context = await contextFrom(tester);
    var dismissed = false;
    await SduiActionHandler(onDismiss: (c) => dismissed = true).run(context, {'type': 'dismiss'});
    expect(dismissed, isTrue);
  });

  testWidgets('an action that cannot run is reported, never thrown', (tester) async {
    final context = await contextFrom(tester);
    final errors = <Object>[];
    final handler = SduiActionHandler(onError: (e, s) => errors.add(e));

    await handler.run(context, {'type': 'open_screen', 'screenId': 'a'}); // no handler given
    await handler.run(context, {'type': 'open_native', 'name': 'nowhere'}); // not registered
    await handler.run(context, {'type': 'explode'}); // unknown type
    await handler.run(context, {'type': 'open_url'}); // missing url

    expect(errors, hasLength(4));
  });

  testWidgets('an app handler that throws is reported, never thrown', (tester) async {
    final context = await contextFrom(tester);
    final errors = <Object>[];
    final handler = SduiActionHandler(
      onCallApi: (name, params) async => throw StateError('server down'),
      onError: (e, s) => errors.add(e),
    );
    await handler.run(context, {'type': 'call_api', 'name': 'x'});
    expect(errors.single, isA<StateError>());
  });

  testWidgets('a killed action is ignored without an error', (tester) async {
    final context = await contextFrom(tester);
    var opened = false;
    final errors = <Object>[];
    final handler = SduiActionHandler(
      onOpenScreen: (c, id) => opened = true,
      killedActions: {'open_screen'},
      onError: (e, s) => errors.add(e),
    );
    await handler.run(context, {'type': 'open_screen', 'screenId': 'a'});
    expect(opened, isFalse);
    expect(errors, isEmpty);
  });

  testWidgets('no action does nothing', (tester) async {
    final context = await contextFrom(tester);
    await SduiActionHandler().run(context, null);
  });
}

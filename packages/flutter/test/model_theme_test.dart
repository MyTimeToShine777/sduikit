import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

import 'support.dart';

void main() {
  group('SduiNode', () {
    test('reads every widget in the sample page', () {
      final page = loadFixture('page-home.json');
      final widgets = [
        for (final section in page['sections'] as List)
          for (final widget in (section as Map)['widgets'] as List) SduiNode.tryParse(widget),
      ];
      expect(widgets, isNotEmpty);
      expect(widgets.every((node) => node != null), isTrue);
    });

    test('reads the style, action, analytics and fallback of the banner', () {
      final banner = SduiNode.tryParse(
        ((loadFixture('page-home.json')['sections'] as List).first as Map)['widgets'][0],
      )!;
      expect(banner.type, 'banner');
      expect(banner.version, 1);
      expect(banner.style['spacing'], 'md');
      expect(banner.action!['type'], 'open_screen');
      expect(banner.analyticsEvent, 'home_banner_tap');
      expect(banner.fallback!.id, 'w_banner_1_fallback');
    });

    test('returns null for something that is not a widget', () {
      expect(SduiNode.tryParse('text'), isNull);
      expect(SduiNode.tryParse({'id': 'a'}), isNull);
      expect(SduiNode.tryParse({'id': 'a', 'type': 'text', 'v': '1', 'data': {}}), isNull);
    });

    test('requireString throws for a missing or empty value instead of inventing one', () {
      final node = SduiNode.tryParse({'id': 'a', 'type': 'text', 'v': 1, 'data': {'text': ''}})!;
      expect(() => node.requireString('text'), throwsA(isA<SduiDataError>()));
      expect(() => node.requireString('other'), throwsA(isA<SduiDataError>()));
    });
  });

  group('theme', () {
    final manifestTheme = loadFixture('manifest.json')['theme'] as Map<String, dynamic>;

    test('turns token names into sizes and colours', () {
      final tokens = SduiTokens.fromManifestTheme(manifestTheme, brightness: Brightness.light);
      expect(tokens.space('md'), 16);
      expect(tokens.radius('lg'), 16);
      expect(tokens.textSize('headline'), 24);
      expect(tokens.color('primary'), const Color(0xFF0B6E4F));
    });

    test('uses the dark colours in dark mode', () {
      final tokens = SduiTokens.fromManifestTheme(manifestTheme, brightness: Brightness.dark);
      expect(tokens.color('primary'), const Color(0xFF34D399));
      expect(tokens.color('background'), const Color(0xFF0B0F14));
    });

    test('gives null for a token it does not know', () {
      final tokens = SduiTokens.fromManifestTheme(manifestTheme, brightness: Brightness.light);
      expect(tokens.space('huge'), isNull);
      expect(tokens.color('purple'), isNull);
      expect(tokens.color(null), isNull);
    });

    test('puts the manifest colours into the Flutter theme', () {
      final theme = sduiThemeData(manifestTheme);
      expect(theme.colorScheme.primary, const Color(0xFF0B6E4F));
      expect(theme.scaffoldBackgroundColor, const Color(0xFFFFFFFF));
      expect(theme.extension<SduiThemeExtension>()!.tokens.space('lg'), 24);
    });

    testWidgets('widgets can read the tokens from the context', (tester) async {
      late SduiTokens found;
      await tester.pumpWidget(MaterialApp(
        theme: sduiThemeData(manifestTheme),
        home: Builder(builder: (context) {
          found = context.sduiTokens;
          return const SizedBox();
        }),
      ));
      expect(found.space('md'), 16);
    });

    testWidgets('falls back to default sizes when the app has no manifest theme', (tester) async {
      late SduiTokens found;
      await tester.pumpWidget(MaterialApp(
        home: Builder(builder: (context) {
          found = context.sduiTokens;
          return const SizedBox();
        }),
      ));
      expect(found.space('md'), 16);
    });
  });
}

import 'package:flutter/material.dart';

Color? _parseHexColor(Object? value) {
  if (value is! String || !RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(value)) return null;
  return Color(0xFF000000 | int.parse(value.substring(1), radix: 16));
}

Map<String, double> _numbers(Object? json) {
  if (json is! Map) return const {};
  return {
    for (final entry in json.entries)
      if (entry.key is String && entry.value is num) entry.key as String: (entry.value as num).toDouble(),
  };
}

/// The app's look: token names (like "md" or "primary") turned into real sizes and colours.
class SduiTokens {
  const SduiTokens({
    this.colors = const {},
    this.textSizes = const {},
    this.spacing = const {},
    this.radii = const {},
    this.bodyFont,
    this.headingFont,
  });

  final Map<String, Color> colors;
  final Map<String, double> textSizes;
  final Map<String, double> spacing;
  final Map<String, double> radii;
  final String? bodyFont;
  final String? headingFont;

  /// Used when the app has no manifest theme yet (for example on the first launch, offline).
  static const SduiTokens fallback = SduiTokens(
    textSizes: {'caption': 12, 'body': 14, 'title': 18, 'headline': 24, 'display': 32},
    spacing: {'none': 0, 'xs': 4, 'sm': 8, 'md': 16, 'lg': 24, 'xl': 32},
    radii: {'none': 0, 'sm': 4, 'md': 8, 'lg': 16, 'full': 999},
  );

  /// Reads the `theme` part of the manifest for the light or dark look.
  factory SduiTokens.fromManifestTheme(Map<String, dynamic> theme, {required Brightness brightness}) {
    final palette = theme[brightness == Brightness.dark ? 'dark' : 'light'];
    final colors = <String, Color>{};
    if (palette is Map) {
      for (final entry in palette.entries) {
        final color = _parseHexColor(entry.value);
        if (entry.key is String && color != null) colors[entry.key as String] = color;
      }
    }
    final fonts = theme['fonts'];
    return SduiTokens(
      colors: colors,
      textSizes: _numbers(theme['textSizes']),
      spacing: _numbers(theme['spacing']),
      radii: _numbers(theme['radii']),
      bodyFont: fonts is Map && fonts['body'] is String ? fonts['body'] as String : null,
      headingFont: fonts is Map && fonts['heading'] is String ? fonts['heading'] as String : null,
    );
  }

  // Each lookup takes `Object?` because values come straight from JSON. An unknown token gives null.
  Color? color(Object? token) => token is String ? colors[token] : null;
  double? textSize(Object? token) => token is String ? textSizes[token] : null;
  double? space(Object? token) => token is String ? spacing[token] : null;
  double? radius(Object? token) => token is String ? radii[token] : null;
}

/// Carries the tokens inside Flutter's [ThemeData], so every widget can find them.
class SduiThemeExtension extends ThemeExtension<SduiThemeExtension> {
  const SduiThemeExtension(this.tokens);

  final SduiTokens tokens;

  @override
  SduiThemeExtension copyWith({SduiTokens? tokens}) => SduiThemeExtension(tokens ?? this.tokens);

  @override
  SduiThemeExtension lerp(ThemeExtension<SduiThemeExtension>? other, double t) {
    if (other is! SduiThemeExtension) return this;
    return t < 0.5 ? this : other;
  }
}

/// Builds a [ThemeData] from the manifest's `theme`.
ThemeData sduiThemeData(Map<String, dynamic> manifestTheme, {Brightness brightness = Brightness.light}) {
  final tokens = SduiTokens.fromManifestTheme(manifestTheme, brightness: brightness);
  final colors = tokens.colors;
  // Start from a scheme made around the brand colour, then put the manifest's own colours on top.
  final scheme = ColorScheme.fromSeed(
    seedColor: colors['primary'] ?? Colors.blue,
    brightness: brightness,
  ).copyWith(
    primary: colors['primary'],
    onPrimary: colors['onPrimary'],
    secondary: colors['secondary'],
    onSecondary: colors['onSecondary'],
    error: colors['error'],
    surface: colors['surface'],
    onSurface: colors['onSurface'],
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: colors['background'],
    fontFamily: tokens.bodyFont,
    extensions: [SduiThemeExtension(tokens)],
  );
}

extension SduiThemeContext on BuildContext {
  /// The tokens of the current theme (or sensible sizes if the theme has none).
  SduiTokens get sduiTokens => Theme.of(this).extension<SduiThemeExtension>()?.tokens ?? SduiTokens.fallback;
}

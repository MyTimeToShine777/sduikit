import 'package:flutter/material.dart';

import 'model.dart';
import 'render.dart';
import 'theme.dart';

/// Readers for the options widgets share. Each takes a value straight from JSON (a name, a number or
/// nothing) and gives back the Flutter value, or a fallback when it is missing or not one we know.

/// Where something sits inside its space, by Flutter's own names ("topLeft", "center", "bottomRight"...).
Alignment sduiAlignment(Object? value, [Alignment fallback = Alignment.center]) => switch (value) {
      'topLeft' => Alignment.topLeft,
      'topCenter' => Alignment.topCenter,
      'topRight' => Alignment.topRight,
      'centerLeft' => Alignment.centerLeft,
      'center' => Alignment.center,
      'centerRight' => Alignment.centerRight,
      'bottomLeft' => Alignment.bottomLeft,
      'bottomCenter' => Alignment.bottomCenter,
      'bottomRight' => Alignment.bottomRight,
      _ => fallback,
    };

/// How a picture fills its box.
BoxFit sduiBoxFit(Object? value, [BoxFit fallback = BoxFit.cover]) => switch (value) {
      'contain' => BoxFit.contain,
      'cover' => BoxFit.cover,
      'fill' => BoxFit.fill,
      'fitWidth' => BoxFit.fitWidth,
      'fitHeight' => BoxFit.fitHeight,
      'none' => BoxFit.none,
      'scaleDown' => BoxFit.scaleDown,
      _ => fallback,
    };

ImageRepeat sduiRepeat(Object? value) => switch (value) {
      'repeat' => ImageRepeat.repeat,
      'repeatX' => ImageRepeat.repeatX,
      'repeatY' => ImageRepeat.repeatY,
      _ => ImageRepeat.noRepeat,
    };

MainAxisAlignment sduiMainAxis(Object? value, [MainAxisAlignment fallback = MainAxisAlignment.start]) => switch (value) {
      'start' => MainAxisAlignment.start,
      'end' => MainAxisAlignment.end,
      'center' => MainAxisAlignment.center,
      'spaceBetween' => MainAxisAlignment.spaceBetween,
      'spaceAround' => MainAxisAlignment.spaceAround,
      'spaceEvenly' => MainAxisAlignment.spaceEvenly,
      _ => fallback,
    };

CrossAxisAlignment sduiCrossAxis(Object? value, [CrossAxisAlignment fallback = CrossAxisAlignment.start]) => switch (value) {
      'start' => CrossAxisAlignment.start,
      'end' => CrossAxisAlignment.end,
      'center' => CrossAxisAlignment.center,
      'stretch' => CrossAxisAlignment.stretch,
      _ => fallback,
    };

WrapAlignment sduiWrapAlignment(Object? value) => switch (value) {
      'end' => WrapAlignment.end,
      'center' => WrapAlignment.center,
      'spaceBetween' => WrapAlignment.spaceBetween,
      'spaceAround' => WrapAlignment.spaceAround,
      'spaceEvenly' => WrapAlignment.spaceEvenly,
      _ => WrapAlignment.start,
    };

/// A plain number, or null.
double? sduiNumber(Object? value) => value is num ? value.toDouble() : null;

/// A size that is a name ("small", "medium", "large") or a number of pixels.
double sduiSized(Object? value, {required double small, required double medium, required double large}) {
  if (value is num) return value.toDouble();
  return switch (value) {
    'small' => small,
    'large' => large,
    _ => medium,
  };
}

/// Which way across the width something with this alignment leans: start, centre or end.
CrossAxisAlignment sduiCrossFor(Alignment alignment) =>
    alignment.x < 0 ? CrossAxisAlignment.start : (alignment.x > 0 ? CrossAxisAlignment.end : CrossAxisAlignment.center);

TextAlign sduiTextAlignFor(Alignment alignment) => alignment.x < 0 ? TextAlign.start : (alignment.x > 0 ? TextAlign.end : TextAlign.center);

// The dark layer over a picture (banner, hero), in the colour and strength the page asked for. With a colour
// given it is that colour at `overlayOpacity` (0.4 if not said); without one, a fade from clear to dark.
Widget sduiPictureOverlay(BuildContext context, SduiNode node, SduiRender render) {
  final color = context.sduiTokens.color(node.string('overlayColor'));
  final strength = node.number('overlayOpacity');
  final Widget layer = color != null
      ? ColoredBox(color: color.withValues(alpha: strength ?? 0.4))
      : DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black.withValues(alpha: strength ?? 0.55)],
            ),
          ),
        );
  return render.part(context, node, 'overlay', Positioned.fill(child: layer));
}

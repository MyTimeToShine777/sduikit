import 'package:flutter/material.dart';

/// Shown instead of a picture that cannot be loaded, so the layout does not jump.
class SduiImagePlaceholder extends StatelessWidget {
  const SduiImagePlaceholder({super.key, this.height = 120, this.color, this.text});

  final double height;
  final Color? color;
  final String? text;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      alignment: Alignment.center,
      color: color ?? Theme.of(context).colorScheme.surfaceContainerHighest,
      child: text == null ? const Icon(Icons.image_not_supported_outlined) : Text(text!, textAlign: TextAlign.center),
    );
  }
}

// Turns every colour into its grey equivalent.
const _grayscale = ColorFilter.matrix(<double>[
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0, 0, 0, 1, 0,
]);

/// A picture from the internet that falls back to [SduiImagePlaceholder] when it fails.
/// [alignment], [repeat] and [fit] say how it sits in its box; [placeholderColor] and [errorText] style the
/// box shown while it loads or when it cannot load; [grayscale] drains the colour.
Widget sduiNetworkImage(
  String url, {
  double? height,
  BoxFit fit = BoxFit.cover,
  String? description,
  Alignment alignment = Alignment.center,
  ImageRepeat repeat = ImageRepeat.noRepeat,
  bool grayscale = false,
  Color? placeholderColor,
  String? errorText,
  bool showLoader = false,
}) {
  Widget image = Image.network(
    url,
    height: height,
    width: double.infinity,
    fit: fit,
    alignment: alignment,
    repeat: repeat,
    semanticLabel: description,
    loadingBuilder: showLoader
        ? (context, child, progress) => progress == null
            ? child
            : Container(height: height ?? 120, color: placeholderColor ?? Theme.of(context).colorScheme.surfaceContainerHighest)
        : null,
    errorBuilder: (context, error, stackTrace) => SduiImagePlaceholder(height: height ?? 120, color: placeholderColor, text: errorText),
  );
  if (grayscale) image = ColorFiltered(colorFilter: _grayscale, child: image);
  return image;
}

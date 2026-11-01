import 'package:flutter/material.dart';

/// Shown instead of a picture that cannot be loaded, so the layout does not jump.
class SduiImagePlaceholder extends StatelessWidget {
  const SduiImagePlaceholder({super.key, this.height = 120});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      alignment: Alignment.center,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: const Icon(Icons.image_not_supported_outlined),
    );
  }
}

/// A picture from the internet that falls back to [SduiImagePlaceholder] when it fails.
Widget sduiNetworkImage(String url, {double? height, BoxFit fit = BoxFit.cover, String? description}) {
  return Image.network(
    url,
    height: height,
    width: double.infinity,
    fit: fit,
    semanticLabel: description,
    errorBuilder: (context, error, stackTrace) => SduiImagePlaceholder(height: height ?? 120),
  );
}

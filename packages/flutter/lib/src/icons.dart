import 'package:flutter/material.dart';

/// The icon names a page may use, matched to Flutter's built-in Material icons.
/// The list is the same one the schemas allow (see `tokens.icon` in the JavaScript package).
const Map<String, IconData> sduiIcons = {
  'home': Icons.home_outlined,
  'search': Icons.search,
  'calendar': Icons.calendar_today_outlined,
  'phone': Icons.phone_outlined,
  'chat': Icons.chat_bubble_outline,
  'location': Icons.location_on_outlined,
  'heart': Icons.favorite_border,
  'star': Icons.star_border,
  'info': Icons.info_outline,
  'bag': Icons.shopping_bag_outlined,
  'check': Icons.check,
  'close': Icons.close,
  'warning': Icons.warning_amber_outlined,
  'error': Icons.error_outline,
  'mail': Icons.mail_outline,
  'share': Icons.share_outlined,
  'download': Icons.download_outlined,
  'lock': Icons.lock_outline,
  'clock': Icons.schedule,
  'gift': Icons.card_giftcard_outlined,
  'cart': Icons.shopping_cart_outlined,
  'camera': Icons.camera_alt_outlined,
  'play': Icons.play_arrow,
  'link': Icons.link,
  'person': Icons.person_outline,
  'settings': Icons.settings_outlined,
  'payment': Icons.payments_outlined,
  'bell': Icons.notifications_outlined,
  'bookmark': Icons.bookmark_border,
  'help': Icons.help_outline,
};

/// The icon for a name from a page. An icon this version of the app does not know shows a
/// neutral square instead of failing.
IconData sduiIcon(Object? name) => name is String ? (sduiIcons[name] ?? Icons.apps) : Icons.apps;

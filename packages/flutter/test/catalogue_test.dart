import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:sduikit/sduikit.dart';

void main() {
  test('the app can draw exactly the widgets the format defines (schemas/catalogue.json)', () {
    final catalogue = jsonDecode(File('../../schemas/catalogue.json').readAsStringSync()) as Map<String, dynamic>;
    final expected = <String, List<int>>{
      for (final entry in (catalogue['types'] as Map<String, dynamic>).entries)
        entry.key: [for (final version in ((entry.value as Map)['versions'] as Map).keys) int.parse('$version')]..sort(),
    };
    final supported = SduiWidgetRegistry.withBuiltIns().supported;
    expect(supported.keys.toSet(), expected.keys.toSet());
    for (final type in expected.keys) {
      expect(supported[type], expected[type], reason: 'versions of $type');
    }
  });

  test('every icon name the schemas allow has an icon', () {
    final tokens = jsonDecode(File('../../schemas/common/tokens.json').readAsStringSync()) as Map<String, dynamic>;
    final names = [for (final name in ((tokens['\$defs'] as Map)['icon'] as Map)['enum'] as List) '$name'];
    expect(sduiIcons.keys.toSet(), names.toSet());
  });
}

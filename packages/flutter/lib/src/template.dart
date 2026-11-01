final _placeholder = RegExp(r'\{\{\s*([\w.]+)\s*\}\}');
final _wholePlaceholder = RegExp(r'^\{\{\s*([\w.]+)\s*\}\}$');

// Marks a value that the row does not have. Such entries are left out instead of being filled in.
const Object _missing = Object();

Object? _lookup(Map<String, dynamic> row, String path) {
  Object? current = row;
  for (final part in path.split('.')) {
    if (current is Map && current.containsKey(part)) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

Object? _fill(Object? json, Map<String, dynamic> row) {
  if (json is String) {
    final whole = _wholePlaceholder.firstMatch(json);
    if (whole != null) {
      // A text that is only a placeholder keeps the row's own type, so a number stays a number
      // (handy for ids in action params).
      return _lookup(row, whole.group(1)!) ?? _missing;
    }
    // A placeholder inside other text becomes plain text; a missing value becomes nothing.
    return json.replaceAllMapped(_placeholder, (match) => '${_lookup(row, match.group(1)!) ?? ''}');
  }
  if (json is List) {
    final filled = <Object?>[];
    for (final item in json) {
      final value = _fill(item, row);
      if (!identical(value, _missing)) filled.add(value);
    }
    return filled;
  }
  if (json is Map) {
    final filled = <String, dynamic>{};
    for (final entry in json.entries) {
      final value = _fill(entry.value, row);
      // A field whose only content was a placeholder the row cannot fill is dropped, not invented.
      if (!identical(value, _missing)) filled['${entry.key}'] = value;
    }
    return filled;
  }
  return json;
}

/// Fills every `{{field}}` in a data_list template with the values of one row.
/// `{{doctor.name}}` reads nested values. Nothing is ever made up: a field the row does not have
/// is left out (or becomes empty text inside a longer text), so a widget that needs it is skipped.
Object? fillTemplate(Object? template, Map<String, dynamic> row) {
  final result = _fill(template, row);
  return identical(result, _missing) ? null : result;
}

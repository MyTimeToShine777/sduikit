/// Parts that need `dart:io` (so they do not work in a web build). Import with
/// `import 'package:sduikit/io.dart';`.
library;

import 'dart:convert';
import 'dart:io';

import 'src/client.dart';

/// Keeps the last good copy of each page on the phone's disk, so the app can still show a page
/// after it was closed and reopened with no connection. Give it a folder your app owns, for
/// example one inside `getApplicationSupportDirectory()` from the `path_provider` package.
class FileSduiCache implements SduiCache {
  FileSduiCache(this.directory);

  final Directory directory;

  File _fileFor(String key) {
    // Keys look like "page:home"; keep only characters that are safe in a file name.
    final safe = key.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    return File('${directory.path}${Platform.pathSeparator}$safe.json');
  }

  @override
  Future<Map<String, dynamic>?> read(String key) async {
    final file = _fileFor(key);
    if (!await file.exists()) return null;
    try {
      final decoded = jsonDecode(await file.readAsString());
      return decoded is Map<String, dynamic> ? decoded : null;
    } on FormatException {
      return null; // a half-written or damaged file counts as "nothing saved"
    }
  }

  @override
  Future<void> write(String key, Map<String, dynamic> value) async {
    await directory.create(recursive: true);
    final target = _fileFor(key);
    // Write to a temporary file first, then rename it, so a crash never leaves a broken copy.
    final temporary = File('${target.path}.tmp');
    await temporary.writeAsString(jsonEncode(value), flush: true);
    await temporary.rename(target.path);
  }
}

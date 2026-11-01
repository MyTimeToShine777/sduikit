/// How the app asks the server for documents. You write this once for your own API;
/// the package does not know what your server looks like.
abstract class SduiClient {
  Future<Map<String, dynamic>> fetchPage(String id);
  Future<Map<String, dynamic>> fetchScreen(String id);
  Future<Map<String, dynamic>> fetchManifest();
}

/// Keeps the last good copy of each page, so the app can still show something when the
/// server is slow or unreachable. Use a saved-to-disk version in a real app
/// (for example one that stores the JSON with shared_preferences).
abstract class SduiCache {
  Future<Map<String, dynamic>?> read(String key);
  Future<void> write(String key, Map<String, dynamic> value);
}

/// A cache that lives only until the app closes. Good for tests and demos.
class MemorySduiCache implements SduiCache {
  final Map<String, Map<String, dynamic>> _saved = {};

  @override
  Future<Map<String, dynamic>?> read(String key) async => _saved[key];

  @override
  Future<void> write(String key, Map<String, dynamic> value) async {
    _saved[key] = value;
  }
}

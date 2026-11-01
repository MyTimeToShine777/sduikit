export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Documents are plain JSON, so a JSON round trip is a safe way to copy them.
export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

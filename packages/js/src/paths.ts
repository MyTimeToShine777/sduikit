// Turns an Ajv path such as "/sections/0/widgets/1" into "sections[0].widgets[1]".
export function pointerToPath(pointer: string): string {
  let path = "";
  for (const part of pointer.split("/").slice(1)) {
    const name = part.replace(/~1/g, "/").replace(/~0/g, "~");
    if (/^\d+$/.test(name)) path += `[${name}]`;
    else path += path === "" ? name : `.${name}`;
  }
  return path;
}

// Joins two path pieces: ("a.b", "c") -> "a.b.c", ("a", "[0]") -> "a[0]", ("", "c") -> "c".
export function appendPath(base: string, addition: string): string {
  if (addition === "") return base;
  if (base === "") return addition;
  return addition.startsWith("[") ? base + addition : `${base}.${addition}`;
}

// Reads "1.2.0", "1.2.0+45" or "1.2.0-beta" as three numbers. Anything after the third number is ignored.
export function parseVersion(text: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(text);
  if (!match) throw new Error(`"${text}" is not a version like 1.2.0`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Negative if a is older than b, zero if the same, positive if a is newer.
export function compareVersions(a: string, b: string): number {
  const first = parseVersion(a);
  const second = parseVersion(b);
  for (let index = 0; index < 3; index++) {
    if (first[index] !== second[index]) return first[index] < second[index] ? -1 : 1;
  }
  return 0;
}

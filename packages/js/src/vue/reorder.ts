// Small helpers for a dashboard that lets staff drag widgets up and down.
// Each one returns a new list and leaves the original alone.

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  const inRange = (index: number) => Number.isInteger(index) && index >= 0 && index < copy.length;
  if (!inRange(from) || !inRange(to) || from === to) return copy;
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

export function removeItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index);
}

// Puts `item` at `index`. An index past the end adds it to the end.
export function insertItem<T>(items: readonly T[], index: number, item: T): T[] {
  const copy = [...items];
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, item);
  return copy;
}

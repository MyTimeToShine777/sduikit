import { findPointerById, getAt } from "../pointers.js";

// What the phone preview needs to be used like a design tool: click a widget to select it, drag it to a new
// place, double-click its text to retype it. It works on the drawn page (using the `data-id` every widget
// element carries), so every widget gets it without each one needing special code.

export interface CanvasEvents {
  select: (id: string | null) => void;
  /** Staff retyped some text in place. `path` is where that text lives inside the widget, like ["data", "title"]. */
  edit: (change: { id: string; path: Array<string | number>; value: string }) => void;
  /** Staff dropped a widget just before or after another one. */
  move: (change: { id: string; targetId: string; where: "before" | "after" }) => void;
}

// Makes an id safe to put inside [data-id="..."].
export const quoteId = (id: string) => id.replace(/["\\]/g, "\\$&");

const idOf = (element: Element | null): string | null => element?.closest("[data-id]")?.getAttribute("data-id") ?? null;

// Finds the text a person is looking at inside the widget's data, so we know which field they are retyping.
// Only exact matches count; text that was worked out by the app (a price total, a list number) is not editable.
export function findTextPath(widget: unknown, shown: string): Array<string | number> | undefined {
  const wanted = shown.trim();
  if (!wanted) return undefined;
  const search = (value: unknown, path: Array<string | number>): Array<string | number> | undefined => {
    if (typeof value === "string") return value.trim() === wanted ? path : undefined;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const hit = search(value[index], [...path, index]);
        if (hit) return hit;
      }
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (key === "id" || key === "type" || key === "action" || key === "style" || key === "rules" || key === "analytics") continue;
        const hit = search(item, [...path, key]);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  return search((widget as any)?.data, ["data"]);
}

export function attachCanvasEditing(
  root: HTMLElement,
  getDocument: () => unknown,
  events: CanvasEvents,
): () => void {
  let dragging: string | null = null;
  let dropTarget: Element | null = null;
  let editing: HTMLElement | null = null;

  const clearDropMarks = () => {
    root.querySelectorAll(".sp-drop-before, .sp-drop-after").forEach((el) => el.classList.remove("sp-drop-before", "sp-drop-after"));
    dropTarget = null;
  };

  const onClick = (event: MouseEvent) => {
    if (editing) return;
    // A tap in the preview selects; it must not follow links or press buttons.
    event.preventDefault();
    events.select(idOf(event.target as Element));
  };

  const onDblClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const id = idOf(target);
    if (!id || editing) return;
    const pointer = findPointerById(getDocument(), id);
    if (!pointer) return;
    const path = findTextPath(getAt(getDocument(), pointer), target.textContent ?? "");
    if (!path) return;

    const before = target.textContent ?? "";
    editing = target;
    target.setAttribute("contenteditable", "plaintext-only");
    target.setAttribute("draggable", "false");
    target.classList.add("sp-editing");
    target.focus();
    getSelection()?.selectAllChildren(target);

    const finish = (save: boolean) => {
      if (editing !== target) return;
      editing = null;
      target.removeAttribute("contenteditable");
      target.classList.remove("sp-editing");
      target.removeEventListener("blur", onBlur);
      target.removeEventListener("keydown", onKey);
      const value = (target.textContent ?? "").replace(/\s+$/, "");
      target.setAttribute("draggable", "true");
      if (save && value !== before.trim() && value !== "") events.edit({ id, path, value });
      else target.textContent = before; // cancelled, or nothing changed: put the drawn text back
    };
    const onBlur = () => finish(true);
    const onKey = (key: KeyboardEvent) => {
      if (key.key === "Enter" && !key.shiftKey) {
        key.preventDefault();
        finish(true);
      } else if (key.key === "Escape") {
        key.preventDefault();
        finish(false);
      }
      key.stopPropagation();
    };
    target.addEventListener("blur", onBlur);
    target.addEventListener("keydown", onKey);
  };

  const onDragStart = (event: DragEvent) => {
    const id = idOf(event.target as Element);
    if (!id || editing) return event.preventDefault();
    dragging = id;
    event.dataTransfer?.setData("text/plain", id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    (event.target as HTMLElement).classList.add("sp-dragging");
  };

  const onDragOver = (event: DragEvent) => {
    if (!dragging) return;
    const element = (event.target as Element).closest("[data-id]");
    if (!element || element.getAttribute("data-id") === dragging || element.closest(`[data-id="${quoteId(dragging)}"]`)) {
      clearDropMarks();
      return;
    }
    event.preventDefault();
    const box = element.getBoundingClientRect();
    const where = event.clientY < box.top + box.height / 2 ? "before" : "after";
    if (dropTarget !== element) clearDropMarks();
    dropTarget = element;
    element.classList.toggle("sp-drop-before", where === "before");
    element.classList.toggle("sp-drop-after", where === "after");
  };

  const onDrop = (event: DragEvent) => {
    if (!dragging || !dropTarget) return;
    event.preventDefault();
    const targetId = dropTarget.getAttribute("data-id")!;
    const where = dropTarget.classList.contains("sp-drop-after") ? "after" : "before";
    const id = dragging;
    clearDropMarks();
    dragging = null;
    events.move({ id, targetId, where });
  };

  const onDragEnd = () => {
    root.querySelectorAll(".sp-dragging").forEach((el) => el.classList.remove("sp-dragging"));
    clearDropMarks();
    dragging = null;
  };

  root.addEventListener("click", onClick);
  root.addEventListener("dblclick", onDblClick);
  root.addEventListener("dragstart", onDragStart);
  root.addEventListener("dragover", onDragOver);
  root.addEventListener("drop", onDrop);
  root.addEventListener("dragend", onDragEnd);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("dblclick", onDblClick);
    root.removeEventListener("dragstart", onDragStart);
    root.removeEventListener("dragover", onDragOver);
    root.removeEventListener("drop", onDrop);
    root.removeEventListener("dragend", onDragEnd);
  };
}

/** Marks every widget element as draggable (the page is redrawn often, so this runs after each draw). */
export function markDraggable(root: HTMLElement, on: boolean): void {
  root.querySelectorAll("[data-id]").forEach((el) => {
    if (el.getAttribute("contenteditable")) return;
    if (on) el.setAttribute("draggable", "true");
    else el.removeAttribute("draggable");
  });
}

import { describe, expect, it } from "vitest";
import { appendPath, pointerToPath } from "../src/paths";

describe("pointerToPath", () => {
  it("turns an Ajv path into a readable one", () => {
    expect(pointerToPath("/sections/0/widgets/1/data")).toBe("sections[0].widgets[1].data");
  });
  it("gives an empty path for the whole document", () => expect(pointerToPath("")).toBe(""));
  it("starts with an index when the document is a list", () => expect(pointerToPath("/0/name")).toBe("[0].name"));
});

describe("appendPath", () => {
  it("joins with a dot", () => expect(appendPath("a.b", "c")).toBe("a.b.c"));
  it("joins an index without a dot", () => expect(appendPath("a", "[0]")).toBe("a[0]"));
  it("ignores empty pieces", () => {
    expect(appendPath("", "c")).toBe("c");
    expect(appendPath("a", "")).toBe("a");
  });
});

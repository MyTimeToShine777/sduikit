import { describe, expect, it } from "vitest";
import { tokens } from "../src/index";

describe("tokens", () => {
  it("lists the token names the schemas allow", () => {
    expect(tokens.spacing).toEqual(["none", "xs", "sm", "md", "lg", "xl"]);
    expect(tokens.radius).toEqual(["none", "sm", "md", "lg", "full"]);
    expect(tokens.textSize).toEqual(["caption", "body", "title", "headline", "display"]);
    expect(tokens.align).toEqual(["start", "center", "end"]);
    expect(tokens.color).toHaveLength(12);
    expect(tokens.color).toContain("onPrimary");
  });
});

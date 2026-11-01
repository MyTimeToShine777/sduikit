import { schemaFiles } from "./generated/schemas.js";

interface TokenFile {
  $defs: Record<"spacing" | "radius" | "color" | "textSize" | "align", { enum: string[] }>;
}

const definitions = (schemaFiles["common/tokens.json"] as TokenFile).$defs;

// The token names a widget's `style` may use. Read from the schema so the two can never disagree.
// A dashboard can use these lists to build dropdowns.
export const tokens = {
  spacing: definitions.spacing.enum,
  radius: definitions.radius.enum,
  color: definitions.color.enum,
  textSize: definitions.textSize.enum,
  align: definitions.align.enum,
};

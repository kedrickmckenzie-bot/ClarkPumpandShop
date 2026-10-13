import { z } from "zod/v4";
import type { AiClient } from "./ai";
import { refrigerantInfo } from "./refrigerant";

/** What the AI may read from an equipment tag. Empty strings and null mean "not on the tag or not readable". */
export const equipmentTagSchema = z.object({
  refrigerant: z.string(),
  /** Factory charge converted to pounds, or null when the tag doesn't show it. */
  chargePounds: z.number().nullable(),
  manufacturer: z.string(),
  model: z.string(),
  serial: z.string(),
  /** How sure the reading is: low when the photo is blurry, cut off or glared. */
  confidence: z.enum(["high", "low"]),
});

const TAG_SYSTEM = `You read the data tag (nameplate) on commercial refrigeration and air conditioning equipment from a photo.

Rules:
- Copy only what is printed on the tag. Never guess or fill in from the model number. Leave a field empty ("" or null) if it isn't on the tag or you can't read it.
- refrigerant: the refrigerant type as printed, like "R-404A" or "R-410A".
- chargePounds: the factory refrigerant charge converted to pounds (16 oz = 1 lb, 1 kg = 2.2046 lb). If the tag shows separate charges per circuit, add them. Null if not shown.
- manufacturer, model, serial: exactly as printed.
- confidence: "low" if the photo is blurry, glared, cut off, or anything was hard to read.`;

export interface TagReading {
  refrigerant?: string;
  chargeLb?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  lowConfidence: boolean;
  /** The tag's refrigerant as printed, when it isn't one we recognize. */
  unrecognized?: string;
}

/** Reads one tag photo. The person always checks the result before anything is saved. */
export async function readEquipmentTag(ai: AiClient, image: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string }): Promise<TagReading> {
  const raw = await ai.json({ system: TAG_SYSTEM, prompt: "Read this equipment tag.", schema: equipmentTagSchema, images: [image], tier: "fast", effort: "low", maxTokens: 800 });
  const printed = raw.refrigerant.trim().toUpperCase().replace(/\s+/gu, "");
  const code = printed ? refrigerantInfo(printed.startsWith("R") ? printed.replace(/^R-?/u, "R-") : `R-${printed}`)?.code : undefined;
  const pounds = raw.chargePounds !== null && Number.isFinite(raw.chargePounds) && raw.chargePounds > 0 && raw.chargePounds < 5000 ? Math.round(raw.chargePounds * 10) / 10 : undefined;
  const clip = (value: string) => value.trim().slice(0, 80) || undefined;
  return {
    refrigerant: code,
    unrecognized: printed && !code ? raw.refrigerant.trim().slice(0, 20) : undefined,
    chargeLb: pounds === undefined ? undefined : String(pounds),
    manufacturer: clip(raw.manufacturer),
    model: clip(raw.model),
    serial: clip(raw.serial),
    lowConfidence: raw.confidence === "low",
  };
}

import { z } from "zod";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidHttpUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

export const redirectFormSchema = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, "Use 1–64 lowercase letters, numbers or hyphens (no leading/trailing hyphen)"),
  destination_url: z
    .string()
    .trim()
    .refine(isValidHttpUrl, "Must be a valid http:// or https:// URL"),
  notes: z.string().trim().max(2000).optional().default(""),
});

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

export function deviceCategory(ua: string | null | undefined): "mobile" | "tablet" | "desktop" | "bot" | "unknown" {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/bot|crawler|spider|preview|facebookexternalhit|slurp/.test(s)) return "bot";
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/.test(s)) return "mobile";
  if (/windows|macintosh|linux|cros/.test(s)) return "desktop";
  return "unknown";
}

/** Only the referrer host is kept — no path, query or other personal data. */
export function referrerHost(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).hostname || null;
  } catch {
    return null;
  }
}

export function permanentUrl(base: string, slug: string): string {
  return `${base.replace(/\/+$/, "")}/r/${slug}`;
}

import { describe, it, expect } from "vitest";
import { isValidHttpUrl, redirectFormSchema, deviceCategory, referrerHost, permanentUrl } from "./redirect-utils";

describe("redirect rules", () => {
  it("accepts only http/https destinations", () => {
    expect(isValidHttpUrl("https://www.google.com/")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
  });
  it("rejects invalid slugs", () => {
    const base = { client_name: "A", destination_url: "https://a.com" };
    expect(redirectFormSchema.safeParse({ ...base, slug: "demo" }).success).toBe(true);
    expect(redirectFormSchema.safeParse({ ...base, slug: "-bad" }).success).toBe(false);
    expect(redirectFormSchema.safeParse({ ...base, slug: "a/b" }).success).toBe(false);
  });
  it("permanent URL encodes only the slug path", () => {
    expect(permanentUrl("https://x.app/", "demo")).toBe("https://x.app/r/demo");
  });
  it("categorises devices and strips referrer to host", () => {
    expect(deviceCategory("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile")).toBe("mobile");
    expect(deviceCategory("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(referrerHost("https://www.instagram.com/p/abc?u=1")).toBe("www.instagram.com");
  });
});

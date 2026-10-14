import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SLUG_RE, deviceCategory, referrerHost, isValidHttpUrl } from "@/lib/redirect-utils";

function notFoundPage(slug: string) {
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link unavailable · DevCrafted</title><meta name="robots" content="noindex"></head><body style="font-family:system-ui;background:#0b1220;color:#e6edf5;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center;padding:24px"><h1 style="margin:0 0 8px">Link unavailable</h1><p style="opacity:.7">The link “${safe}” is inactive or does not exist.</p></div></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/r/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = String(params.slug || "").toLowerCase();
        if (!SLUG_RE.test(slug)) return notFoundPage(slug);

        // Hosts other than Lovable (e.g. Netlify) don't inject server env vars, so fall back
        // to the public build-time values (publishable key is safe to expose).
        const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) {
          console.error("Redirect backend config missing");
          return new Response("Temporarily unavailable", { status: 503, headers: { "cache-control": "no-store" } });
        }
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data, error } = await supabase.rpc("resolve_redirect", {
          _slug: slug,
          _device: deviceCategory(request.headers.get("user-agent")),
          _referrer_host: referrerHost(request.headers.get("referer")) ?? "",
        });
        if (error) {
          console.error("resolve_redirect failed", error.message);
          return new Response("Temporarily unavailable", { status: 503, headers: { "cache-control": "no-store" } });
        }
        if (!data || !isValidHttpUrl(data)) return notFoundPage(slug);

        // 302 + no-store so destination changes take effect immediately for every QR/NFC scan.
        return new Response(null, {
          status: 302,
          headers: { Location: data, "cache-control": "no-store", "referrer-policy": "no-referrer" },
        });
      },
    },
  },
});

import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, Nfc, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DevCrafted — Dynamic QR & NFC Redirect Manager" },
      { name: "description", content: "Print once, update forever. Permanent QR and NFC links whose destination you can change anytime." },
      { property: "og:title", content: "DevCrafted — Dynamic QR & NFC Redirect Manager" },
      { property: "og:description", content: "Permanent QR and NFC links whose destination you can change anytime." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: QrCode, title: "Permanent QR codes", text: "Each code encodes one fixed /r/slug link. Re-point it whenever you like." },
  { icon: Nfc, title: "NFC-ready", text: "Write the same permanent URL to tags once — no rewriting ever." },
  { icon: BarChart3, title: "Privacy-light analytics", text: "Scan time, device type and referring site. Nothing personal." },
  { icon: ShieldCheck, title: "Secure admin", text: "Only authorised admins can create or change redirects." },
];

function Index() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold">
          Dev<span className="text-brand">Crafted</span>
        </span>
        <Button asChild variant="outline" size="sm"><Link to="/admin">Admin sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <p className="mb-4 inline-block rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">/r/your-slug → anywhere</p>
        <h1 className="text-4xl font-bold sm:text-6xl">Print once. <span className="text-brand">Redirect forever.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Dynamic QR and NFC redirects for your clients' review pages, menus and campaigns. Change the destination without reprinting.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/admin">Open dashboard</Link></Button>
          <Button asChild size="lg" variant="outline"><a href="/r/demo">Try the demo link</a></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-5 shadow-card">
            <f.icon className="mb-3 size-5 text-primary" />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

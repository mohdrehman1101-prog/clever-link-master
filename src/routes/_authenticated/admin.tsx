import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Copy, ExternalLink, QrCode, Pencil, Trash2, BarChart3, LogOut, Link2, AlertTriangle, Loader2, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { redirectFormSchema, permanentUrl, slugify } from "@/lib/redirect-utils";
import { qrPngDataUrl, qrSvg, downloadFile } from "@/lib/qr";

type Redirect = Tables<"redirects">;
type Click = Tables<"redirect_clicks">;

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Dashboard — DevCrafted Redirects" },
      { name: "description", content: "Manage dynamic QR and NFC redirects." },
      { property: "og:title", content: "Dashboard — DevCrafted Redirects" },
      { property: "og:description", content: "Manage dynamic QR and NFC redirects." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function baseUrl() {
  const env = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  return env && /^https?:\/\//.test(env) ? env : window.location.origin;
}

function AdminPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const roleQ = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="font-display text-lg font-semibold">Dev<span className="text-brand">Crafted</span> <span className="text-sm font-normal text-muted-foreground">Redirects</span></span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut /> Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {roleQ.isLoading ? (
          <ListSkeleton />
        ) : roleQ.isError ? (
          <ErrorState message="Couldn't verify your access." onRetry={() => roleQ.refetch()} />
        ) : !roleQ.data ? (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
            <Lock className="mx-auto mb-3 size-8 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No admin access</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your account is signed in but hasn't been granted admin rights. Ask an existing DevCrafted admin to grant access.</p>
          </div>
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Redirect | "new" | null>(null);
  const [qrFor, setQrFor] = useState<Redirect | null>(null);
  const [statsFor, setStatsFor] = useState<Redirect | null>(null);
  const [deleting, setDeleting] = useState<Redirect | null>(null);

  const listQ = useQuery({
    queryKey: ["redirects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("redirects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const countsQ = useQuery({
    queryKey: ["click-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("redirect_clicks").select("redirect_id").limit(10000);
      if (error) throw error;
      const m: Record<string, number> = {};
      for (const r of data) m[r.redirect_id] = (m[r.redirect_id] ?? 0) + 1;
      return m;
    },
  });

  const toggle = useMutation({
    mutationFn: async (r: Redirect) => {
      const { error } = await supabase.from("redirects").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["redirects"] }),
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (r: Redirect) => {
      const { error } = await supabase.from("redirects").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Redirect deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["redirects"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => {
      if (status === "active" && !r.is_active) return false;
      if (status === "inactive" && r.is_active) return false;
      if (!q) return true;
      return [r.client_name, r.slug, r.destination_url, r.notes ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [listQ.data, search, status]);

  const total = listQ.data?.length ?? 0;
  const active = listQ.data?.filter((r) => r.is_active).length ?? 0;
  const clicks = Object.values(countsQ.data ?? {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Redirects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Permanent QR & NFC links. Change destinations anytime — the link never changes.</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus /> New redirect</Button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Redirects" value={total} />
        <Stat label="Active" value={active} />
        <Stat label="Total scans" value={clicks} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search client, slug, URL or notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        {listQ.isLoading ? (
          <ListSkeleton />
        ) : listQ.isError ? (
          <ErrorState message="Couldn't load redirects." onRetry={() => listQ.refetch()} />
        ) : total === 0 ? (
          <Empty title="No redirects yet" text="Create your first permanent link to generate a QR code." action={<Button onClick={() => setEditing("new")}><Plus /> New redirect</Button>} />
        ) : filtered.length === 0 ? (
          <Empty title="No matches" text="Try a different search or status filter." />
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => (
              <RedirectRow
                key={r.id}
                r={r}
                clicks={countsQ.data?.[r.id] ?? 0}
                onEdit={() => setEditing(r)}
                onQr={() => setQrFor(r)}
                onStats={() => setStatsFor(r)}
                onDelete={() => setDeleting(r)}
                onToggle={() => toggle.mutate(r)}
              />
            ))}
          </ul>
        )}
      </div>

      {editing && <EditDialog initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {qrFor && <QrDialog r={qrFor} onClose={() => setQrFor(null)} />}
      {statsFor && <StatsDialog r={statsFor} onClose={() => setStatsFor(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.client_name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Printed QR codes and NFC tags for <span className="font-mono">/r/{deleting?.slug}</span> will stop working, and its scan history is removed. Consider deactivating instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); if (deleting) del.mutate(deleting); }}>
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function RedirectRow({ r, clicks, onEdit, onQr, onStats, onDelete, onToggle }: {
  r: Redirect; clicks: number; onEdit: () => void; onQr: () => void; onStats: () => void; onDelete: () => void; onToggle: () => void;
}) {
  const url = permanentUrl(baseUrl(), r.slug);
  return (
    <li className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{r.client_name}</h3>
            {r.is_demo && <Badge variant="outline" className="border-warning text-warning">DEMO · testing only</Badge>}
            <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge>
          </div>
          <div className="mt-2 flex items-center gap-2 font-mono text-sm">
            <Link2 className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{url}</span>
            <button aria-label="Copy permanent URL" className="text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(url); toast.success("Permanent URL copied"); }}>
              <Copy className="size-3.5" />
            </button>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">→ {r.destination_url}</p>
          {r.notes && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{r.notes}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            {clicks.toLocaleString()} scans · Created {new Date(r.created_at).toLocaleDateString()} · Updated {new Date(r.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={r.is_active} onCheckedChange={onToggle} aria-label="Active" /> Active
          </label>
          <Button size="sm" variant="secondary" onClick={onQr}><QrCode /> QR</Button>
          <Button size="sm" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Test</a></Button>
          <Button size="icon" variant="ghost" onClick={onStats} aria-label="Analytics"><BarChart3 /></Button>
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit"><Pencil /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete" className="text-destructive hover:text-destructive"><Trash2 /></Button>
        </div>
      </div>
    </li>
  );
}

function EditDialog({ initial, onClose }: { initial: Redirect | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    client_name: initial?.client_name ?? "",
    slug: initial?.slug ?? "",
    destination_url: initial?.destination_url ?? "",
    notes: initial?.notes ?? "",
  });
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async () => {
      const parsed = redirectFormSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
        setErrors(errs);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});
      const v = parsed.data;
      if (initial) {
        const { error } = await supabase.from("redirects").update({
          client_name: v.client_name, destination_url: v.destination_url, notes: v.notes || null,
        }).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("redirects").insert({
          client_name: v.client_name, slug: v.slug, destination_url: v.destination_url, notes: v.notes || null,
        });
        if (error) {
          if (error.code === "23505") { setErrors({ slug: "This slug is already taken" }); throw new Error("Slug already in use"); }
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Destination updated — QR & NFC unchanged" : "Redirect created");
      qc.invalidateQueries({ queryKey: ["redirects"] });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit redirect" : "New redirect"}</DialogTitle>
          <DialogDescription>
            {initial ? "The slug is permanent. Changing the destination never affects printed QR codes or NFC tags." : "Choose the slug carefully — it can't be changed after creation."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Client / business name" error={errors.client_name}>
            <Input value={form.client_name} maxLength={200} onChange={(e) => {
              const client_name = e.target.value;
              setForm((f) => ({ ...f, client_name, slug: slugTouched ? f.slug : slugify(client_name) }));
            }} />
          </Field>
          <Field label="Slug (permanent)" error={errors.slug} hint={`${baseUrl()}/r/${form.slug || "your-slug"}`}>
            <Input value={form.slug} disabled={!!initial} className="font-mono" maxLength={64} onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() })); }} />
          </Field>
          <Field label="Destination URL" error={errors.destination_url} hint="Paste any http(s) link, e.g. a Google Review URL.">
            <Input type="url" value={form.destination_url} placeholder="https://" onChange={(e) => setForm((f) => ({ ...f, destination_url: e.target.value }))} />
          </Field>
          <Field label="Notes" error={errors.notes}>
            <Textarea value={form.notes} maxLength={2000} rows={3} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />}{initial ? "Save changes" : "Create redirect"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="truncate font-mono text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function QrDialog({ r, onClose }: { r: Redirect; onClose: () => void }) {
  const url = permanentUrl(baseUrl(), r.slug);
  const [png, setPng] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { qrPngDataUrl(url).then(setPng).catch(() => setErr(true)); }, [url]);

  async function dlSvg() {
    const svg = await qrSvg(url);
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    downloadFile(blobUrl, `qr-${r.slug}.svg`);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR & NFC — {r.client_name}</DialogTitle>
          <DialogDescription>Encode this permanent URL only. It never changes when you edit the destination.</DialogDescription>
        </DialogHeader>
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border bg-foreground p-2">
          {err ? <p className="text-sm text-destructive">Couldn't generate QR code.</p> : png ? <img src={png} alt={`QR code for ${url}`} className="h-full w-full" /> : <Loader2 className="animate-spin text-background" />}
        </div>
        <div className="rounded-lg border bg-muted p-3">
          <div className="text-xs text-muted-foreground">NFC tag value (URI record)</div>
          <div className="mt-1 flex items-center gap-2 font-mono text-sm">
            <span className="flex-1 break-all">{url}</span>
            <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }} aria-label="Copy"><Copy /></Button>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Test redirect</a></Button>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!png} onClick={() => png && downloadFile(png, `qr-${r.slug}.png`)}>PNG</Button>
            <Button onClick={dlSvg}>SVG</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatsDialog({ r, onClose }: { r: Redirect; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["clicks", r.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("redirect_clicks").select("*").eq("redirect_id", r.id).order("clicked_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as Click[];
    },
  });
  const summary = useMemo(() => {
    const d = q.data ?? [];
    const now = Date.now();
    const by = (k: (c: Click) => string) => {
      const m: Record<string, number> = {};
      for (const c of d) m[k(c)] = (m[k(c)] ?? 0) + 1;
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    return {
      total: d.length,
      last7: d.filter((c) => now - new Date(c.clicked_at).getTime() < 7 * 864e5).length,
      devices: by((c) => c.device),
      referrers: by((c) => c.referrer_host ?? "Direct / scan").slice(0, 5),
    };
  }, [q.data]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Analytics — {r.client_name}</DialogTitle>
          <DialogDescription>Scan time, device type and referring site only. No IPs or personal data stored.</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message="Couldn't load analytics." onRetry={() => q.refetch()} /> : summary.total === 0 ? (
          <Empty title="No scans yet" text="Scans will appear here once someone uses the QR code or NFC tag." />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3"><Stat label="Total (latest 1000)" value={summary.total} /><Stat label="Last 7 days" value={summary.last7} /></div>
            <Breakdown title="Devices" rows={summary.devices} total={summary.total} />
            <Breakdown title="Top referrers" rows={summary.referrers} total={summary.total} />
            <div>
              <h4 className="mb-2 text-sm font-semibold">Recent scans</h4>
              <ul className="divide-y rounded-lg border text-sm">
                {(q.data ?? []).slice(0, 10).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 px-3 py-2">
                    <span className="text-muted-foreground">{new Date(c.clicked_at).toLocaleString()}</span>
                    <span className="capitalize">{c.device}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs"><span className="capitalize">{k}</span><span className="text-muted-foreground">{v}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / total) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-card p-6 text-center">
      <AlertTriangle className="mx-auto mb-2 size-6 text-destructive" />
      <p className="text-sm">{message}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>Try again</Button>
    </div>
  );
}

function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <QrCode className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin sign in — DevCrafted Redirects" },
      { name: "description", content: "Sign in to manage DevCrafted QR and NFC redirects." },
      { property: "og:title", content: "Admin sign in — DevCrafted Redirects" },
      { property: "og:description", content: "Sign in to manage DevCrafted QR and NFC redirects." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/admin", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/admin", replace: true });
        else toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-8 shadow-card">
        <div>
          <span className="font-display text-lg font-semibold">Dev<span className="text-brand">Crafted</span></span>
          <h1 className="mt-4 text-2xl font-semibold">{mode === "signin" ? "Admin sign in" : "Create admin account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Manage your QR and NFC redirects." : "The first account becomes the admin. Later accounts need admin approval."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
        <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}

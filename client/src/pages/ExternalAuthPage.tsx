import { useState } from "react";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { AppMark } from "@/components/AppMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { isExternalRuntime } from "@/lib/externalRuntime";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function ExternalAuthPage({ mode }: { mode: "signin" | "signup" }) {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const isSignUp = mode === "signup";

  const signInSchema = z.object({
    email: z.string().trim().email(t("auth.invalidEmail")),
    password: z.string().min(8, t("auth.passwordLength")),
  });
  const signUpSchema = signInSchema.extend({ name: z.string().trim().min(2, t("auth.nameLength")).max(80) });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    if (!isExternalRuntime) {
      setError(t("auth.runtimeError"));
      return;
    }

    const parsed = (isSignUp ? signUpSchema : signInSchema).safeParse(isSignUp ? { email, password, name } : { email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("auth.invalidData"));
      return;
    }

    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      if (isSignUp) {
        const result = await client.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { data: { name }, emailRedirectTo: `${window.location.origin}/auth/signin` },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          setLocation("/dashboard");
          return;
        }
        setMessage(t("auth.verifyEmail"));
        return;
      }

      const result = await client.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
      if (result.error) throw result.error;
      setLocation("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("auth.requestError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-svh bg-[#fcfcfd] p-5 text-slate-950 dark:bg-[#090a0f] dark:text-white sm:p-8">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center">
        <div className="flex items-center justify-between gap-3"><AppMark href="/" /><LanguageToggle /></div>
        <section className="mt-10 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Portfolio Pro</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.055em]">{isSignUp ? t("auth.signupTitle") : t("auth.signinTitle")}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{isSignUp ? t("auth.signupDescription") : t("auth.signinDescription")}</p>
          <form className="mt-7 space-y-4" noValidate onSubmit={submit}>
            {isSignUp ? <div><Label htmlFor="auth-name">{t("auth.name")}</Label><Input autoComplete="name" className="mt-2 h-11 rounded-xl" id="auth-name" onChange={(event) => setName(event.target.value)} required value={name} /></div> : null}
            <div><Label htmlFor="auth-email">{t("auth.email")}</Label><Input autoComplete="email" className="mt-2 h-11 rounded-xl" id="auth-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></div>
            <div><Label htmlFor="auth-password">{t("auth.password")}</Label><Input autoComplete={isSignUp ? "new-password" : "current-password"} className="mt-2 h-11 rounded-xl" id="auth-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></div>
            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
            {message ? <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:bg-violet-400/10 dark:text-violet-100" role="status">{message}</p> : null}
            <Button className="mt-2 h-11 w-full rounded-full bg-violet-700 text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400" disabled={busy} type="submit">{busy ? t("auth.wait") : isSignUp ? t("auth.signup") : t("auth.signin")}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{isSignUp ? t("auth.hasAccount") : t("auth.noAccount")} {" "}<Link className="font-semibold text-violet-700 hover:underline dark:text-violet-300" href={isSignUp ? "/auth/signin" : "/auth/signup"}>{isSignUp ? t("auth.signin") : t("auth.signup")}</Link></p>
        </section>
      </div>
    </main>
  );
}

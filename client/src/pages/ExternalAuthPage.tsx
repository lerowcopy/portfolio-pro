import { z } from "zod";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AppMark } from "@/components/AppMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { isExternalRuntime } from "@/lib/externalRuntime";

const signInSchema = z.object({ email: z.string().trim().email("Введите корректный email."), password: z.string().min(8, "Пароль должен содержать минимум 8 символов.") });
const signUpSchema = signInSchema.extend({ name: z.string().trim().min(2, "Введите имя минимум из 2 символов.").max(80) });

export default function ExternalAuthPage({ mode }: { mode: "signin" | "signup" }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const isSignUp = mode === "signup";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    if (!isExternalRuntime) {
      setError("Эта форма доступна только во внешнем Supabase runtime.");
      return;
    }

    const parsed = (isSignUp ? signUpSchema : signInSchema).safeParse(isSignUp ? { email, password, name } : { email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Проверьте введённые данные.");
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
        setMessage("Проверьте почту и подтвердите адрес, затем войдите в Portfolio Pro.");
        return;
      }

      const result = await client.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
      if (result.error) throw result.error;
      setLocation("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось завершить аутентификацию.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-svh bg-[#fcfcfd] p-5 text-slate-950 dark:bg-[#090a0f] dark:text-white sm:p-8"><div className="mx-auto flex w-full max-w-md flex-col justify-center"><AppMark href="/" /><section className="mt-10 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Portfolio Pro</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.055em]">{isSignUp ? "Создайте аккаунт" : "С возвращением"}</h1><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{isSignUp ? "Начните собирать портфолио в защищённом рабочем пространстве." : "Войдите, чтобы продолжить работу над своим портфолио."}</p><form className="mt-7 space-y-4" onSubmit={submit} noValidate>{isSignUp ? <div><Label htmlFor="auth-name">Имя</Label><Input id="auth-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-2 h-11 rounded-xl" required /></div> : null}<div><Label htmlFor="auth-email">Email</Label><Input id="auth-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-2 h-11 rounded-xl" required /></div><div><Label htmlFor="auth-password">Пароль</Label><Input id="auth-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={isSignUp ? "new-password" : "current-password"} className="mt-2 h-11 rounded-xl" minLength={8} required /></div>{error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200">{error}</p> : null}{message ? <p role="status" className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:bg-violet-400/10 dark:text-violet-100">{message}</p> : null}<Button type="submit" disabled={busy} className="mt-2 h-11 w-full rounded-full bg-violet-700 text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400">{busy ? "Подождите…" : isSignUp ? "Создать аккаунт" : "Войти"}</Button></form><p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{isSignUp ? "Уже есть аккаунт?" : "Впервые в Portfolio Pro?"} <Link href={isSignUp ? "/auth/signin" : "/auth/signup"} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">{isSignUp ? "Войти" : "Создать аккаунт"}</Link></p></section></div></main>;
}

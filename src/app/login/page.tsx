"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

const SESSION_KEY = "coffee-manager:session";

export default function LoginPage() {
  const router = useRouter();
  const { settings } = useManagerSettings();
  const { pick } = useManagerI18n();
  const cafeName = (settings.cafeName || "").trim() || "Cafe Management";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const db = getSupabaseBrowserClient();
    if (!db) return;
    void db.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!email.trim() || !password.trim()) { setError('اكتب البريد الإلكتروني وكلمة المرور أولًا.'); return; }
    setIsSubmitting(true);
    const db = getSupabaseBrowserClient();
    if (db) {
      const { error: authError } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError('بيانات الدخول غير صحيحة أو الحساب غير مفعّل.'); setIsSubmitting(false); return; }
      const staffCheck = await db.rpc("is_staff_user");
      if (staffCheck.error || staffCheck.data !== true) {
        await db.auth.signOut();
        setError("هذا الحساب غير مضاف كحساب كاشير أو مدير في هذا الكافيه.");
        setIsSubmitting(false);
        return;
      }
      const scopeCheck = await db.rpc("current_staff_cafe_id");
      if (scopeCheck.error || typeof scopeCheck.data !== "string") {
        await db.auth.signOut();
        setError("حسابك مفعّل، لكنه غير مرتبط بكافيه. اطلب من المدير ربط الحساب بالكافيه أولًا.");
        setIsSubmitting(false);
        return;
      }
    }
    window.sessionStorage.setItem(SESSION_KEY, 'active'); setIsLeaving(true);
    window.setTimeout(() => router.push('/dashboard'), 1900);
  }

  return (
    <main className={`login-shell relative grid min-h-screen place-items-center overflow-hidden bg-[var(--background)] p-6 ${isLeaving ? "is-leaving" : ""}`}>
      <span className="login-orbit login-orbit-two" /><span className="login-orbit login-orbit-three" /><span className="login-particle login-particle-one" /><span className="login-particle login-particle-two" /><span className="login-particle login-particle-three" /><span className="login-grid" />
      <span className="login-transition-scene" aria-hidden="true" />
      <span className="login-door login-door-left" /><span className="login-door login-door-right" />
      <section className="login-card relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--surface)] shadow-2xl md:grid-cols-[1.05fr_.95fr]">
        <div className="login-visual relative hidden min-h-[620px] md:block">
          <Image src="/images/manager-hero.png" alt={`أجواء ${cafeName}`} fill priority className="login-image object-cover" sizes="520px" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,10,8,.1),rgba(9,10,8,.94))]" />
          <div className="absolute bottom-10 right-10 left-10">
            <p className="text-xs font-semibold tracking-[.25em] text-[var(--gold)]">{cafeName.toUpperCase()}</p>
            <p className="mt-3 text-sm leading-7 text-white/60">{pick("One account for managers, cashiers, and baristas.", "حساب واحد لفريق الإدارة والكاشير والباريستا.")}</p>
          </div>
        </div>
        <div className="flex flex-col justify-center p-8 md:p-14">
          <div className="mb-10">
            {settings.logo ? <Image src={settings.logo} alt="" width={42} height={42} unoptimized className="size-10 rounded-xl border border-[var(--gold)]/40 object-cover" /> : <span className="text-3xl text-[var(--gold)]">♛</span>}
            <p className="mt-5 text-sm font-semibold tracking-widest text-[var(--gold)]">{pick("WELCOME BACK", "مرحبًا بعودتك")}</p>
            <h2 className="mt-2 text-3xl font-bold text-white">{pick("Sign in", "تسجيل الدخول")}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{pick("Use the cafe account to access operations.", "استخدم حساب الكافيه للدخول إلى لوحة التشغيل.")}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm text-white/75">{pick("Email", "البريد الإلكتروني")}
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" placeholder="manager@kingscafe.com" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-[var(--gold)]" />
            </label>
            <label className="block text-sm text-white/75">{pick("Password", "كلمة المرور")}
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-white outline-none transition placeholder:text-white/25 focus:border-[var(--gold)]" />
            </label>
            {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-[var(--gold)] px-5 py-3.5 font-bold text-[#17120a] transition hover:bg-[#f0b53c] disabled:cursor-wait disabled:opacity-60">{isSubmitting ? pick("Signing in...", "جاري الدخول...") : pick("Open operations", "دخول لوحة التشغيل")}</button>
          </form>
          <p className="mt-8 text-center text-xs leading-6 text-white/35">{pick("This account is shared by the operating team.", "الحساب مشترك حاليًا بين فريق التشغيل.")}</p>
        </div>
      </section>
    </main>
  );
}





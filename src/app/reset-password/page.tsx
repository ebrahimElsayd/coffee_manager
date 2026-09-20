"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const db = getSupabaseBrowserClient();
    if (!db) { queueMicrotask(() => setError("خدمة المصادقة غير مهيأة.")); return; }
    let active = true;
    void db.auth.getSession().then(({ data }) => {
      if (!active) return;
      setReady(Boolean(data.session));
      if (!data.session) setError("رابط إعادة التعيين غير صالح أو منتهي. اطلب رابطًا جديدًا.");
    });
    const { data: authListener } = db.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setReady(Boolean(session));
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (password.length < 8) { setError("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل."); return; }
    if (password !== confirmation) { setError("كلمتا المرور غير متطابقتين."); return; }
    const db = getSupabaseBrowserClient();
    if (!db) { setError("خدمة المصادقة غير مهيأة."); return; }
    setSubmitting(true);
    const { error: updateError } = await db.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) { setError("تعذر تحديث كلمة المرور. اطلب رابطًا جديدًا وحاول مرة أخرى."); return; }
    await db.auth.signOut();
    setMessage("تم تحديث كلمة المرور بنجاح. سيتم تحويلك إلى تسجيل الدخول.");
    window.setTimeout(() => router.replace("/login"), 1200);
  }

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[var(--background)] p-6 text-white"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface)] p-8 shadow-2xl"><p className="text-sm font-semibold tracking-widest text-[var(--gold)]">أمان الحساب</p><h1 className="mt-3 text-2xl font-bold">إعادة تعيين كلمة المرور</h1><p className="mt-3 text-sm leading-7 text-white/60">أنشئ كلمة مرور جديدة لحساب الإدارة.</p>{ready ? <form onSubmit={handleSubmit} className="mt-6 space-y-4"><label className="block text-sm text-white/75">كلمة المرور الجديدة<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[var(--gold)]" /></label><label className="block text-sm text-white/75">تأكيد كلمة المرور<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[var(--gold)]" /></label><button type="submit" disabled={submitting} className="w-full rounded-xl bg-[var(--gold)] py-3 font-semibold text-[#17120a] disabled:opacity-60">{submitting ? "جاري الحفظ..." : "حفظ كلمة المرور"}</button></form> : <p className="mt-6 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error || "جارٍ التحقق من الرابط..."}</p>}{error && ready && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}{message && <p role="status" className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{message}</p>}<button type="button" onClick={() => router.replace("/login")} className="mt-5 w-full text-sm text-white/60 hover:text-white">العودة لتسجيل الدخول</button></section></main>;
}

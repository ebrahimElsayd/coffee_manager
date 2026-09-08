"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";

export default function HomePage() {
  const router = useRouter();
  const { settings } = useManagerSettings();
  const cafeName = settings.cafeName.trim() || "Cafe Management";
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const transitionTimer = window.setTimeout(() => setIsLeaving(true), 2200);
    const navigationTimer = window.setTimeout(() => router.push("/login"), 2850);

    return () => {
      window.clearTimeout(transitionTimer);
      window.clearTimeout(navigationTimer);
    };
  }, [router]);

  return (
    <main className={`hero-stage min-h-screen p-6 transition-all duration-700 md:p-10 ${isLeaving ? "hero-leaving scale-[1.03] opacity-0" : "opacity-100"}`}>
      <section className="relative isolate mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1440px] overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--surface)] shadow-2xl md:min-h-[calc(100vh-5rem)]">
        <Image
          src="/images/manager-hero.png"
          alt={`أجواء ${cafeName}`}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1440px"
          className="hero-image -z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(9,10,8,.98)_0%,rgba(9,10,8,.88)_32%,rgba(9,10,8,.32)_72%,rgba(9,10,8,.18)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_22%_38%,rgba(224,160,32,.18),transparent_34%)]" />
        <div className="hero-light-sweep" aria-hidden="true" />
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />

        <div className="flex w-full max-w-2xl flex-col justify-between p-8 md:p-14 lg:p-20">
          <div className="hero-brand flex items-center gap-3 text-xs font-semibold tracking-[.28em] text-[var(--gold)]">
            <span className="hero-crown grid size-10 place-items-center overflow-hidden rounded-full border border-[var(--gold)]/40 bg-black/30 text-xl tracking-normal">{settings.logo ? <Image src={settings.logo} alt="" width={40} height={40} unoptimized className="size-full object-cover" /> : "♛"}</span>
            {cafeName.toUpperCase()}
          </div>

          <div className="max-w-xl py-16">
            <p className="hero-eyebrow mb-4 text-sm font-medium text-[var(--success)]">OPERATIONS DASHBOARD</p>
            <h1 className="hero-title text-4xl font-bold leading-[1.1] text-white md:text-6xl">إدارة الكافيه تبدأ من هنا</h1>
            <p className="hero-description mt-6 max-w-lg text-base leading-8 text-white/65 md:text-lg">
              تابع الطاولات والطلبات وحالة التحضير من شاشة واحدة، بهدوء ووضوح يليق بتجربة {cafeName}.
            </p>
            <div className="hero-action mt-9 text-sm text-white/40">جاري تجهيز لوحة التشغيل...</div>
          </div>

          <div className="hero-meta flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/45">
            <span><i className="mr-2 inline-block size-2 rounded-full bg-[var(--success)]" />Live service</span>
            <span>{cafeName} workspace</span>
          </div>
        </div>
        <div className="hero-progress" aria-hidden="true"><span /></div>
      </section>
    </main>
  );
}

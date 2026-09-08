export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <main className="min-h-screen bg-[#080a09] p-8 text-[#f4efe5]"><span className="inline-flex items-center gap-2 text-sm text-white/60"><span className="size-2 animate-pulse rounded-full bg-[var(--gold)]" />{label}</span></main>;
}

export function ErrorState({ label = "Unable to load data. Please try again." }: { label?: string }) {
  return <main className="min-h-screen bg-[#080a09] p-8 text-[#f4efe5]"><div className="rounded-xl border border-red-300/20 bg-red-300/[.06] p-4 text-sm text-red-100">{label}</div></main>;
}

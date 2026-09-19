export function formatReceiptDateTime(issuedAt: string, locale: "ar" | "en" = "en") {
  const date = new Date(issuedAt);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "—" };
  const language = locale === "ar" ? "ar-EG" : "en-GB";
  return {
    date: new Intl.DateTimeFormat(language, { year: "numeric", month: "2-digit", day: "2-digit" }).format(date),
    time: new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

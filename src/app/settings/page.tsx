"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import NextImage from "next/image";
import { ManagerSidebar } from "@/shared/presentation/components/manager-sidebar";
import { useManagerSettings, type ManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";
import { createCafeTable, deleteCafeTable, getTableQrUrl, listCafeTables, type ManagedTable } from "@/shared/infrastructure/supabase/supabase-table-management";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

type Section = "profile" | "appearance" | "notifications" | "receipt" | "tables";
type NotificationKey = "newOrder" | "ready" | "stock" | "sound";

const sections: { id: Section; title: string; arabic: string; icon: string }[] = [
  { id: "profile", title: "Cafe Profile", arabic: "بيانات الكافيه", icon: "♨" },
  { id: "appearance", title: "Appearance", arabic: "المظهر", icon: "◐" },
  { id: "notifications", title: "Notifications", arabic: "الإشعارات", icon: "♧" },
  { id: "receipt", title: "Receipt & Printing", arabic: "الفاتورة والطباعة", icon: "▣" },
  { id: "tables", title: "Tables Management", arabic: "إدارة الترابيزات", icon: "♜" },
];

const settingsTextAr: Record<string, string> = {
  "Manage the identity and contact details shown across your cafe operations.": "إدارة هوية الكافيه وبيانات التواصل الظاهرة في النظام.",
  "Cafe Name": "اسم الكافيه", "Branch Name": "اسم الفرع", "Cafe Phone Number": "رقم هاتف الكافيه", Currency: "العملة", Address: "العنوان",
  "Cafe branch address": "عنوان فرع الكافيه", "Account Email": "البريد الإلكتروني للحساب", "Recovery Phone": "هاتف استرجاع الحساب",
  "Choose how the manager workspace looks and reads.": "اختر مظهر ومساحة عمل الإدارة.", Theme: "المظهر", Dark: "داكن", Light: "فاتح",
  "Dark is recommended for the cafe workspace.": "الوضع الداكن موصى به لمساحة عمل الكافيه.", Language: "اللغة",
  "The interface direction follows the selected language.": "يتغير اتجاه الواجهة حسب اللغة المحددة.", "Interface Density": "كثافة الواجهة",
  "Controls spacing in lists and operational cards.": "تتحكم في المسافات داخل القوائم وبطاقات التشغيل.",
  "Choose which events should be highlighted for the operating team.": "اختر الأحداث التي تظهر كتنبيهات لفريق التشغيل.",
  "When a new customer order arrives.": "عند وصول طلب عميل جديد.", "When every drink in an order is ready.": "عندما تصبح جميع مشروبات الطلب جاهزة.",
  "When an item reaches its reorder level.": "عندما يصل منتج إلى حد إعادة الطلب.", "Play a short sound for important alerts.": "تشغيل صوت قصير للتنبيهات المهمة.",
  "Prepare the receipt layout before connecting a physical printer.": "جهّز بيانات الإيصال قبل توصيل الطابعة.", "Receipt Header": "عنوان الإيصال",
  "Footer Message": "رسالة أسفل الإيصال", "Display unit prices and totals on printed bills.": "إظهار أسعار الوحدات والإجماليات في الفواتير المطبوعة.",
  "Receipt Size": "حجم الإيصال", "Printer connection will be enabled in the next phase.": "سيتم تفعيل الاتصال بالطابعة في المرحلة التالية.",
  "Apply this charge to the printed receipt total.": "تطبيق هذه القيمة على إجمالي الإيصال المطبوع.", Enabled: "مفعّل", "Service Charge": "رسوم الخدمة", Tax: "الضريبة",
};

function useSettingsText() {
  const { locale } = useManagerI18n();
  return (text: string) => locale === "ar" ? settingsTextAr[text] ?? text : text;
}

export default function SettingsPage() {
  const { settings, updateSettings } = useManagerSettings();
  const { locale, pick } = useManagerI18n();
  const [active, setActive] = useState<Section>("profile");
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<ManagerSettings>(settings);
  // Keep the editable draft in sync after localStorage hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDraft(settings), [settings]);

  const save = () => { updateSettings(draft); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const updateDraft = <K extends keyof ManagerSettings>(key: K, value: ManagerSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // Receipt charges affect bills immediately. Persist this slice as soon as
    // it changes so a refresh cannot silently re-enable service or tax.
    if (key === "receipt") updateSettings({ receipt: value as ManagerSettings["receipt"] });
    if (key === "language") updateSettings({ language: value as ManagerSettings["language"] });
  };

  return <main className="manager-page settings-page min-h-screen overflow-x-hidden bg-[#080a09] pl-16 text-[#f4efe5] lg:pl-[184px] xl:pl-[200px] 2xl:pl-[224px]">
    <ManagerSidebar />
    <div className="min-h-screen p-4 sm:p-6 xl:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[.08] pb-6">
        <div><p className="text-xs uppercase tracking-[.25em] text-[var(--gold)]">{pick("System control", "إدارة النظام")}</p><h1 className="mt-1 font-serif text-4xl">{pick("Settings", "الإعدادات")}</h1><p className="mt-1 text-sm text-white/45">{pick("Customize the operating experience", "تخصيص تجربة التشغيل")}</p></div>
        <button type="button" onClick={save} className="rounded-xl bg-[#eab454] px-6 py-3 text-sm font-semibold text-[#1a1308] shadow-[0_8px_24px_rgba(234,180,84,.14)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(234,180,84,.24)]">▣　{pick("Save Changes", "حفظ التغييرات")}</button>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[225px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="h-fit rounded-2xl border border-white/15 bg-[#111312] p-2" aria-label={pick("Settings sections", "أقسام الإعدادات")}>
          {sections.map((section) => <button type="button" key={section.id} onClick={() => setActive(section.id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition ${active === section.id ? "border border-[var(--gold)]/60 bg-[var(--gold)]/[.1] text-[#f5ca72] shadow-[0_0_22px_rgba(224,160,32,.06)]" : "text-white/60 hover:bg-white/[.04] hover:text-white"}`}><span className="grid size-9 place-items-center rounded-lg bg-white/[.05] text-lg">{section.icon}</span><span><b className="block text-sm font-medium">{locale === "ar" ? section.arabic : section.title}</b></span></button>)}
        </nav>

        <section className="min-w-0 rounded-2xl border border-white/15 bg-[#111312] p-5 shadow-xl sm:p-7">
          {active === "profile" && <ProfilePanel settings={draft} onChange={updateDraft} />}
          {active === "appearance" && <AppearancePanel settings={draft} onChange={updateDraft} />}
          {active === "notifications" && <NotificationsPanel values={draft.notifications} onToggle={(key) => updateDraft("notifications", { ...draft.notifications, [key]: !draft.notifications[key] })} />}
          {active === "receipt" && <><ReceiptPanel settings={draft} onChange={updateDraft} /><ReceiptFeesEditor settings={draft} onChange={updateDraft} /></>}
          {active === "tables" && <TablesPanel />}
        </section>
      </div>
      {saved && <div role="status" className="fixed end-6 top-6 z-50 rounded-xl border border-[#5ca66b]/50 bg-[#10261d] px-4 py-3 text-sm text-[#b9f5d2] shadow-2xl">✓ {pick("Changes saved", "تم حفظ التغييرات")}</div>}
    </div>
  </main>;
}

function PanelHeader({ icon, title, arabic, description }: { icon: string; title: string; arabic: string; description: string }) { const { locale } = useManagerI18n(); const t = useSettingsText(); return <div className="mb-7 flex items-start gap-3 border-b border-white/10 pb-5"><span className="grid size-11 place-items-center rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/[.08] text-xl text-[var(--gold)]">{icon}</span><div><h2 className="font-serif text-2xl">{locale === "ar" ? arabic : title}</h2><p className="mt-2 text-xs text-white/45">{t(description)}</p></div></div>; }
function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) { const t = useSettingsText(); return <label className="block text-sm text-white/70">{t(label)}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ? t(placeholder) : undefined} className="mt-2 w-full rounded-xl border border-white/15 bg-[#0d0f0e] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--gold)]" /></label>; }
function ProfilePanel({ settings, onChange }: { settings: ManagerSettings; onChange: <K extends keyof ManagerSettings>(key: K, value: ManagerSettings[K]) => void }) { const uploadLogo = (file: File | undefined) => { if (!file || !file.type.startsWith("image/")) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result !== "string") return; const image = new Image(); image.onload = () => { const max = 256; const side = Math.min(image.width, image.height); const sx = (image.width - side) / 2; const sy = (image.height - side) / 2; const canvas = document.createElement("canvas"); canvas.width = max; canvas.height = max; const context = canvas.getContext("2d"); if (!context) return; context.drawImage(image, sx, sy, side, side, 0, 0, max, max); onChange("logo", canvas.toDataURL("image/jpeg", 0.82)); }; image.src = reader.result; }; reader.readAsDataURL(file); }; return <><PanelHeader icon="♨" title="Cafe Profile" arabic="بيانات الكافيه" description="Manage the identity and contact details shown across your cafe operations." /><div className="grid gap-5 sm:grid-cols-2"><TextField label="Cafe Name" value={settings.cafeName} onChange={(value) => onChange("cafeName", value)} /><TextField label="Branch Name" value={settings.branchName} onChange={(value) => onChange("branchName", value)} /><TextField label="Cafe Phone Number" value={settings.phone} placeholder="+20 100 000 0000" onChange={(value) => onChange("phone", value)} /><TextField label="Currency" value={settings.currency} onChange={(value) => onChange("currency", value)} /></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><TextField label="Address" value={settings.address} placeholder="Cafe branch address" onChange={(value) => onChange("address", value)} /><label className="block text-sm text-white/70">Cafe Logo<div className="relative mt-2 flex h-[90px] items-center gap-3 overflow-hidden rounded-xl border border-dashed border-[var(--gold)]/50 bg-[#0d0f0e] bg-cover bg-center bg-no-repeat px-4 text-sm text-[var(--gold)]" style={settings.logo ? { backgroundImage: `linear-gradient(90deg, rgba(13,15,14,.92), rgba(13,15,14,.35)), url(${settings.logo})` } : undefined}><span>♨　{settings.logo ? "Change logo" : "Upload logo"}<small className="ml-2 text-xs text-white/35">PNG, JPG or SVG</small></span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => uploadLogo(event.target.files?.[0])} className="absolute inset-0 cursor-pointer opacity-0" /></div><small className="mt-1 block text-xs text-white/35">The image is cropped to a square so it fills the logo frame cleanly.</small></label></div><div className="mt-5 border-t border-white/10 pt-5"><h3 className="text-sm font-semibold">Account Recovery</h3><p className="mt-1 mb-3 text-xs text-white/40">بيانات استرجاع كلمة المرور</p><div className="grid gap-5 sm:grid-cols-2"><TextField label="Account Email" value={settings.adminEmail} placeholder="manager@kingscafe.com" onChange={(value) => onChange("adminEmail", value)} /><TextField label="Recovery Phone" value={settings.adminPhone} placeholder="+20 100 000 0000" onChange={(value) => onChange("adminPhone", value)} /></div></div></>; }
 function TablesPanel() {
  const [tables, setTables] = useState<ManagedTable[]>([]);
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qrTable, setQrTable] = useState<ManagedTable | null>(null);
  const [qrImage, setQrImage] = useState("");

  useEffect(() => {
    if (!qrTable) return;
    void QRCode.toDataURL(getTableQrUrl(qrTable.number, qrTable.cafeId, qrTable.qrToken), { width: 640, margin: 2, errorCorrectionLevel: "H" }).then(setQrImage).catch(() => setQrImage(""));
  }, [qrTable]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try { setTables(await listCafeTables()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load tables"); } finally { setLoading(false); }
  };
  // Initial load synchronizes the external Supabase repository with this screen.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, []);

  const addTable = async () => {
    if (!number.trim() || saving) return;
    setSaving(true); setError("");
    try { await createCafeTable(number); setNumber(""); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create table"); } finally { setSaving(false); }
  };
  const removeTable = async (table: ManagedTable) => {
    if (!window.confirm(`Remove Table ${table.number}? Existing history will be preserved.`)) return;
    setError("");
    try { await deleteCafeTable(table.id); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove table"); }
  };

  return <><PanelHeader icon="♜" title="Tables Management" arabic="إدارة الترابيزات" description="Create and manage the tables that belong to this cafe. Each table has its own customer QR link." /><div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4"><label className="min-w-[210px] flex-1 text-sm text-white/70">Table number<input value={number} onChange={(event) => setNumber(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addTable(); }} placeholder="e.g. 21" className="mt-2 w-full rounded-xl border border-white/15 bg-[#0d0f0e] px-4 py-3 text-sm text-white outline-none focus:border-[var(--gold)]" /></label><button type="button" disabled={!number.trim() || saving} onClick={() => void addTable()} className="rounded-xl bg-[#eab454] px-5 py-3 text-sm font-semibold text-[#1a1308] disabled:cursor-not-allowed disabled:opacity-40">＋ Add Table</button></div>{error && <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}<div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Your cafe tables</h3><p className="mt-1 text-xs text-white/40">{tables.length} table{tables.length === 1 ? "" : "s"} configured</p></div><button type="button" onClick={() => void refresh()} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/65 hover:border-[var(--gold)]/60 hover:text-white">↻ Refresh</button></div>{loading ? <p className="py-10 text-center text-sm text-white/45">Loading tables…</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tables.map((table) => <article key={table.id} className="rounded-2xl border border-white/10 bg-[#0d0f0e] p-4 transition hover:border-[var(--gold)]/50"><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-xl border border-[var(--gold)]/35 bg-[var(--gold)]/[.08] text-xl text-[var(--gold)]">♜</span><span className={`rounded-full px-2.5 py-1 text-[11px] ${table.status === "occupied" ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>{table.status === "occupied" ? "Occupied" : "Available"}</span></div><h3 className="mt-4 text-lg font-semibold">Table {table.number}</h3><p className="mt-1 text-xs text-white/40">Customer QR is ready for this table</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => setQrTable(table)} className="flex-1 rounded-lg border border-[var(--gold)]/50 py-2 text-xs text-[#f5ca72] hover:bg-[var(--gold)]/10">▣ QR Code</button><button type="button" onClick={() => void removeTable(table)} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-200 hover:bg-red-400/10">×</button></div></article>)}{tables.length === 0 && <p className="col-span-full py-10 text-center text-sm text-white/45">No tables configured yet. Add the first table above.</p>}</div>}{qrTable && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={`QR code for Table ${qrTable.number}`} onClick={() => setQrTable(null)}><section className="w-full max-w-sm rounded-2xl border border-[var(--gold)]/50 bg-[#151715] p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => setQrTable(null)} className="float-right text-xl text-white/50 hover:text-white" aria-label="Close">×</button><div className="clear-both"/><p className="text-xs uppercase tracking-[.2em] text-[var(--gold)]">Customer access</p><h2 className="mt-2 font-serif text-2xl">Table {qrTable.number}</h2><div className="mx-auto my-5 grid size-56 place-items-center rounded-2xl bg-white p-3">{qrImage ? <NextImage src={qrImage} alt={`QR code for Table ${qrTable.number}`} width={640} height={640} unoptimized className="size-full" /> : <span className="text-sm text-black/50">Generating QR…</span>}</div><p className="break-all rounded-lg bg-black/20 p-3 text-xs text-white/55">{getTableQrUrl(qrTable.number, qrTable.cafeId, qrTable.qrToken)}</p><div className="mt-3 flex gap-2"><a href={qrImage || undefined} download={`table-${qrTable.number}-qr.png`} className="flex-1 rounded-lg bg-[#eab454] px-3 py-2 text-xs font-semibold text-[#1a1308]">Download PNG</a><button type="button" onClick={() => { if (!qrImage) return; const printWindow = window.open("", "_blank", "noopener,noreferrer"); if (!printWindow) return; printWindow.document.write(`<img src="${qrImage}" style="width:320px;height:320px" onload="window.print();window.close()"/>`); printWindow.document.close(); }} className="flex-1 rounded-lg border border-[var(--gold)]/50 px-3 py-2 text-xs text-[#f5ca72]">Print QR</button></div><p className="mt-3 text-xs text-white/40">امسح الكود من هاتف متصل بنفس الشبكة.</p></section></div>}</>;
}

function AppearancePanel({ settings, onChange }: { settings: ManagerSettings; onChange: <K extends keyof ManagerSettings>(key: K, value: ManagerSettings[K]) => void }) { return <><PanelHeader icon="◐" title="Appearance" arabic="المظهر" description="Choose how the manager workspace looks and reads." /><SettingGroup title="Theme" hint="Dark is recommended for the cafe workspace."><div className="grid max-w-md grid-cols-2 gap-3"><Choice active={settings.theme === "Dark"} onClick={() => onChange("theme", "Dark")} icon="◐" label="Dark" arabic="داكن" /><Choice active={settings.theme === "Light"} onClick={() => onChange("theme", "Light")} icon="☼" label="Light" arabic="فاتح" /></div></SettingGroup><SettingGroup title="Language" hint="The interface direction follows the selected language."><select value={settings.language} onChange={(event) => onChange("language", event.target.value as ManagerSettings["language"])} className="w-full max-w-md rounded-xl border border-white/15 bg-[#0d0f0e] px-4 py-3 text-sm text-white outline-none focus:border-[var(--gold)]"><option>العربية</option><option>English</option></select></SettingGroup><SettingGroup title="Interface Density" hint="Controls spacing in lists and operational cards."><select value={settings.density} onChange={(event) => onChange("density", event.target.value as ManagerSettings["density"])} className="w-full max-w-md rounded-xl border border-white/15 bg-[#0d0f0e] px-4 py-3 text-sm text-white outline-none focus:border-[var(--gold)]"><option>Comfortable</option><option>Compact</option></select></SettingGroup></>; }
function NotificationsPanel({ values, onToggle }: { values: Record<NotificationKey, boolean>; onToggle: (key: NotificationKey) => void }) { return <><PanelHeader icon="♧" title="Notifications" arabic="الإشعارات" description="Choose which events should be highlighted for the operating team." /><div className="space-y-3">{[["newOrder", "New Order", "طلب جديد", "When a new customer order arrives."], ["ready", "Order Ready", "الطلب جاهز", "When every drink in an order is ready."], ["stock", "Stock Alert", "تنبيه المخزون", "When an item reaches its reorder level."], ["sound", "Notification Sound", "صوت الإشعار", "Play a short sound for important alerts."]].map(([key, title, arabic, hint]) => <ToggleRow key={key} title={title} arabic={arabic} hint={hint} value={values[key as NotificationKey]} onChange={() => onToggle(key as NotificationKey)} />)}</div></>; }
function ReceiptPanel({ settings, onChange }: { settings: ManagerSettings; onChange: <K extends keyof ManagerSettings>(key: K, value: ManagerSettings[K]) => void }) { const updateReceipt = (patch: Partial<ManagerSettings["receipt"]>) => onChange("receipt", { ...settings.receipt, ...patch }); return <><PanelHeader icon="▣" title="Receipt & Printing" arabic="الفاتورة والطباعة" description="Prepare the receipt layout before connecting a physical printer." /><div className="grid gap-5 sm:grid-cols-2"><TextField label="Receipt Header" value={settings.receipt.header} onChange={(value) => updateReceipt({ header: value })} /><TextField label="Footer Message" value={settings.receipt.footer} onChange={(value) => updateReceipt({ footer: value })} /></div><div className="mt-5 space-y-3"><ToggleRow title="Show Prices" arabic="إظهار الأسعار" hint="Display unit prices and totals on printed bills." value={settings.receipt.showPrices} onChange={() => updateReceipt({ showPrices: !settings.receipt.showPrices })} /></div><SettingGroup title="Receipt Size" hint="Printer connection will be enabled in the next phase."><select value={settings.receipt.size} onChange={(event) => updateReceipt({ size: event.target.value as ManagerSettings["receipt"]["size"] })} className="w-full max-w-md rounded-xl border border-white/15 bg-[#0d0f0e] px-4 py-3 text-sm text-white outline-none focus:border-[var(--gold)]"><option>Standard</option><option>Compact</option><option>Large</option></select></SettingGroup></>; }
function ReceiptFeesEditor({ settings, onChange }: { settings: ManagerSettings; onChange: <K extends keyof ManagerSettings>(key: K, value: ManagerSettings[K]) => void }) { const update = (patch: Partial<ManagerSettings["receipt"]>) => onChange("receipt", { ...settings.receipt, ...patch }); const fee = (label: string, enabled: boolean, type: "percent" | "fixed", value: number, toggle: () => void, setType: (type: "percent" | "fixed") => void, setValue: (value: number) => void) => <div className="border-t border-white/10 py-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs text-white/40">Apply this charge to the printed receipt total.</p></div><ToggleRow title="Enabled" arabic="مفعل" hint="" value={enabled} onChange={toggle} /></div>{enabled && <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_130px]"><div className="flex rounded-xl border border-white/15 bg-[#0d0f0e] p-1"><button type="button" onClick={() => setType("percent")} className={`flex-1 rounded-lg px-3 py-2 text-xs ${type === "percent" ? "bg-[var(--gold)]/20 text-[#f5ca72]" : "text-white/50"}`}>Percentage %</button><button type="button" onClick={() => setType("fixed")} className={`flex-1 rounded-lg px-3 py-2 text-xs ${type === "fixed" ? "bg-[var(--gold)]/20 text-[#f5ca72]" : "text-white/50"}`}>Fixed EGP</button></div><input type="number" min="0" value={value} onChange={(event) => setValue(Number(event.target.value) || 0)} className="rounded-xl border border-white/15 bg-[#0d0f0e] px-3 py-2 text-sm text-white outline-none focus:border-[var(--gold)]" /></div>}</div>; return <div className="mt-5 rounded-2xl border border-white/15 bg-[#111312] p-5"><h2 className="font-serif text-xl">Charges &amp; Taxes</h2><p className="mt-1 text-sm text-white/45">الخدمة والضريبة</p>{fee("Service Charge", settings.receipt.serviceEnabled, settings.receipt.serviceType, settings.receipt.serviceValue, () => update({ serviceEnabled: !settings.receipt.serviceEnabled }), (type) => update({ serviceType: type }), (value) => update({ serviceValue: value }))}{fee("Tax", settings.receipt.taxEnabled, settings.receipt.taxType, settings.receipt.taxValue, () => update({ taxEnabled: !settings.receipt.taxEnabled }), (type) => update({ taxType: type }), (value) => update({ taxValue: value }))}</div>; }
function SettingGroup({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) { const t = useSettingsText(); return <div className="border-b border-white/10 py-5 first:pt-0 last:border-0"><h3 className="text-sm font-semibold text-white/85">{t(title)}</h3><p className="mt-1 mb-3 text-xs text-white/40">{t(hint)}</p>{children}</div>; }
function Choice({ active, onClick, icon, label, arabic }: { active: boolean; onClick: () => void; icon: string; label: string; arabic: string }) { const { locale } = useManagerI18n(); return <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border p-3 text-start transition ${active ? "border-[var(--gold)] bg-[var(--gold)]/[.1] text-[#f5ca72]" : "border-white/15 bg-white/[.02] text-white/60 hover:border-white/30"}`}><span className="grid size-9 place-items-center rounded-lg bg-white/[.06] text-lg">{icon}</span><span><b className="block text-sm">{locale === "ar" ? arabic : label}</b></span>{active && <span className="ms-auto text-[#77ce87]">●</span>}</button>; }
function ToggleRow({ title, arabic, hint, value, onChange }: { title: string; arabic: string; hint: string; value: boolean; onChange: () => void }) { const { locale } = useManagerI18n(); const t = useSettingsText(); return <button type="button" onClick={onChange} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.02] p-4 text-start transition hover:border-white/25"><span><b className="block text-sm text-white/85">{locale === "ar" ? arabic : title}</b><small className="mt-1 block text-xs text-white/40">{t(hint)}</small></span><span className={`h-6 w-11 shrink-0 rounded-full p-1 transition ${value ? "bg-[#5ca66b]" : "bg-white/15"}`}><span className={`block size-4 rounded-full bg-white transition ${value ? locale === "ar" ? "-translate-x-5" : "translate-x-5" : ""}`} /></span></button>; }

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProductRecord } from "@/features/products/application/ports/product-repository";
import { productRepository } from "@/shared/infrastructure/product-services";
import { generateSafeUUID } from "@/shared/utils/uuid";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

type CustomizationChoice = { name: string; arabicName?: string; price: number };
type Customization = { id: string; name: string; arabicName?: string; choices: CustomizationChoice[]; required: boolean };
type ProductDraft = {
  name: string; arabicName: string; category: string; price: string; cost: string;
  description: string; image: string; available: boolean; availableForTakeaway: boolean; visible: boolean; customizations: Customization[];
};

const EMPTY_DRAFT: ProductDraft = { name: "", arabicName: "", category: "", price: "", cost: "", description: "", image: "", available: true, availableForTakeaway: true, visible: true, customizations: [] };

export function ProductEditor({ editId }: { editId: string | null }) {
  const router = useRouter();
  const { pick } = useManagerI18n();
  const isEditMode = editId !== null;
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [categories, setCategories] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(isEditMode);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [customizationModal, setCustomizationModal] = useState(false);
  const [editingCustomizationId, setEditingCustomizationId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupArabicName, setGroupArabicName] = useState("");
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupChoices, setGroupChoices] = useState<CustomizationChoice[]>([]);
  const [choiceDraft, setChoiceDraft] = useState("");
  const [choiceArabicDraft, setChoiceArabicDraft] = useState("");
  const [choicePriceDraft, setChoicePriceDraft] = useState("");

  useEffect(() => {
    let active = true;
    void productRepository.listCategories().then((remoteCategories) => {
      if (!active) return;
      if (remoteCategories.length) setCategories(remoteCategories);
    }).catch(() => { /* The repository reports the connection error on save. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) { setAttempted(false); setNotice(""); } });
    if (!editId) {
      queueMicrotask(() => { if (active) { setDraft({ ...EMPTY_DRAFT, customizations: [] }); setLoadingProduct(false); } });
      return () => { active = false; };
    }
    queueMicrotask(() => { if (active) setLoadingProduct(true); });
    void productRepository.getById(editId).then((product) => {
      if (!active) return;
      if (!product) {
        setNotice("تعذر تحميل بيانات المنتج. حدّث الصفحة وحاول مرة أخرى.");
        setLoadingProduct(false);
        return;
      }
      setDraft({
        name: product.name, arabicName: product.arabicName, category: product.category,
        price: String(product.price), cost: product.cost == null ? "" : String(product.cost),
        description: product.description ?? "", image: product.image, available: product.available, availableForTakeaway: product.availableForTakeaway ?? true,
        visible: product.visible ?? true,
        customizations: product.customizations?.map((item) => ({ ...item, choices: item.choices.map((choice) => ({ ...choice })) })) ?? [],
      });
      setCategories((current) => current.includes(product.category) ? current : [...current, product.category]);
      setLoadingProduct(false);
    }).catch(() => {
      if (active) {
        setNotice("تعذر تحميل بيانات المنتج. حدّث الصفحة وحاول مرة أخرى.");
        setLoadingProduct(false);
      }
    });
    return () => { active = false; };
  }, [editId]);

  const update = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const errors = useMemo(() => ({ arabicName: !draft.arabicName.trim(), category: !draft.category.trim(), price: !draft.price.trim() || Number(draft.price) <= 0 }), [draft.arabicName, draft.category, draft.price]);
  const isValid = !errors.arabicName && !errors.category && !errors.price;

  const saveProduct = async () => {
    if (loadingProduct) return;
    setAttempted(true);
    if (!isValid) { setNotice("أكمل الحقول المطلوبة أولًا"); window.setTimeout(() => setNotice(""), 1200); return; }
    const product: ProductRecord = {
      id: editId ?? generateSafeUUID(), name: draft.name.trim(), arabicName: draft.arabicName.trim(), category: draft.category,
      price: Number(draft.price), cost: draft.cost.trim() ? Number(draft.cost) : undefined, description: draft.description.trim(),
      image: draft.image, available: draft.available, availableForTakeaway: draft.availableForTakeaway, visible: draft.visible,
      customizations: draft.customizations.map((item) => ({ ...item, choices: item.choices.map((choice) => ({ ...choice })) })),
    };
    try {
      await productRepository.save(product);
      router.push("/products");
    } catch (error) {
      const detail = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? ["message", "details", "hint"].map((key) => String((error as Record<string, unknown>)[key] ?? "").trim()).filter(Boolean).join(" — ")
          : String(error);
      setNotice(detail || pick("Could not save product. Please try again.", "تعذر حفظ المنتج. حاول مرة أخرى."));
      window.setTimeout(() => setNotice(""), 5000);
    }
  };

  const uploadImage = (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setNotice("حجم الصورة يجب ألا يتجاوز 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") update("image", reader.result); };
    reader.readAsDataURL(file);
  };

  const saveCategory = () => {
    const value = categoryDraft.trim();
    if (!value) return;
    setCategories((current) => current.includes(value) ? current : [...current, value]);
    update("category", value);
    setCategoryDraft("");
    setCategoryModal(false);
  };

  const openCustomization = (item?: Customization) => {
    setEditingCustomizationId(item?.id ?? null); setGroupName(item?.name ?? ""); setGroupArabicName(item?.arabicName ?? ""); setGroupRequired(item?.required ?? false);
    setGroupChoices(item ? item.choices.map((choice) => ({ ...choice })) : []); setChoiceDraft(""); setChoiceArabicDraft(""); setChoicePriceDraft(""); setCustomizationModal(true);
  };
  const addChoice = () => { const name = choiceDraft.trim() || choiceArabicDraft.trim(); if (!name) return; const choice = { name, arabicName: choiceArabicDraft.trim() || name, price: Math.max(0, Number(choicePriceDraft) || 0) }; setGroupChoices((current) => current.some((item) => item.name === name) ? current.map((item) => item.name === name ? choice : item) : [...current, choice]); setChoiceDraft(""); setChoiceArabicDraft(""); setChoicePriceDraft(""); };
  const saveCustomization = () => {
    const pending = choiceDraft.trim() || choiceArabicDraft.trim();
    const choices = pending ? [...groupChoices.filter((choice) => choice.name !== pending), { name: pending, arabicName: choiceArabicDraft.trim() || pending, price: Math.max(0, Number(choicePriceDraft) || 0) }] : groupChoices;
    if (!(groupName.trim() || groupArabicName.trim()) || !choices.length) return;
    const item: Customization = { id: editingCustomizationId ?? generateSafeUUID(), name: groupName.trim() || groupArabicName.trim(), arabicName: groupArabicName.trim() || groupName.trim(), required: groupRequired, choices };
    update("customizations", editingCustomizationId ? draft.customizations.map((current) => current.id === editingCustomizationId ? item : current) : [...draft.customizations, item]);
    setCustomizationModal(false);
  };
  const hasSugar = draft.customizations.some((item) => item.id === "sugar-level");
  const toggleSugar = () => update("customizations", hasSugar ? draft.customizations.filter((item) => item.id !== "sugar-level") : [...draft.customizations, { id: "sugar-level", name: "Sugar Level", arabicName: "مستوى السكر", choices: [{ name: "None", arabicName: "بدون", price: 0 }, { name: "Low", arabicName: "قليل", price: 0 }, { name: "Medium", arabicName: "متوسط", price: 0 }, { name: "Extra", arabicName: "إضافي", price: 5 }], required: false }]);

  return (
    <div className="min-h-screen p-4 sm:p-6 xl:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4"><Link href="/products" className="grid size-10 place-items-center rounded-full border border-white/20 bg-white/[.04] text-xl text-white/70 hover:border-[var(--gold)] hover:text-[var(--gold)]">←</Link><div><h1 className="font-serif text-3xl">{isEditMode ? pick("Edit Product", "تعديل المنتج") : pick("Add New Product", "إضافة منتج جديد")}</h1><p className="mt-1 text-sm text-white/45">{isEditMode ? pick("Update this menu item", "تحديث بيانات هذا المنتج") : pick("Create a new menu item for your café", "إنشاء منتج جديد في قائمة الكافيه")}</p></div></div>
        <div className="flex gap-3"><Link href="/products" className="rounded-lg border border-white/20 px-5 py-2.5 text-sm text-white/70">{pick("Cancel", "إلغاء")}</Link><button type="button" disabled={loadingProduct} onClick={() => void saveProduct()} className="rounded-lg bg-[#eab454] px-5 py-2.5 text-sm font-semibold text-[#1a1308] disabled:cursor-wait disabled:opacity-50">▣　{loadingProduct ? pick("Loading…", "جاري التحميل…") : isEditMode ? pick("Update Product", "تحديث المنتج") : pick("Save Product", "حفظ المنتج")}</button></div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-5">
          <section className="rounded-2xl border border-white/15 bg-[#111312] p-5 shadow-xl">
            <h2 className="mb-5 font-serif text-xl">▤　{pick("Product Details", "تفاصيل المنتج")}</h2>
            <div className="grid gap-6 lg:grid-cols-[255px_minmax(0,1fr)]">
              <div><div className="relative aspect-square overflow-hidden rounded-xl border border-white/15 bg-black/30"><Image src={draft.image || "/images/manager-hero.png"} alt="Product" fill sizes="(min-width: 1280px) 24vw, (min-width: 768px) 38vw, 100vw" className="object-cover" /></div><label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-[var(--gold)]/70 py-2.5 text-sm text-[var(--gold)]">↥　{pick("Upload Image", "رفع صورة")}<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event.target.files?.[0])} /></label><p className="mt-2 text-center text-[10px] text-white/40">{pick("JPG, PNG or WebP · Max 5MB · 1:1 recommended", "JPG أو PNG أو WebP · بحد أقصى 5MB · يفضّل مقاس 1:1")}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={pick("Arabic Name", "الاسم بالعربية")} required attempted={attempted} invalid={errors.arabicName} value={draft.arabicName} onChange={(value) => update("arabicName", value)} dir="rtl" />
                <Field label={pick("Product Name (English)", "اسم المنتج بالإنجليزية")} optional value={draft.name} onChange={(value) => update("name", value)} dir="ltr" />
                <label className="text-xs text-white/70">{pick("Category", "الفئة")} *<select value={draft.category} onChange={(event) => { if (event.target.value === "__add__") setCategoryModal(true); else update("category", event.target.value); }} className={`mt-2 w-full rounded-lg border bg-[#0d0f0e] px-3 py-2.5 text-sm text-white outline-none ${attempted && errors.category ? "border-red-400/70" : "border-white/15"}`}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}<option value="__add__">＋ {pick("Add category", "إضافة فئة")}</option></select>{attempted && errors.category && <small className="mt-1 block text-red-300">{pick("This field is required", "هذا الحقل مطلوب")}</small>}</label>
                <Field label={pick("Base Price", "السعر الأساسي")} required attempted={attempted} invalid={errors.price} value={draft.price} onChange={(value) => update("price", value)} suffix="EGP" type="number" />
                <Field label={pick("Cost Price", "سعر التكلفة")} optional value={draft.cost} onChange={(value) => update("cost", value)} suffix="EGP" type="number" />
                <label className="text-xs text-white/70 sm:col-span-2">{pick("Description", "الوصف")} <span className="text-white/35">— {pick("optional", "اختياري")}</span><textarea value={draft.description} onChange={(event) => update("description", event.target.value)} maxLength={250} className="mt-2 min-h-20 w-full resize-none rounded-lg border border-white/15 bg-[#0d0f0e] px-3 py-2.5 text-sm text-white outline-none" /><span className="float-right text-[10px] text-white/40">{draft.description.length}/250</span></label>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/15 bg-[#111312] p-5"><h2 className="font-serif text-xl">{pick("Customer Customizations", "تخصيصات العميل")}</h2><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={toggleSugar} className={`rounded-lg border px-3 py-2.5 text-sm ${hasSugar ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[#f5ca72]" : "border-dashed border-[var(--gold)]/70 text-[var(--gold)]"}`}>{hasSugar ? pick("✓ Sugar Level added", "✓ تمت إضافة مستوى السكر") : pick("＋ Add Sugar Level", "＋ إضافة مستوى السكر")}</button><button type="button" onClick={() => openCustomization()} className="rounded-lg border border-dashed border-[var(--gold)]/70 py-2.5 text-sm text-[var(--gold)]">＋ {pick("Add customization", "إضافة تخصيص")}</button></div>{draft.customizations.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{draft.customizations.map((item) => <CustomizationCard key={item.id} item={item} onEdit={() => openCustomization(item)} onDelete={() => update("customizations", draft.customizations.filter((current) => current.id !== item.id))} />)}</div> : <p className="mt-5 rounded-lg border border-white/10 bg-white/[.02] p-5 text-center text-sm text-white/40">{pick("No customization groups added. This product can be ordered as-is.", "لم تتم إضافة مجموعات تخصيص. يمكن طلب المنتج كما هو.")}</p>}</section>
        </section>

        <ProductPreview draft={draft} />
      </div>


      {categoryModal && <Modal onClose={() => setCategoryModal(false)} title={pick("Add Category", "إضافة فئة")} subtitle={pick("Create a category for your menu", "أنشئ فئة جديدة لقائمة الكافيه")}><input autoFocus value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCategory(); }} placeholder={pick("e.g. Fresh Juices", "مثال: عصائر طازجة")} className="mt-5 w-full rounded-lg border border-white/15 bg-[#0d0f0e] px-3 py-2.5 text-sm text-white outline-none" /><ModalActions onCancel={() => setCategoryModal(false)} onSave={saveCategory} disabled={!categoryDraft.trim()} saveLabel={pick("Add Category", "إضافة الفئة")} /></Modal>}
      {customizationModal && <Modal onClose={() => setCustomizationModal(false)} title={editingCustomizationId ? pick("Edit Customization", "تعديل التخصيص") : pick("Add Customization", "إضافة تخصيص")} subtitle={pick("Enter English and Arabic labels separately; no automatic translation", "أدخل الاسم بالعربية والإنجليزية بشكل مستقل؛ بدون ترجمة تلقائية")}><Field label={pick("Group name (English)", "اسم المجموعة (إنجليزي)")} value={groupName} onChange={setGroupName} dir="ltr" optional /><Field label={pick("Group name (Arabic)", "اسم المجموعة (عربي)")} value={groupArabicName} onChange={setGroupArabicName} dir="rtl" optional /><Toggle label={pick("Required setting", "اختيار مطلوب")} value={groupRequired} onChange={setGroupRequired} /><div className="mt-4 space-y-2">{groupChoices.map((choice) => <div key={choice.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d0f0e] px-3 py-2 text-sm"><span>{choice.name}{choice.arabicName && choice.arabicName !== choice.name ? ` · ${choice.arabicName}` : ""}</span><span className="ml-auto mr-4 text-xs text-[#f5ca72]">{choice.price ? `+${choice.price} EGP` : pick("Free", "مجاني")}</span><button type="button" onClick={() => setGroupChoices((current) => current.filter((item) => item.name !== choice.name))} className="text-white/40 hover:text-red-300">×</button></div>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]"><input value={choiceDraft} onChange={(event) => setChoiceDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChoice(); } }} placeholder={pick("Choice name (English)", "اسم الاختيار (إنجليزي)")} className="min-w-0 rounded-lg border border-white/15 bg-[#0d0f0e] px-3 py-2.5 text-sm text-white outline-none" /><input value={choiceArabicDraft} onChange={(event) => setChoiceArabicDraft(event.target.value)} placeholder={pick("Choice name (Arabic)", "اسم الاختيار (عربي)")} className="min-w-0 rounded-lg border border-white/15 bg-[#0d0f0e] bg-[#0d0f0e] px-3 py-2.5 text-sm text-white outline-none" dir="rtl" /><input type="number" min="0" value={choicePriceDraft} onChange={(event) => setChoicePriceDraft(event.target.value)} placeholder={pick("Price", "السعر")} className="min-w-0 rounded-lg border border-white/15 bg-[#0d0f0e] px-3 py-2.5 text-sm text-white outline-none" /><button type="button" onClick={addChoice} className="rounded-lg border border-[var(--gold)]/60 px-4 text-sm text-[var(--gold)]">＋ {pick("Add", "إضافة")}</button></div><p className="mt-2 text-[10px] text-white/40">{pick("Use 0 for a free choice. The selected price is added to the product base price.", "استخدم 0 للاختيار المجاني. يُضاف السعر المحدد إلى السعر الأساسي للمنتج.")}</p><ModalActions onCancel={() => setCustomizationModal(false)} onSave={saveCustomization} disabled={!(groupName.trim() || groupArabicName.trim()) || (!groupChoices.length && !choiceDraft.trim() && !choiceArabicDraft.trim())} saveLabel={pick("Save Customization", "حفظ التخصيص")} /></Modal>}
      {notice && <div role="status" className="manager-locale-toast fixed right-6 top-6 z-[90] rounded-xl border border-red-400/50 bg-[#2a1111] px-4 py-3 text-sm text-red-200">{notice}</div>}
    </div>
  );
}

function Field({ label, value, onChange, suffix, type = "text", dir, optional, required, attempted, invalid }: { label: string; value: string; onChange: (value: string) => void; suffix?: string; type?: string; dir?: "ltr" | "rtl"; optional?: boolean; required?: boolean; attempted?: boolean; invalid?: boolean }) {
  const { pick } = useManagerI18n();
  const showError = required && attempted && invalid;
  return <label className="mt-4 block text-xs text-white/70" dir={dir}>{label}{required && " *"}{optional && <span className="text-white/35"> — {pick("optional", "اختياري")}</span>}<span className="relative mt-2 block"><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={`w-full rounded-lg border bg-[#0d0f0e] px-3 py-2.5 text-sm text-white outline-none ${showError ? "border-red-400/70" : "border-white/15"}`} />{suffix && <span className="absolute right-3 top-2.5 text-white/45">{suffix}</span>}</span>{showError && <small className="mt-1 block text-red-300">{pick("This field is required", "هذا الحقل مطلوب")}</small>}</label>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { const { pick } = useManagerI18n(); return <button type="button" onClick={() => onChange(!value)} className="mt-4 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[.02] p-3 text-left"><span className="text-sm">{label}<small className="mt-1 block text-[10px] text-white/40">{pick("Available to customers", "متاح للعملاء")}</small></span><span className={`h-6 w-11 rounded-full p-1 transition ${value ? "bg-[#5ca66b]" : "bg-white/15"}`}><span className={`block size-4 rounded-full bg-white transition ${value ? "translate-x-5" : ""}`} /></span></button>; }

function CustomizationCard({ item, onEdit, onDelete }: { item: Customization; onEdit: () => void; onDelete: () => void }) { const { pick } = useManagerI18n(); return <article className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-start justify-between"><div><h3 className="font-serif text-lg">{pick(item.name, item.arabicName || item.name)}</h3><div className="mt-2 flex gap-2"><span className="rounded bg-white/10 px-2 py-1 text-[10px]">{item.choices.length} {pick("choices", "اختيارات")}</span><span className="rounded bg-white/10 px-2 py-1 text-[10px]">{item.required ? pick("Required", "مطلوب") : pick("Optional", "اختياري")}</span></div></div><button type="button" onClick={onDelete} className="text-white/35 hover:text-red-300">×</button></div><div className="mt-4 flex flex-wrap gap-2">{item.choices.map((choice) => <span key={choice.name} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/65">{pick(choice.name, choice.arabicName || choice.name)}{choice.price > 0 && <b className="ml-1 text-[#f5ca72]">+{choice.price} EGP</b>}</span>)}</div><button type="button" onClick={onEdit} className="mt-4 w-full rounded-lg border border-[var(--gold)]/50 py-2 text-xs text-[var(--gold)]">⚙ {pick("Edit choices", "تعديل الاختيارات")}</button></article>; }

function ProductPreview({ draft }: { draft: ProductDraft }) { const { pick } = useManagerI18n(); return <aside className="h-fit rounded-2xl border border-white/15 bg-[#111312] p-5"><h2 className="font-serif text-xl">◉　{pick("Customer Preview", "معاينة العميل")}</h2><div className="relative mt-4 aspect-[1.2] overflow-hidden rounded-xl border border-white/15"><Image src={draft.image || "/images/manager-hero.png"} alt={pick("Preview", "معاينة")} fill className="object-cover" /></div><h3 className="mt-4 font-serif text-2xl">{draft.arabicName && draft.name ? `${draft.arabicName} · ${draft.name}` : draft.arabicName || draft.name || pick("Product name", "اسم المنتج")}</h3>{draft.description && <p className="mt-2 text-sm leading-6 text-white/55">{draft.description}</p>}<p className="mt-2 text-xl text-[#eab454]">{(Number(draft.price) || 0).toLocaleString()} EGP</p><div className="my-4 space-y-5 border-t border-white/10 pt-4">{draft.customizations.length ? draft.customizations.map((item) => <div key={item.id}><div className="mb-2 flex items-center justify-between"><p className="text-sm">{pick(item.name, item.arabicName || item.name)}</p><span className="text-[10px] text-white/40">{item.required ? pick("Required", "مطلوب") : pick("Optional", "اختياري")}</span></div><div className="flex flex-wrap gap-2">{item.choices.map((choice, index) => <span key={choice.name} className={index === 0 ? "rounded-lg border border-[var(--gold)] bg-[var(--gold)]/15 px-3 py-1.5 text-xs text-[#f5ca72]" : "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60"}>{pick(choice.name, choice.arabicName || choice.name)}{choice.price > 0 && ` +${choice.price} EGP`}</span>)}</div></div>) : <p className="text-sm text-white/45">{pick("No customizations for this product.", "لا توجد تخصيصات لهذا المنتج.")}</p>}</div></aside>; }

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={onClose}><div className="w-full max-w-lg rounded-2xl border border-[var(--gold)]/60 bg-[#151615] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><h2 className="font-serif text-xl">{title}</h2><p className="mt-1 text-xs text-white/45">{subtitle}</p></div><button type="button" onClick={onClose} className="text-xl text-white/60">×</button></div>{children}</div></div>; }
function ModalActions({ onCancel, onSave, disabled, saveLabel }: { onCancel: () => void; onSave: () => void; disabled: boolean; saveLabel: string }) { const { pick } = useManagerI18n(); return <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4"><button type="button" onClick={onCancel} className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/65">{pick("Cancel", "إلغاء")}</button><button type="button" onClick={onSave} disabled={disabled} className="rounded-lg bg-[#eab454] px-5 py-2 text-sm font-semibold text-[#1a1308] disabled:opacity-40">{saveLabel}</button></div>; }

"use client";

import { ResilientImage } from "@/shared/presentation/components/resilient-image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProductRecord } from "@/features/products/application/ports/product-repository";
import { productRepository } from "@/shared/infrastructure/product-services";
import { useManagerSettings } from "@/shared/presentation/providers/manager-settings-provider";
import { useManagerI18n } from "@/shared/i18n/use-manager-i18n";

type CategoryFilter = string;

let productCatalogCache: readonly ProductRecord[] = [];

const categoryLabels: Record<string, [string, string]> = {
  All: ["All", "الكل"], Coffee: ["Coffee", "القهوة"], "Cold Drinks": ["Cold Drinks", "المشروبات الباردة"], Bakery: ["Bakery", "المخبوزات"],
};

function categoryOf(category: string): string {
  if (category === "Hot Coffee") return "Coffee";
  if (category === "Cold Drinks") return "Cold Drinks";
  if (category === "Bakery" || category === "Desserts") return "Bakery";
  if (!categoryLabels[category]) categoryLabels[category] = [category, category];
  return category;
}

function labelsFor(category: string): [string, string] {
  return categoryLabels[category] ?? [category, category];
}

export function ProductCatalog() {
  const { settings } = useManagerSettings();
  const { locale, pick } = useManagerI18n();
  const currency = settings.currency.split(" ")[0] || "EGP";
  const router = useRouter();
  const [records, setRecords] = useState<readonly ProductRecord[]>(productCatalogCache);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);

  useEffect(() => {
    const load = () => void productRepository.list().then((nextRecords) => {
      productCatalogCache = nextRecords;
      setRecords(nextRecords);
      setLoadError("");
    }).catch(() => {
      setLoadError("تعذر تحميل المنتجات. تحقق من الاتصال والحساب ثم أعد المحاولة.");
    });
    load();
    const unsubscribe = productRepository.subscribe(load);
    return () => { unsubscribe(); };
  }, []);

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return records.filter((product) => {
      const categoryMatches = activeCategory === "All" || categoryOf(product.category) === activeCategory;
      const searchMatches = !search || `${product.name} ${product.arabicName} ${product.category}`.toLocaleLowerCase().includes(search);
      return categoryMatches && searchMatches;
    });
  }, [activeCategory, query, records]);

  const availableCategories = useMemo(() => ["All", ...Array.from(new Set(records.map((product) => categoryOf(product.category))))], [records]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await productRepository.delete(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <main className="manager-page products-page min-h-screen overflow-x-hidden bg-[#080a09] pl-16 text-[#f4efe5] lg:pl-[184px] xl:pl-[200px] 2xl:pl-[224px]">
      <div className="min-h-screen p-4 sm:p-6 xl:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="font-serif text-4xl text-[#f4efe5]">{pick("Products & Menu", "المنتجات والقائمة")}</h1></div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <label className="flex min-w-52 max-w-lg flex-1 items-center gap-3 rounded-xl border border-white/20 bg-[#111312] px-4 py-3 text-sm text-white/45">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder={pick("Search products...", "ابحث عن منتج...")} /></label>
            <button type="button" onClick={() => router.push("/products?new=1")} className="min-w-44 rounded-xl bg-[#eab454] px-6 py-3 text-sm font-semibold text-[#1a1308] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(234,180,84,.22)]">＋ {pick("Add Product", "إضافة منتج")}</button>
          </div>
        </header>

        <div className="mt-7 flex flex-wrap gap-3">
          {availableCategories.map((category) => { const [english, arabic] = labelsFor(category); const active = activeCategory === category; return <button type="button" key={category} onClick={() => setActiveCategory(category)} className={`rounded-xl border px-6 py-2.5 text-sm transition hover:-translate-y-0.5 ${active ? "border-[var(--gold)] bg-[var(--gold)]/20 text-[#f5ca72]" : "border-white/15 bg-white/[.03] text-white/75"}`}>{locale === "ar" ? arabic : english}</button>; })}
        </div>
        {loadError && <div role="alert" className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"><span>{loadError}</span><button type="button" onClick={() => { void productRepository.list().then((nextRecords) => { productCatalogCache = nextRecords; setRecords(nextRecords); setLoadError(""); }).catch(() => undefined); }} className="rounded-lg border border-red-300/40 px-3 py-1.5 text-xs">إعادة المحاولة</button></div>}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_285px]">
          <section className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product, index) => <ProductCard key={product.id} product={product} currency={currency} priority={index === 0} onPreview={() => setSelectedProduct(product)} onEdit={() => router.push(`/products?new=1&edit=${encodeURIComponent(product.id)}`)} onDelete={() => setDeleteTarget(product)} onToggleAvailability={() => void productRepository.updateAvailability(product.id, !product.available)} />)}
            {!filteredProducts.length && <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/45">{pick("No products match your search.", "لا توجد منتجات مطابقة لبحثك.")}</div>}
          </section>
          <CategorySummary products={filteredProducts} />
        </div>
      </div>
      {selectedProduct && <ProductPreviewModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
      {deleteTarget && <DeleteProductDialog product={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
    </main>
  );
}

function ProductCard({ product, currency, priority, onPreview, onEdit, onDelete, onToggleAvailability }: { product: ProductRecord; currency: string; priority: boolean; onPreview: () => void; onEdit: () => void; onDelete: () => void; onToggleAvailability: () => void }) {
  const { pick } = useManagerI18n();
  const category = categoryOf(product.category);
  return (
    <article onClick={onPreview} className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--gold)]/45 bg-[#111312] transition duration-300 hover:-translate-y-1 hover:border-[var(--gold)] hover:shadow-[0_12px_28px_rgba(224,160,32,.12)]">
      <div className="relative aspect-[1.12] overflow-hidden"><ResilientImage src={product.image} fallbackSrc={`/images/products/${product.id}.webp`} alt={product.name || product.arabicName} fill sizes="(min-width: 1536px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" priority={priority} className="object-cover transition duration-500 group-hover:scale-105" /><button type="button" aria-label={`Delete ${product.name}`} onClick={(event) => { event.stopPropagation(); onDelete(); }} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/30 bg-black/60 text-xl text-white transition hover:border-red-300 hover:text-red-300">×</button></div>
      <div className="p-4">
        <h2 className="font-serif text-xl">{product.arabicName}</h2>{product.name && <p className="mt-0.5 text-xs text-white/55">{product.name}</p>}
        <p className="mt-2 text-xs text-white/50">☕ {labelsFor(category)[0]}　{labelsFor(category)[1]}</p><p className="mt-3 text-lg text-[#eab454]">{currency} {product.price.toFixed(2)}</p>
        <button type="button" onClick={(event) => { event.stopPropagation(); onToggleAvailability(); }} className={`mt-3 flex w-full items-center justify-between border-t border-white/10 pt-3 text-xs transition ${product.available ? "text-[#9ce5ad]" : "text-white/45"}`}><span>● {product.available ? pick("Available", "متوفر") : pick("Out of stock", "غير متوفر")}</span><span className={`h-5 w-9 rounded-full p-0.5 ${product.available ? "bg-[#5ca66b]" : "bg-white/20"}`}><span className={`block size-4 rounded-full bg-white transition ${product.available ? "translate-x-4" : ""}`} /></span></button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="mt-4 w-full rounded-lg border border-[var(--gold)]/45 bg-[var(--gold)]/[.06] py-2.5 text-sm text-[#f5ca72] transition hover:border-[var(--gold)] hover:bg-[var(--gold)]/[.12]">✎ {pick("Edit Product", "تعديل المنتج")}</button>
      </div>
    </article>
  );
}

function CategorySummary({ products }: { products: readonly ProductRecord[] }) {
  const { locale, pick } = useManagerI18n();
  const categories = Array.from(new Set(products.map((product) => categoryOf(product.category))));
  const count = (category: string) => products.filter((product) => categoryOf(product.category) === category).length;
  return <aside className="h-fit rounded-2xl border border-white/15 bg-[#111312] p-5"><h2 className="font-serif text-xl">◔　{pick("Categories Summary", "ملخص الفئات")}</h2><div className="my-4 border-t border-white/10" />{categories.map((category) => <div key={category} className="flex items-center justify-between border-b border-white/10 py-4 last:border-0"><span><b>{labelsFor(category)[locale === "ar" ? 1 : 0]}</b></span><strong className="text-xl text-[#eab454]">{count(category)}</strong></div>)}<div className="mt-4 flex justify-between border-t border-white/10 pt-4"><span>{pick("Total Products", "إجمالي المنتجات")}</span><strong className="text-xl text-[#eab454]">{products.length}</strong></div></aside>;
}

function ProductPreviewModal({ product, onClose }: { product: ProductRecord; onClose: () => void }) {
  const { pick } = useManagerI18n();
  const category = categoryOf(product.category);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={`${product.name || product.arabicName} preview`} onClick={onClose}><article className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--gold)]/60 bg-[#151615] shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="relative aspect-[1.15]"><ResilientImage src={product.image} fallbackSrc={`/images/products/${product.id}.webp`} alt={product.name || product.arabicName} fill className="object-cover" /><button type="button" onClick={onClose} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/25 bg-black/60 text-xl text-white">×</button></div><div className="p-6"><p className="text-xs uppercase tracking-[.2em] text-[var(--gold)]">{labelsFor(category)[0]}　{labelsFor(category)[1]}</p><h2 className="mt-2 font-serif text-3xl">{product.arabicName}</h2>{product.name && <p className="mt-1 text-sm text-white/50">{product.name}</p>}{product.description && <p className="mt-3 text-sm leading-6 text-white/65">{product.description}</p>}<p className="mt-4 text-2xl text-[#eab454]">EGP {product.price.toFixed(2)}</p><div className="my-5 space-y-5 border-t border-white/10 pt-4">{product.customizations?.length ? product.customizations.map((customization) => <div key={customization.id}><div className="mb-3 flex items-center justify-between"><p className="text-sm text-white/75">{customization.name}</p><small className="text-white/40">{customization.required ? pick("Required", "مطلوب") : pick("Optional", "اختياري")}</small></div><div className="flex flex-wrap gap-2">{customization.choices.map((choice, index) => <span key={choice.name} className={index === 0 ? "rounded-full border border-[var(--gold)] bg-[var(--gold)]/15 px-3 py-1.5 text-xs text-[#f5ca72]" : "rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65"}>{choice.name}{choice.price > 0 && ` +${choice.price} EGP`}</span>)}</div></div>) : <p className="text-sm text-white/45">{pick("No customizations for this product.", "لا توجد تخصيصات لهذا المنتج.")}</p>}</div><div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] p-3"><span className={product.available ? "text-[#9ce5ad]" : "text-white/45"}>● {product.available ? pick("Available", "متوفر") : pick("Out of stock", "غير متوفر")}</span><button type="button" onClick={onClose} className="rounded-lg bg-[#eab454] px-4 py-2 text-sm font-semibold text-[#1a1308]">{pick("Close", "إغلاق")}</button></div></div></article></div>;
}

function DeleteProductDialog({ product, onCancel, onConfirm }: { product: ProductRecord; onCancel: () => void; onConfirm: () => void }) {
  const { pick } = useManagerI18n();
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4" role="alertdialog" aria-modal="true"><div className="w-full max-w-sm rounded-2xl border border-red-300/40 bg-[#171513] p-6 text-center shadow-2xl"><div className="mx-auto grid size-14 place-items-center rounded-full bg-red-400/10 text-2xl text-red-300">×</div><h2 className="mt-4 font-serif text-2xl">{pick("Delete Product?", "حذف المنتج؟")}</h2><p className="mt-2 text-sm text-white/55">{pick("Are you sure you want to delete", "هل تريد بالتأكيد حذف")} <b className="text-white">{product.arabicName || product.name}</b>؟</p><div className="mt-6 flex gap-3"><button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm text-white/70">{pick("No, keep it", "لا، احتفظ به")}</button><button type="button" onClick={onConfirm} className="flex-1 rounded-lg bg-red-500/80 py-2.5 text-sm font-semibold text-white">{pick("Yes, delete", "نعم، احذف")}</button></div></div></div>;
}

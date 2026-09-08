import type { ProductRecord, ProductRepository } from "../application/ports/product-repository";
import { getSupabaseBrowserClient } from "@/shared/infrastructure/supabase/supabase-browser";
import { getManagerCafeId } from "@/shared/infrastructure/supabase/supabase-cafe-settings";
import { generateSafeUUID } from "@/shared/utils/uuid";
import type { RealtimeChannel } from "@supabase/supabase-js";
type ChoiceRow = { id: string; name: string; name_ar: string; price_delta: number; sort_order: number };
type GroupRow = { id: string; name: string; name_ar: string; is_required: boolean; sort_order: number; modifier_options: ChoiceRow[] | null };
type LinkRow = { product_id: string; group_id: string; sort_order: number; modifier_groups: GroupRow | null };
type ProductRow = { id: string; slug: string; name: string; name_ar: string; category_id: string | null; base_price: number; cost_price: number | null; image_url: string | null; availability: string; available_for_takeaway: boolean; description: string | null; menu_categories: { name: string; name_ar: string } | null };

function slugify(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-|-$/g, "") || `item-${generateSafeUUID()}`; }

async function persistProductImage(db: ReturnType<typeof getSupabaseBrowserClient>, image: string, productId: string, cafeId: string): Promise<string | null> {
  if (!image) return null;
  if (!image.startsWith("data:image/")) return image;
  const response = await fetch(image);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "webp";
  const path = `${cafeId}/${productId}/${generateSafeUUID()}.${extension}`;
  const upload = await db!.storage.from("product-images").upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (upload.error) throw upload.error;
  return db!.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export class SupabaseProductRepository implements ProductRepository {
  private listeners = new Set<() => void>();
  private channel: RealtimeChannel | null = null;
  private channelCafeId: string | null = null;

  private async ensureRealtime(cafeId: string) {
    if (this.channel && this.channelCafeId === cafeId) return;
    const db = getSupabaseBrowserClient();
    if (!db) return;
    if (this.channel) await db.removeChannel(this.channel);
    this.channelCafeId = cafeId;
    this.channel = db.channel(`products-live:${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_products", filter: `cafe_id=eq.${cafeId}` }, () => this.listeners.forEach((listener) => listener()))
      .subscribe();
  }

  async list() {
    const db = getSupabaseBrowserClient(); if (!db) throw new Error("Supabase is not configured");
    const cafeId = await getManagerCafeId();
    void this.ensureRealtime(cafeId);
    const products = await db.from("menu_products").select("id,slug,name,name_ar,category_id,base_price,cost_price,image_url,availability,available_for_takeaway,description,menu_categories(name,name_ar)").eq("cafe_id", cafeId).order("created_at", { ascending: false });
    if (products.error) throw products.error;
    const productIds = (products.data ?? []).map((product) => product.id);
    const links = productIds.length
      ? await db.from("product_modifier_groups").select("product_id,group_id,sort_order,modifier_groups(id,name,name_ar,is_required,sort_order,modifier_options(id,name,name_ar,price_delta,sort_order))").in("product_id", productIds)
      : { data: [], error: null };
    if (links.error) throw links.error;
    const groupsByProduct = new Map<string, LinkRow[]>();
    for (const link of (links.data ?? []) as unknown as LinkRow[]) groupsByProduct.set(link.product_id, [...(groupsByProduct.get(link.product_id) ?? []), link]);
    return ((products.data ?? []) as unknown as ProductRow[]).map((row) => ({
      id: row.id, name: row.name, arabicName: row.name_ar ?? "", category: row.menu_categories?.name ?? "", price: Number(row.base_price || 0), cost: row.cost_price == null ? undefined : Number(row.cost_price), image: row.image_url ?? "", available: row.availability === "available", availableForTakeaway: row.available_for_takeaway !== false, visible: row.availability !== "hidden", description: row.description ?? undefined,
      customizations: (groupsByProduct.get(row.id) ?? []).sort((a, b) => a.sort_order - b.sort_order).flatMap((link) => link.modifier_groups ? [{ id: link.modifier_groups.id, name: link.modifier_groups.name, arabicName: link.modifier_groups.name_ar ?? undefined, required: link.modifier_groups.is_required, choices: (link.modifier_groups.modifier_options ?? []).sort((a, b) => a.sort_order - b.sort_order).map((choice) => ({ name: choice.name, arabicName: choice.name_ar ?? undefined, price: Number(choice.price_delta || 0) })) }] : []),
    })) satisfies ProductRecord[];
  }

  async listCategories() {
    const db = getSupabaseBrowserClient(); if (!db) throw new Error("Supabase is not configured");
    const cafeId = await getManagerCafeId();
    const result = await db.from("menu_categories").select("name").eq("cafe_id", cafeId).eq("is_active", true).order("sort_order");
    if (result.error) throw result.error;
    return [...new Set((result.data ?? []).map((category) => category.name).filter(Boolean))];
  }

  async getById(id: string) { return (await this.list()).find((product) => product.id === id) ?? null; }
  async getByName(name: string) { return (await this.list()).find((product) => product.name.toLowerCase() === name.toLowerCase()) ?? null; }

  async save(product: ProductRecord) {
    const db = getSupabaseBrowserClient(); if (!db) throw new Error("Supabase is not configured");
    const cafeId = await getManagerCafeId();
    const imageUrl = await persistProductImage(db, product.image, product.id, cafeId);
    const categoryName = product.category.trim();
    const category = categoryName ? await db.from("menu_categories").select("id").eq("cafe_id", cafeId).eq("name", categoryName).maybeSingle() : { data: null, error: null };
    if (category.error) throw category.error;
    let categoryId = category.data?.id ?? null;
    if (categoryName && !categoryId) { const created = await db.from("menu_categories").insert({ cafe_id: cafeId, code: slugify(categoryName), name: categoryName, name_ar: categoryName, sort_order: 999 }).select("id").single(); if (created.error) throw created.error; categoryId = created.data.id; }
    const { error } = await db.from("menu_products").upsert({ id: product.id, cafe_id: cafeId, category_id: categoryId, slug: slugify(product.name || product.arabicName), name: product.name || product.arabicName, name_ar: product.arabicName || product.name, base_price: product.price, cost_price: product.cost ?? null, image_url: imageUrl, availability: product.visible === false ? "hidden" : product.available ? "available" : "unavailable", available_for_takeaway: product.availableForTakeaway !== false, description: product.description || null, allows_notes: true, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    const oldLinks = await db.from("product_modifier_groups").delete().eq("product_id", product.id); if (oldLinks.error) throw oldLinks.error;
    for (const [groupIndex, group] of (product.customizations ?? []).entries()) {
      const groupName = group.name.trim() || group.arabicName?.trim() || "Option";
      const groupNameAr = group.arabicName?.trim() || groupName;
      const isSugarGroup = group.id === "sugar-level" || groupName.toLocaleLowerCase() === "sugar level" || groupName === "مستوى السكر" || groupNameAr === "مستوى السكر";
      const groupResult = await db.from("modifier_groups").upsert({ cafe_id: cafeId, code: `${slugify(groupName)}-${product.id.slice(0, 8)}`, name: groupName, name_ar: groupNameAr, selection_type: isSugarGroup ? "slider" : "single", is_required: group.required, sort_order: groupIndex, is_active: true }, { onConflict: "cafe_id,code" }).select("id").single();
      if (groupResult.error) throw groupResult.error;
      const options = await db.from("modifier_options").upsert(group.choices.map((choice, index) => { const name = choice.name.trim() || choice.arabicName?.trim() || `Option ${index + 1}`; return { group_id: groupResult.data.id, code: `${slugify(name)}-${index}`, name, name_ar: choice.arabicName?.trim() || name, price_delta: choice.price, sort_order: index, is_available: true }; }), { onConflict: "group_id,code" });
      if (options.error) throw options.error;
      const link = await db.from("product_modifier_groups").insert({ product_id: product.id, group_id: groupResult.data.id, sort_order: groupIndex }); if (link.error) throw link.error;
    }
    this.listeners.forEach((listener) => listener());
  }

  async delete(id: string) { const db = getSupabaseBrowserClient(); if (!db) throw new Error("Supabase is not configured"); const { error } = await db.from("menu_products").delete().eq("id", id); if (error) throw error; this.listeners.forEach((listener) => listener()); }

  async updateAvailability(id: string, available: boolean) {
    const db = getSupabaseBrowserClient(); if (!db) throw new Error("Supabase is not configured");
    const result = await db.rpc("manager_set_product_availability", { p_product_id: id, p_available: available });
    if (result.error) throw result.error;
    this.listeners.forEach((listener) => listener());
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    void getManagerCafeId().then((cafeId) => this.ensureRealtime(cafeId)).catch(() => undefined);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size > 0 || !this.channel) return;
      const db = getSupabaseBrowserClient();
      const channel = this.channel;
      this.channel = null;
      this.channelCafeId = null;
      if (db) void db.removeChannel(channel);
    };
  }
}

import type { ProductRecord, ProductRepository } from "../application/ports/product-repository";

const seedProducts: ProductRecord[] = [
  { id: "cardamom-cappuccino", name: "Cardamom Cappuccino", arabicName: "كابتشينو بالهيل", category: "Coffee", price: 75, image: "/images/products/cardamom-cappuccino.webp", available: true },
  { id: "ice-mocha-deluxe", name: "Ice Mocha Deluxe", arabicName: "موكا مثلجة", category: "Coffee", price: 85, image: "/images/products/ice-mocha-deluxe.webp", available: true },
  { id: "cold-brew-reserve", name: "Cold Brew Reserve", arabicName: "كولد برو ريزيرف", category: "Cold Drinks", price: 80, image: "/images/products/cold-brew-reserve.webp", available: true },
  { id: "almond-croissant", name: "Almond Croissant", arabicName: "كرواسون باللوز", category: "Bakery", price: 65, image: "/images/products/lotus-cheesecake.webp", available: true },
  { id: "saffron-latte", name: "Saffron Latte", arabicName: "لاتيه بالزعفران", category: "Coffee", price: 90, image: "/images/products/cardamom-cappuccino.webp", available: true },
  { id: "coca-cola", name: "Coca-Cola", arabicName: "كوكاكولا", category: "Cold Drinks", price: 30, image: "/images/products/ice-mocha-deluxe.webp", available: true },
  { id: "matcha-latte", name: "Matcha Latte", arabicName: "ماتشا لاتيه", category: "Coffee", price: 85, image: "/images/products/cardamom-cappuccino.webp", available: true },
  { id: "cheesecake", name: "Cheesecake", arabicName: "تشيز كيك", category: "Bakery", price: 70, image: "/images/products/lotus-cheesecake.webp", available: false },
];

class InMemoryProductRepository implements ProductRepository {
  private products = seedProducts.map((product) => ({ ...product }));
  private listeners = new Set<() => void>();

  async list() { return this.products.map((product) => ({ ...product })); }
  async listCategories() { return [...new Set(this.products.map((product) => product.category).filter(Boolean))]; }
  async getById(id: string) {
    const key = normalizeKey(id);
    const product = this.products.find((item) => normalizeKey(item.id) === key);
    return product ? cloneProduct(product) : null;
  }
  async getByName(name: string) {
    const normalized = normalizeKey(name);
    const product = this.products.find((item) => normalizeKey(item.name) === normalized || normalizeKey(item.id) === normalized);
    return product ? cloneProduct(product) : null;
  }
  async save(product: ProductRecord) { this.products = [...this.products.filter((item) => item.id !== product.id), cloneProduct(product)]; this.listeners.forEach((listener) => listener()); }
  async delete(id: string) { const key = normalizeKey(id); this.products = this.products.filter((product) => normalizeKey(product.id) !== key && normalizeKey(product.name) !== key); this.listeners.forEach((listener) => listener()); }
  async updateAvailability(id: string, available: boolean) { const key = normalizeKey(id); this.products = this.products.map((product) => normalizeKey(product.id) === key || normalizeKey(product.name) === key ? { ...product, available } : product); this.listeners.forEach((listener) => listener()); }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function cloneProduct(product: ProductRecord): ProductRecord {
  return { ...product, customizations: product.customizations?.map((item) => ({ ...item, choices: item.choices.map((choice) => ({ ...choice })) })) };
}

export const productRepository: ProductRepository = new InMemoryProductRepository();

export type ProductRecord = {
  id: string;
  name: string;
  arabicName: string;
  category: string;
  categoryArabicName?: string;
  price: number;
  image: string;
  available: boolean;
  availableForTakeaway?: boolean;
  visible?: boolean;
  cost?: number;
  description?: string;
  customizations?: readonly {
    id: string;
    name: string;
    arabicName?: string;
    choices: readonly { name: string; arabicName?: string; price: number }[];
    required: boolean;
  }[];
};

export type ProductCategory = { name: string; arabicName: string };

export interface ProductRepository {
  list(): Promise<readonly ProductRecord[]>;
  listArchived(): Promise<readonly ProductRecord[]>;
  countArchived(): Promise<number>;
  listCategories(): Promise<readonly ProductCategory[]>;
  getById(id: string): Promise<ProductRecord | null>;
  getByName(name: string): Promise<ProductRecord | null>;
  save(product: ProductRecord): Promise<void>;
  delete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  updateAvailability(id: string, available: boolean): Promise<void>;
  subscribe(listener: () => void): () => void;
}

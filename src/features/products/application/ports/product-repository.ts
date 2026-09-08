export type ProductRecord = {
  id: string;
  name: string;
  arabicName: string;
  category: string;
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

export interface ProductRepository {
  list(): Promise<readonly ProductRecord[]>;
  listCategories(): Promise<readonly string[]>;
  getById(id: string): Promise<ProductRecord | null>;
  getByName(name: string): Promise<ProductRecord | null>;
  save(product: ProductRecord): Promise<void>;
  delete(id: string): Promise<void>;
  updateAvailability(id: string, available: boolean): Promise<void>;
  subscribe(listener: () => void): () => void;
}

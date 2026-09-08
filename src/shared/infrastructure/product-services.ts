import { SupabaseProductRepository } from "@/features/products/infrastructure/supabase-product-repository";
import { hasSupabaseConfig } from "./supabase/supabase-config";
if (!hasSupabaseConfig()) throw new Error("Supabase configuration is required for product data.");
export const productRepository = new SupabaseProductRepository();

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { productRepository } from "../src/features/products/infrastructure/in-memory-product-repository.ts";

test("product repository supports the complete local product lifecycle", async () => {
  const id = "test-arabic-only-product";
  await productRepository.save({ id, name: "", arabicName: "مشروب اختباري", category: "Fresh Juices", price: 42, cost: 18, image: "/images/products/cardamom-cappuccino.webp", available: true, availableForTakeaway: false, description: "Test description", customizations: [{ id: "size", name: "Size", choices: [{ name: "Small", price: 0 }, { name: "Large", price: 8 }], required: true }] });
  const created = await productRepository.getById(id);
  assert.equal(created?.arabicName, "مشروب اختباري");
  assert.equal(created?.name, "");
  assert.equal(created?.category, "Fresh Juices");
  assert.equal(created?.availableForTakeaway, false);
  assert.equal(created?.cost, 18);
  assert.equal(created?.customizations?.[0].choices[1].price, 8);
  await productRepository.save({ ...created!, price: 48, description: "Updated" });
  const updated = await productRepository.getById(id);
  assert.equal(updated?.price, 48);
  assert.equal(updated?.description, "Updated");
  assert.equal((await productRepository.list()).filter((product) => product.id === id).length, 1);
  await productRepository.updateAvailability(id, false);
  assert.equal((await productRepository.getById(id))?.available, false);
  await productRepository.delete(id);
  assert.equal(await productRepository.getById(id), null);
  assert.equal((await productRepository.listArchived()).some((product) => product.id === id), true);
  assert.equal(await productRepository.countArchived(), 1);
  await productRepository.restore(id);
  assert.equal((await productRepository.getById(id))?.available, false);
  assert.equal(await productRepository.countArchived(), 0);
});

test("product uploads enforce bounded dimensions and a 250 KB encoded image", () => {
  const repositorySource = readFileSync(fileURLToPath(new URL("../src/features/products/infrastructure/supabase-product-repository.ts", import.meta.url)), "utf8");
  assert.match(repositorySource, /PRODUCT_IMAGE_MAX_SOURCE_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/);
  assert.match(repositorySource, /PRODUCT_IMAGE_MAX_OUTPUT_BYTES\s*=\s*250\s*\*\s*1024/);
  assert.match(repositorySource, /PRODUCT_IMAGE_MAX_SIDE\s*=\s*1200/);
  assert.match(repositorySource, /canvasToWebp\(canvas, quality\)/);
  assert.match(repositorySource, /compressed\.size\s*<=\s*PRODUCT_IMAGE_MAX_OUTPUT_BYTES/);
  assert.match(repositorySource, /previousImagePath/);
  assert.match(repositorySource, /uploadedImagePath/);
});

test("production product removal archives the item instead of deleting sales history", () => {
  const repositorySource = readFileSync(fileURLToPath(new URL("../src/features/products/infrastructure/supabase-product-repository.ts", import.meta.url)), "utf8");
  assert.match(repositorySource, /rpc\("manager_archive_product"/);
  assert.match(repositorySource, /neq\("availability",\s*"hidden"\)/);
  assert.doesNotMatch(repositorySource, /from\("menu_products"\)\.delete\(\)/);
  assert.match(repositorySource, /rpc\("manager_restore_product"/);
});

test("product catalog protects archive, restore, and availability actions", () => {
  const catalog = readFileSync(fileURLToPath(new URL("../src/features/products/presentation/components/product-catalog.tsx", import.meta.url)), "utf8");
  assert.match(catalog, /availabilityPendingId/);
  assert.match(catalog, /restoreTarget/);
  assert.match(catalog, /Confirm restore/);
  assert.match(catalog, /Product archived successfully/);
  assert.match(catalog, /availabilityFilter/);
});

test("product editor uses an explicit bounded upload state instead of a fake default image", () => {
  const editor = readFileSync(fileURLToPath(new URL("../src/features/products/presentation/components/product-editor.tsx", import.meta.url)), "utf8");
  assert.match(editor, /MAX_SOURCE_IMAGE_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/);
  assert.match(editor, /MAX_PREVIEW_IMAGE_BYTES\s*=\s*250\s*\*\s*1024/);
  assert.match(editor, /Click to upload a product image/);
  assert.match(editor, /Change image/);
  assert.match(editor, /Remove/);
  assert.doesNotMatch(editor, /draft\.image \|\| "\/images\/manager-hero\.png"/);
});

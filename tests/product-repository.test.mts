import test from "node:test";
import assert from "node:assert/strict";
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
});

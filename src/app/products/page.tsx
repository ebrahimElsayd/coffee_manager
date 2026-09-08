"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCatalog } from "@/features/products/presentation/components/product-catalog";
import { ProductEditor } from "@/features/products/presentation/components/product-editor";
import { ManagerSidebar } from "@/shared/presentation/components/manager-sidebar";

function ProductsPage() {
  const searchParams = useSearchParams();
  const isEditorOpen = searchParams.get("new") === "1" || searchParams.has("edit");

  if (!isEditorOpen) return <><ManagerSidebar /><ProductCatalog /></>;

  return (
    <main className="manager-page products-page min-h-screen overflow-x-hidden bg-[#080a09] pl-16 text-[#f4efe5] lg:pl-[184px] xl:pl-[200px] 2xl:pl-[224px]">
      <ManagerSidebar />
      <ProductEditor editId={searchParams.get("edit")} />
    </main>
  );
}

export default function ProductsPageRoute() {
  return <Suspense fallback={<main className="min-h-screen bg-[#080a09]" />}><ProductsPage /></Suspense>;
}

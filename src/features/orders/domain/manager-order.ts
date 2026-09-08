import type { ManagerDrink, ManagerOrder } from "@/shared/application/ports/manager-data-source";

export type DrinkStatus = ManagerDrink["status"];
export type OrderStatus = ManagerOrder["status"];

export type Drink = ManagerOrder["drinks"][number] & {
  imageUrl?: string;
};

export type Order = Omit<ManagerOrder, "drinks"> & { drinks: Drink[] };

export type DrinkDetail = { label: string; value: string };

/** Dynamic customer choices first, with legacy fields as a temporary fallback. */
export function getDrinkDetails(drink: Drink, locale: "ar" | "en" = "en"): DrinkDetail[] {
  if (drink.selectedOptions?.length) {
    return drink.selectedOptions.map((option) => ({
      label: locale === "ar" ? option.groupLabelAr || option.groupLabel : option.groupLabel || option.groupLabelAr || "Option",
      value: locale === "ar" ? option.optionLabelAr || option.optionLabel : option.optionLabel || option.optionLabelAr || "Selected",
    }));
  }

  const legacyDetails: ReadonlyArray<readonly [string, string | undefined]> = [
    ["SIZE", drink.size],
    ["MILK", drink.milk],
    ["SUGAR", drink.sugar],
    ["EXTRAS", drink.extras],
    ["TEMP.", drink.temperature],
  ];
  return legacyDetails.flatMap(([label, value]) => value && value !== "None" ? [{ label, value }] : []);
}

export function mapManagerOrder(order: ManagerOrder): Order {
  return {
    ...order,
    drinks: order.drinks.map((drink) => ({ ...drink })),
  };
}

export function deriveOrderStatus(drinks: readonly Drink[], fallback: OrderStatus) {
  if (drinks.length === 0) return fallback;
  const billableDrinks = drinks.filter((drink) => drink.status !== "Cancelled");
  if (billableDrinks.length === 0) return "Cancelled";
  const activeDrinks = billableDrinks.filter((drink) => drink.status !== "Delivered");
  if (activeDrinks.length === 0) return "Delivered";
  if (activeDrinks.every((drink) => drink.status === "Ready")) return "Ready";
  if (activeDrinks.some((drink) => drink.status === "Preparing")) return "Preparing";
  if (activeDrinks.some((drink) => drink.status === "New")) return "New";
  return fallback;
}

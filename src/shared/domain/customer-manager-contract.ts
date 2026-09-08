/** Canonical data contract shared by the customer and manager applications. */
export type EntityId = string;

export type LocalizedLabel = { ar: string; en?: string };
export type Money = { amount: number; currency: string };

export type CustomizationChoice = { id: EntityId; label: LocalizedLabel; priceDelta: number };

export type CustomizationGroup = {
  id: EntityId;
  label: LocalizedLabel;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  choices: readonly CustomizationChoice[];
};

export type SelectedCustomization = {
  groupId: EntityId;
  groupLabel: LocalizedLabel;
  choiceId: EntityId;
  choiceLabel: LocalizedLabel;
  priceDelta: number;
};

export type CustomerMenuProduct = {
  id: EntityId;
  label: LocalizedLabel;
  categoryId: EntityId;
  description?: LocalizedLabel;
  basePrice: Money;
  imageUrl?: string;
  available: boolean;
  availableForTakeaway: boolean;
  customizations: readonly CustomizationGroup[];
};

export type CustomerOrderItem = {
  id: EntityId;
  productId: EntityId;
  productLabel: LocalizedLabel;
  recipientName?: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: readonly SelectedCustomization[];
  note?: string;
};

export type CustomerOrderSubmission = {
  orderType: "DineIn" | "Takeaway";
  tableId?: EntityId;
  customerName: string;
  guestCount?: number;
  items: readonly CustomerOrderItem[];
};

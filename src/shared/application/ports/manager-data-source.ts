export type DrinkWorkflowStatus = "New" | "Preparing" | "Ready" | "Delivered" | "Cancelled";
export type WorkflowStatus = DrinkWorkflowStatus | "Delivered";
export type TableStatus = DrinkWorkflowStatus | "Delivered" | "Available" | "Seated" | "Done";
export type OrderType = "DineIn" | "Takeaway";
export type PaymentStatus = "Unpaid" | "Paid" | "Refunded";
export type PaymentMethod = "Cash" | "Card" | "Wallet";
export type TableSessionStatus = "Open" | "Closed";

export type ProductCustomization = {
  id: string;
  name: string;
  arabicName?: string;
  choices: readonly { id?: string; name: string; price: number }[];
  required: boolean;
};

export type ManagerSelectedOption = {
  groupId?: string;
  groupLabel: string;
  groupLabelAr?: string;
  optionId?: string;
  optionLabel: string;
  optionLabelAr?: string;
  priceDelta?: number;
};

export interface ManagerDrink {
  id: string;
  productId?: string;
  name: string;
  imageUrl?: string;
  recipientName?: string;
  quantity: number;
  unitPrice: number;
  /** Legacy normalized fields; optional because products can have arbitrary options. */
  size?: string;
  milk?: string;
  sugar?: string;
  extras?: string;
  temperature?: string;
  note: string;
  /** Arbitrary choices submitted by the customer app (milk, sugar, toppings, etc.). */
  selectedOptions?: readonly ManagerSelectedOption[];
  status: DrinkWorkflowStatus;
  cancellationReason?: string;
}

export interface ManagerOrder {
  id: string;
  /** Stable table-session identity; never aggregate orders by table number alone. */
  sessionId?: string;
  orderNumber?: number;
  table: string;
  customer: string;
  time: string;
  /** ISO-ready opening timestamp once Supabase is connected. */
  openedAt?: string;
  /** Staff member who opened and owns this order. */
  cashierName?: string;
  guests: string;
  status: WorkflowStatus;
  drinks: ManagerDrink[];
  orderType: OrderType;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  cashReceived?: number;
  cashChange?: number;
  sessionStatus: TableSessionStatus;
  cashierId?: string;
  closedAt?: string;
  cancellationReason?: string;
}

export interface ManagerTable {
  number: string;
  guests: string;
  status: TableStatus;
  sessionId?: string;
  sessionStatus?: TableSessionStatus;
  openedAt?: string;
}

/** The UI depends on this port, never on a database SDK. */
export interface OrderRepository {
  listOrders(options?: { orderIds?: readonly string[]; table?: string }): Promise<readonly ManagerOrder[]>;
  updateOrderStatus(orderId: string, status: WorkflowStatus): Promise<void>;
  updateDrinkStatus(orderId: string, drinkId: string, status: DrinkWorkflowStatus): Promise<void>;
  cancelOrder(orderId: string, reason: string): Promise<void>;
  cancelDrink(orderId: string, drinkId: string, reason: string): Promise<void>;
}

export interface TableRepository {
  listTables(): Promise<readonly ManagerTable[]>;
  updateTableSession(table: string, status: TableSessionStatus, sessionId?: string): Promise<void>;
}

export interface PaymentRepository {
  updateTablePayment(table: string, status: PaymentStatus, method: PaymentMethod, receivedAmount?: number, changeAmount?: number, sessionId?: string): Promise<void>;
}

/** Backward-compatible aggregate boundary for current screens. */
export interface ManagerDataSource extends OrderRepository, TableRepository, PaymentRepository {
}

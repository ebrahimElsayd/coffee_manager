import type { DrinkWorkflowStatus, ManagerDataSource, PaymentMethod, WorkflowStatus } from "@/shared/application/ports/manager-data-source";
import type { CustomerNotificationService } from "@/features/notifications/application/ports/customer-notification-service";

/** Application operations used by both Dashboard and Orders. */
export class ManagerWorkflow {
  constructor(private readonly source: ManagerDataSource, private readonly notifications: CustomerNotificationService) {}

  updateDrinkStatus(orderId: string, drinkId: string, status: DrinkWorkflowStatus) {
    return this.source.updateDrinkStatus(orderId, drinkId, status);
  }

  updateOrderStatus(orderId: string, status: WorkflowStatus) {
    return this.source.updateOrderStatus(orderId, status);
  }

  markOrderReady(orderId: string) {
    return this.updateOrderStatus(orderId, "Ready");
  }

  notifyTableReady(table: string) {
    return this.notifications.notifyTableReady(table);
  }

  cancelOrder(orderId: string, reason: string) {
    return this.source.cancelOrder(orderId, reason);
  }

  cancelDrink(orderId: string, drinkId: string, reason: string) {
    return this.source.cancelDrink(orderId, drinkId, reason);
  }

  markTablePaid(table: string, method: PaymentMethod, receivedAmount?: number, changeAmount?: number, sessionId?: string) {
    return this.source.updateTablePayment(table, "Paid", method, receivedAmount, changeAmount, sessionId);
  }

  closeTableSession(table: string) {
    return this.source.updateTableSession(table, "Closed");
  }
}

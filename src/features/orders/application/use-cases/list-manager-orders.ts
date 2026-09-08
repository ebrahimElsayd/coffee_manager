import type { ManagerDataSource } from "@/shared/application/ports/manager-data-source";
import { mapManagerOrder } from "../../domain/manager-order";

export class ListManagerOrders {
  constructor(private readonly source: ManagerDataSource) {}

  async execute() {
    const orders = await this.source.listOrders();
    return orders.map(mapManagerOrder);
  }
}

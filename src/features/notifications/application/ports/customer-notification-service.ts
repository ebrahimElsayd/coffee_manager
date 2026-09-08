export type CustomerNotification = {
  id: string;
  table: string;
  type: "table-ready";
  createdAt: string;
};

export interface CustomerNotificationService {
  notifyTableReady(table: string): Promise<CustomerNotification>;
  list(): Promise<readonly CustomerNotification[]>;
}

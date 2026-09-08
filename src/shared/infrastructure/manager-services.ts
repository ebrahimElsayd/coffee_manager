import { ManagerWorkflow } from "@/features/orders/application/use-cases/manager-workflow";
import { customerNotificationService } from "@/features/notifications/infrastructure/in-memory-customer-notification-service";
import { SupabaseManagerDataSource } from "./supabase/supabase-manager-data-source";
import { hasSupabaseConfig } from "./supabase/supabase-config";
if (!hasSupabaseConfig()) {
  throw new Error("Supabase configuration is required. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}
export const managerDataSource = new SupabaseManagerDataSource();
export const managerWorkflow = new ManagerWorkflow(managerDataSource, customerNotificationService);

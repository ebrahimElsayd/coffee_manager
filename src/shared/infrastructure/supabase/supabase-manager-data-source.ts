/* Supabase response rows are validated at the repository boundary before mapping. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ManagerDataSource, ManagerOrder, ManagerSelectedOption, ManagerTable, WorkflowStatus, DrinkWorkflowStatus, PaymentStatus, PaymentMethod, TableSessionStatus } from "@/shared/application/ports/manager-data-source";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { getManagerCafeId } from "./supabase-cafe-settings";
const orderStatus: Record<string, WorkflowStatus> = { received: "New", preparing: "Preparing", ready: "Ready", served: "Delivered", completed: "Delivered", cancelled: "Cancelled" };
const drinkStatus: Record<string, DrinkWorkflowStatus> = { received: "New", preparing: "Preparing", ready: "Ready", served: "Delivered", completed: "Delivered", cancelled: "Cancelled" };
function normalizeSelectedOptions(value: unknown): ManagerSelectedOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const option = entry as Record<string, unknown>;
    const groupLabel = String(option.groupLabel ?? option.labelGroup ?? option.groupLabelAr ?? `Option ${index + 1}`);
    const optionLabel = String(option.optionLabel ?? option.label ?? option.optionLabelAr ?? "Selected");
    return [{
      groupId: typeof option.groupId === "string" ? option.groupId : undefined,
      groupLabel,
      groupLabelAr: typeof option.groupLabelAr === "string" ? option.groupLabelAr : undefined,
      optionId: typeof option.optionId === "string" ? option.optionId : undefined,
      optionLabel,
      optionLabelAr: typeof option.optionLabelAr === "string" ? option.optionLabelAr : typeof option.labelAr === "string" ? option.labelAr : undefined,
      priceDelta: Number(option.priceDelta ?? option.price ?? 0),
    }];
  });
}
async function withTimeout<T>(operation: PromiseLike<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Payment request timed out. Please check the connection and retry.")), milliseconds); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export class SupabaseManagerDataSource implements ManagerDataSource {
 async listOrders(options?:{orderIds?:readonly string[];table?:string}){
 const db=getSupabaseBrowserClient();
  if(!db)return[];
  if(options?.orderIds && options.orderIds.length===0)return[];
  const cafeId=await getManagerCafeId();
  let query=db.from("orders").select("id,order_number,session_id,status,payment_status,created_at,closed_at,table_sessions!inner(table_id,status,closed_at,cafe_tables!inner(table_number,cafe_id))").eq("table_sessions.cafe_tables.cafe_id",cafeId).in("table_sessions.status",["open","ordering","payment_pending"]);
  if(options?.orderIds?.length)query=query.in("id",[...options.orderIds]);
  if(options?.table)query=query.eq("table_sessions.cafe_tables.table_number",Number(options.table));
  const r=await query.order("created_at",{ascending:false});
  if(r.error)throw r.error;
  const orders=(r.data??[]) as any[];
  const ids=orders.map(o=>o.id);
  const sessionIds=[...new Set(orders.map(o=>o.session_id).filter(Boolean))];
  // Items and payments are independent reads; fetch them concurrently so a
  // dashboard refresh pays only the slower network round-trip, not both.
  const [ir,pr]=await Promise.all([
   ids.length?db.from("order_items").select("id,order_id,product_id,product_name,recipient_name,quantity,unit_price,notes,selected_options,status,menu_products(image_url)").in("order_id",ids):Promise.resolve({data:[],error:null}),
    sessionIds.length?db.from("payments").select("session_id,method,received,received_amount,change_amount,status,paid_at").eq("status","paid").in("session_id",sessionIds).order("paid_at",{ascending:false}):Promise.resolve({data:[],error:null}),
  ]);
  if(ir.error)throw ir.error;
  if(pr.error)throw pr.error;
  const payments=(pr.data??[]) as any[];
  const itemsByOrder=new Map<string,any[]>();
  for(const item of (ir.data??[]) as any[]) itemsByOrder.set(String(item.order_id),[...(itemsByOrder.get(String(item.order_id))??[]),item]);
  return orders.map(o=>{const items=itemsByOrder.get(String(o.id))??[];const drinks=items.map((i:any)=>{const product=Array.isArray(i.menu_products)?i.menu_products[0]:i.menu_products;return {id:i.id,productId:i.product_id,name:i.product_name??"",imageUrl:product?.image_url??undefined,recipientName:i.recipient_name??"Guest",quantity:i.quantity,unitPrice:Number(i.unit_price||0),note:i.notes??"",selectedOptions:normalizeSelectedOptions(i.selected_options),status:drinkStatus[i.status]??"New"};});const people=[...new Set(drinks.map((d:any)=>d.recipientName).filter(Boolean))];const payment=payments.find((p:any)=>p.session_id===o.session_id);const received=payment?.received_amount ?? payment?.received;const session=Array.isArray(o.table_sessions)?o.table_sessions[0]:o.table_sessions;const table=Array.isArray(session?.cafe_tables)?session.cafe_tables[0]:session?.cafe_tables;return{id:String(o.id),sessionId:String(o.session_id),orderNumber:Number(o.order_number),table:table?.table_number==null?"":String(table.table_number),customer:people[0]??"Guest",time:new Date(o.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),openedAt:o.created_at,guests:people.length?`${people.length} Guests`:"",status:orderStatus[o.status]??"New",drinks,orderType:"DineIn",paymentStatus:o.payment_status==="paid"?"Paid":"Unpaid",paymentMethod:payment?.method?String(payment.method).replace(/^./,(c:string)=>c.toUpperCase()) as PaymentMethod:undefined,cashReceived:received==null?undefined:Number(received),cashChange:payment?.change_amount==null?undefined:Number(payment.change_amount),sessionStatus:session?.status==="closed"?"Closed":"Open",closedAt:session?.closed_at??o.closed_at??undefined} as ManagerOrder;});
 }
 async updateOrderStatus(id:string,status:WorkflowStatus){const db=getSupabaseBrowserClient();if(!db)throw new Error("Supabase unavailable");const mapped=({New:"received",Preparing:"preparing",Ready:"ready",Delivered:"served",Cancelled:"cancelled"} as Record<string,string>)[status];const {error}=await db.rpc("manager_set_order_status",{p_order_id:id,p_status:mapped});if(error)throw error;
 }
 async updateDrinkStatus(orderId:string,drinkId:string,status:DrinkWorkflowStatus){const db=getSupabaseBrowserClient();if(!db)throw new Error("Supabase unavailable");const mapped=({New:"received",Preparing:"preparing",Ready:"ready",Delivered:"served",Cancelled:"cancelled"} as Record<string,string>)[status];const {error}=await db.rpc("manager_set_order_item_status",{p_order_item_id:drinkId,p_status:mapped,p_note:null});if(error){console.error("[Orders] manager_set_order_item_status rejected:",error.message);console.error("[Orders] RPC context",{orderId,drinkId,status:mapped,code:error.code,details:error.details,hint:error.hint});throw error;}}
 async cancelOrder(id:string,reason:string){const db=getSupabaseBrowserClient();if(!db)throw new Error("Supabase unavailable");const {error}=await db.rpc("manager_cancel_order",{p_order_id:id,p_reason:reason||null});if(error)throw error;}
 async cancelDrink(orderId:string,id:string,reason:string){const db=getSupabaseBrowserClient();if(!db)throw new Error("Supabase unavailable");void orderId;const {error}=await db.rpc("manager_set_order_item_status",{p_order_item_id:id,p_status:"cancelled",p_note:reason||null});if(error)throw error;}
  async updateTablePayment(table:string,status:PaymentStatus,method:PaymentMethod,receivedAmount?:number,changeAmount?:number,sessionId?:string){const db=getSupabaseBrowserClient();if(!db)throw new Error("Supabase unavailable");void method;void changeAmount;if(status!=="Paid")return;const cafeId=await getManagerCafeId();let sessionQuery=db.from("table_sessions").select("id,cafe_tables!inner(cafe_id,table_number)").eq("cafe_tables.cafe_id",cafeId).eq("cafe_tables.table_number",Number(table)).in("status",["open","ordering","payment_pending"]);if(sessionId)sessionQuery=sessionQuery.eq("id",sessionId);else sessionQuery=sessionQuery.order("started_at",{ascending:false}).limit(1);const session=await sessionQuery.maybeSingle();if(session.error)throw session.error;if(!session.data)throw new Error("No active table session");let applyTax=false;let applyService=false;try{const raw=window.localStorage.getItem("kings-cafe-manager-settings");const parsed=raw?JSON.parse(raw) as {receipt?:{taxEnabled?:unknown;serviceEnabled?:unknown}}:null;applyTax=parsed?.receipt?.taxEnabled===true;applyService=parsed?.receipt?.serviceEnabled===true;}catch{}const {error}=await withTimeout(db.rpc("manager_record_cash_payment",{p_session_id:session.data.id,p_apply_tax:applyTax,p_apply_service:applyService,p_received_amount:receivedAmount ?? null}),15_000);if(error){console.error("[Payments] manager_record_cash_payment rejected",{message:error.message,details:error.details,hint:error.hint,code:error.code,sessionId:session.data.id});throw error;}}
 async listTables(){const db=getSupabaseBrowserClient();if(!db)return[];const cafeId=await getManagerCafeId();const {data,error}=await db.from("cafe_tables").select("id,table_number,status,table_sessions(id,status,opened_at)").eq("cafe_id",cafeId).in("table_sessions.status",["open","ordering","payment_pending"]).order("table_number");if(error)throw error;return(data??[]).map((t:any)=>{const sessions=Array.isArray(t.table_sessions)?t.table_sessions:[];const active=sessions.sort((a:any,b:any)=>String(b.opened_at).localeCompare(String(a.opened_at)))[0];return{number:String(t.table_number),guests:"",status:(active?"Seated":"Available") as ManagerTable["status"],sessionId:active?.id?String(active.id):undefined,sessionStatus:(active?"Open":"Closed") as TableSessionStatus,openedAt:active?.opened_at??undefined};});}
 async updateTableSession(table:string,status:TableSessionStatus,sessionId?:string){const db=getSupabaseBrowserClient();if(!db)throw new Error("Supabase unavailable");const cafeId=await getManagerCafeId();if(status!=="Closed"){const {error}=await db.from("cafe_tables").update({status:"occupied"}).eq("cafe_id",cafeId).eq("table_number",Number(table));if(error)throw error;return;}if(!sessionId)throw new Error("Active table session is required");const {error}=await db.rpc("manager_close_table_session_by_id",{p_session_id:sessionId});if(error)throw error;}
}

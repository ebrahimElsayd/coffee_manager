import type { ManagerOrder } from "@/shared/application/ports/manager-data-source";
import { calculateBillTotals } from "./calculate-bill-totals";
import { buildPersonBillBreakdown } from "./build-person-bill-breakdown";

export type BillBranding = { cafeName?: string; branchName?: string; phone?: string; address?: string; currency?: string; footer?: string; receipt?: { showPrices: boolean; serviceEnabled: boolean; serviceType: "percent" | "fixed"; serviceValue: number; taxEnabled: boolean; taxType: "percent" | "fixed"; taxValue: number } };

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function drinkDetails(drink: ManagerOrder["drinks"][number]) {
  const values = drink.selectedOptions?.length
    ? drink.selectedOptions.map((option) => option.optionLabel)
    : [drink.size, drink.milk, drink.sugar, drink.extras, drink.temperature];
  return values.filter((value) => value && value !== "None").join(" · ") || "Standard";
}

export function printBill(table: string, orders: ManagerOrder[], branding: BillBranding = {}, cash?: { received: number; change: number }, targetWindow?: Window | null, autoPrint = false) {
  if (!orders.length) return;
  const cafeName = escapeHtml(branding.cafeName || "King's Cafe");
  const currency = escapeHtml(branding.currency?.split(" ")[0] || "EGP");
  const branch = escapeHtml(branding.branchName || "");
  const contact = escapeHtml([branding.phone, branding.address].filter(Boolean).join(" · "));
  const footer = escapeHtml(branding.footer || "Thank you for choosing King’s Cafe");
  const { service, tax, total } = calculateBillTotals(orders, { serviceEnabled: branding.receipt?.serviceEnabled ?? false, serviceType: branding.receipt?.serviceType ?? "percent", serviceValue: branding.receipt?.serviceValue ?? 0, taxEnabled: branding.receipt?.taxEnabled ?? false, taxType: branding.receipt?.taxType ?? "percent", taxValue: branding.receipt?.taxValue ?? 0 });
  const personBills = buildPersonBillBreakdown(orders);
  const rows = personBills.map((person) => `<tr class="customer"><td colspan="4">${escapeHtml(person.name)}<span>Person total: ${person.total.toFixed(2)} ${currency}</span></td></tr>${person.drinks.map((drink) => `<tr><td><strong>${escapeHtml(drink.name)}</strong><small>${escapeHtml(drinkDetails(drink))}</small></td><td>${drink.quantity}</td><td>${branding.receipt?.showPrices === false ? "—" : `${drink.unitPrice} ${currency}`}</td><td>${branding.receipt?.showPrices === false ? "—" : `${drink.quantity * drink.unitPrice} ${currency}`}</td></tr>`).join("")}`).join("");
  const bill = targetWindow ?? window.open("", "_blank", "width=500,height=760");
  if (!bill) {
    const fallbackRows = personBills.map((person) => `<h3>${escapeHtml(person.name)} · ${person.subtotal.toFixed(2)} ${currency}</h3>${person.drinks.map((drink) => `<p>${drink.quantity}× ${escapeHtml(drink.name)} — ${(drink.quantity * drink.unitPrice).toFixed(2)} ${currency}</p>`).join("")}`).join("");
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
    frame.srcdoc = `<!doctype html><html><head><title>${cafeName} · Table ${table}</title><style>body{font:14px Arial;padding:24px;color:#222}h1{margin:0 0 8px}h2{margin:0 0 18px;color:#8b5d19}h3{margin:16px 0 6px;border-top:1px solid #ddd;padding-top:12px}p{margin:5px 0}.total{margin-top:20px;border-top:2px solid #222;padding-top:12px;font-size:18px;font-weight:bold}</style></head><body><h1>${cafeName}</h1><h2>Table ${table}</h2>${fallbackRows}${branding.receipt?.serviceEnabled ? `<p>Service: ${service.toFixed(2)} ${currency}</p>` : ""}${branding.receipt?.taxEnabled ? `<p>Tax: ${tax.toFixed(2)} ${currency}</p>` : ""}<p class="total">Total: ${total.toFixed(2)} ${currency}</p></body></html>`;
    frame.addEventListener("load", () => window.setTimeout(() => { frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(() => frame.remove(), 1200); }, 80), { once: true });
    document.body.appendChild(frame);
    return;
  }
  bill.document.open();
  bill.document.write(`<!doctype html><html><head><title>${cafeName} · Table ${table}</title><style>*{box-sizing:border-box}body{margin:0;background:#ece8df;color:#242019;font-family:Arial,sans-serif;padding:28px}.receipt{max-width:440px;margin:auto;overflow:hidden;background:#fff;border-radius:20px;box-shadow:0 18px 55px #44351e30}.hero{padding:27px 28px 22px;background:linear-gradient(135deg,#161613,#2d2415);color:#fff}.hero small{color:#f5ca72;letter-spacing:2px;font-size:10px}.hero h1{margin:8px 0 4px;font-family:Georgia,serif;font-size:29px;color:#efbc58}.hero p{margin:0;color:#d7c9ae;font-size:12px}.meta{display:flex;justify-content:space-between;padding:15px 28px;border-bottom:1px solid #eee5d5;font-size:12px;color:#6e6354}.meta b{color:#aa741d}.body{padding:18px 28px 28px}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;padding:8px 4px;color:#96826a;font-size:10px;text-transform:uppercase;border-bottom:1px solid #e9dfcf}th:not(:first-child),td:not(:first-child){text-align:right}td{padding:10px 4px;border-bottom:1px solid #f1eadf;vertical-align:top}td strong{display:block;font-size:12px}td small{display:block;margin-top:3px;color:#9d8c75;font-size:10px}.customer td{padding:16px 4px 7px;color:#a66d15;font-weight:700;border-bottom:0}.customer span{float:right;color:#a59580;font-size:10px;font-weight:400}.totals{margin-top:18px;padding:14px 16px;border-radius:13px;background:#fbf4e6}.line{display:flex;justify-content:space-between;margin:8px 0;font-size:12px;color:#746552}.grand{padding-top:9px;border-top:1px dashed #dbc69b;color:#513b18;font-size:19px;font-weight:800}.footer{text-align:center;margin-top:20px;color:#9d8d77;font-size:10px;line-height:1.7}.print-action{display:block;width:calc(100% - 56px);margin:22px auto 0;padding:12px;border:0;border-radius:10px;background:#d99b2b;color:#201506;font-weight:700;cursor:pointer}@media print{body{padding:0;background:#fff}.receipt{box-shadow:none;border-radius:0;max-width:none}.print-action{display:none}}</style></head><body><main class="receipt"><header class="hero"><small>${branch || "CAFE MANAGEMENT"}</small><h1>${cafeName}</h1><p>${contact || "Modern table receipt · prepared with care"}</p></header><section class="meta"><span><b>TABLE ${table}</b><br/>${orders[0].guests}</span><span>${new Date().toLocaleDateString("en-GB")}<br/>${new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span></section><section class="body"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><section class="totals"><div class="line"><strong>Payment</strong><strong style="color:${cash ? "#27834d" : "#b7791f"}">${cash ? "PAID · CASH" : "UNPAID · BILL"}</strong></div>${branding.receipt?.serviceEnabled ? `<div class="line"><span>Service charge${branding.receipt.serviceType === "percent" ? ` (${branding.receipt.serviceValue}%)` : ""}</span><span>${service.toFixed(2)} ${currency}</span></div>` : ""}${branding.receipt?.taxEnabled ? `<div class="line"><span>Tax${branding.receipt.taxType === "percent" ? ` (${branding.receipt.taxValue}%)` : ""}</span><span>${tax.toFixed(2)} ${currency}</span></div>` : ""}${cash ? `<div class="line"><span>Cash received</span><span>${cash.received.toFixed(2)} ${currency}</span></div><div class="line"><span>Change</span><span>${cash.change.toFixed(2)} ${currency}</span></div>` : ""}<div class="line grand"><span>Total</span><span>${total.toLocaleString()} ${currency}</span></div></section><footer class="footer">${footer}<br/>${cash ? "Please keep this receipt for your records" : "This bill is not proof of payment"}</footer><button class="print-action" type="button" onclick="window.print()">▣ ${cash ? "Print Receipt" : "Print Bill"}</button></section></main></body></html>`);
  bill.document.close();
  const bindPrintButton = () => {
    const printButton = bill.document.querySelector<HTMLButtonElement>(".print-action");
    if (!printButton || printButton.dataset.bound === "true") return;
    printButton.dataset.bound = "true";
    printButton.addEventListener("click", (event) => {
      event.preventDefault();
      bill.focus();
      bill.print();
    });
  };
  bindPrintButton();
  bill.addEventListener("load", bindPrintButton);
  bill.setTimeout(bindPrintButton, 100);
  if (autoPrint) bill.setTimeout(() => { bill.focus(); bill.print(); }, 180);
  bill.focus();
}

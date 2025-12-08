import { logger } from "../lib/logger";
import { sql as db } from "./client";

async function diagnose() {
  logger.info("🔍 Dijagnostika po kompaniji...");
  try {
    const companies = await db`SELECT id, name FROM companies ORDER BY name`;
    const quotes = await db`SELECT company_id, COUNT(*) AS c FROM quotes GROUP BY company_id`;
    const invoices = await db`SELECT company_id, COUNT(*) AS c FROM invoices GROUP BY company_id`;
    const orders = await db`SELECT company_id, COUNT(*) AS c FROM orders GROUP BY company_id`;
    const deliveryNotes =
      await db`SELECT company_id, COUNT(*) AS c FROM delivery_notes GROUP BY company_id`;

    const qMap = new Map<string, number>();
    const iMap = new Map<string, number>();
    const oMap = new Map<string, number>();
    const dMap = new Map<string, number>();
    for (const r of quotes) qMap.set(r.company_id as string, parseInt(String(r.c), 10));
    for (const r of invoices) iMap.set(r.company_id as string, parseInt(String(r.c), 10));
    for (const r of orders) oMap.set(r.company_id as string, parseInt(String(r.c), 10));
    for (const r of deliveryNotes) dMap.set(r.company_id as string, parseInt(String(r.c), 10));

    let totalQ = 0,
      totalI = 0,
      totalO = 0,
      totalD = 0;
    for (const c of companies) {
      const id = c.id as string;
      const q = qMap.get(id) ?? 0;
      const i = iMap.get(id) ?? 0;
      const o = oMap.get(id) ?? 0;
      const d = dMap.get(id) ?? 0;
      totalQ += q;
      totalI += i;
      totalO += o;
      totalD += d;
      logger.info(`${c.name}: Quotes=${q}, Invoices=${i}, Orders=${o}, DeliveryNotes=${d}`);
    }
    logger.info(
      `Totals: Quotes=${totalQ}, Invoices=${totalI}, Orders=${totalO}, DeliveryNotes=${totalD}`
    );
  } catch (error) {
    logger.error("Diagnosis failed:", error);
  } finally {
    await db.end();
  }
}

diagnose();

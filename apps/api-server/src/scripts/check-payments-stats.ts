import { sql as db } from "../db/client";
import paymentQueries from "../db/queries/payments";
import { logger } from "../lib/logger";

async function main() {
  try {
    const stats = await paymentQueries.getPaymentStats({});
    logger.info(JSON.stringify(stats));
  } catch (e) {
    logger.error("error:", e);
  } finally {
    await db.end();
  }
}

if (import.meta.main) {
  main();
}

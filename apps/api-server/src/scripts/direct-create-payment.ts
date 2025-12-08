import { sql as db } from "../db/client";
import { paymentQueries } from "../db/queries/payments";
import { logger } from "../lib/logger";

async function main() {
  const invoiceId = Bun.argv[2];
  const userId = Bun.argv[3];
  if (!invoiceId || !userId) {
    logger.error("usage: bun run src/scripts/direct-create-payment.ts <invoiceId> <userId>");
    process.exit(1);
  }
  try {
    const payment = await paymentQueries.create(
      {
        invoiceId,
        amount: 180,
        currency: "EUR",
        paymentMethod: "cash",
        paymentDate: new Date().toISOString(),
        reference: "TEST-REF-002",
      },
      userId
    );
    logger.info(JSON.stringify(payment));
  } catch (e) {
    logger.error("error:", e);
  } finally {
    await db.end();
  }
}

if (import.meta.main) {
  main();
}

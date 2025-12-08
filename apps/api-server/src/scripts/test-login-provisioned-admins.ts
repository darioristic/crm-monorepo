import { sql as db } from "../db/client";
import { logger } from "../lib/logger";
import { authService } from "../services/auth.service";

async function test(email: string, password: string) {
  const res = await authService.login(email, password);
  if (!res.success || !res.data) {
    logger.error(`FAIL ${email}: ${res.error?.message}`);
  } else {
    logger.info(`OK ${email}: session=${res.data.sessionId}`);
  }
}

async function main() {
  await test("admin@tenant-alpha.local", "AlphaAdmin123!");
  await test("admin@tenant-beta.local", "BetaAdmin123!");
  await test("admin@tenant-gamma.local", "GammaAdmin123!");
}

if (import.meta.main) {
  main()
    .then(async () => {
      await db.end();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error(String(err?.message || err));
      await db.end();
      process.exit(1);
    });
}

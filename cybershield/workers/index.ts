import "dotenv/config";
import { simulationWorker } from "./simulation.worker";
import { remediationWorker } from "./remediation.worker";
import { newHireWorker } from "./newhire.worker";
import { certificateWorker } from "./certificate.worker";
import { logger } from "../src/lib/logger";

const workers = [simulationWorker, remediationWorker, newHireWorker, certificateWorker];

logger.info("CyberShield workers starting", { workers: workers.map((w) => w.name) });

let shuttingDown = false;
async function shutdown(signal: string) {
  // Guard against a second signal racing the first close.
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("Shutting down workers", { signal });
  try {
    await Promise.all(workers.map((w) => w.close()));
    logger.info("Workers shut down cleanly");
    process.exit(0);
  } catch (err) {
    logger.error("Error during worker shutdown", { error: (err as Error).message });
    process.exit(1);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

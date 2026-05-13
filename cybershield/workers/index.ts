import "dotenv/config";
import { simulationWorker } from "./simulation.worker";
import { remediationWorker } from "./remediation.worker";
import { newHireWorker } from "./newhire.worker";
import { certificateWorker } from "./certificate.worker";

console.log("⚡ CyberShield workers starting...");
console.log("  - simulations:  ", simulationWorker.name);
console.log("  - remediation:  ", remediationWorker.name);
console.log("  - newhire:      ", newHireWorker.name);
console.log("  - certificates: ", certificateWorker.name);

async function shutdown() {
  console.log("\nShutting down workers...");
  await Promise.all([
    simulationWorker.close(), remediationWorker.close(),
    newHireWorker.close(), certificateWorker.close(),
  ]);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

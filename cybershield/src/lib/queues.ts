import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  lazyConnect: true,
};

function makeQueue(name: string) {
  const q = new Queue(name, { connection });
  q.on("error", (err) => {
    console.warn(`[queue:${name}] ${err.message}`);
  });
  return q;
}

export const certificateQueue = makeQueue("certificates");
export const remediationQueue = makeQueue("remediation");
export const simulationQueue = makeQueue("simulations");
export const newHireQueue = makeQueue("newhire");

import { runJobs } from "../../lib/jobs";
import { deployment } from "../../lib/deployment";
export default async function () {
  // Enable the scheduler on the BOOKING deployment only. Both share one queue.
  if (deployment.mode !== "booking")
    return new Response("Scheduler inactive for this deployment");
  try {
    const result = await runJobs(1);
    return Response.json({ processed: result.length });
  } catch {
    console.error("Scheduled job failed");
    return new Response("Job processing failed", { status: 500 });
  }
}

import { runJobs } from "../lib/jobs";
import { pool } from "../lib/db";
try {
  console.log(await runJobs(10));
} catch {
  console.error(
    "Job-Verarbeitung fehlgeschlagen. Datenbank und Integrationen prüfen.",
  );
  process.exitCode = 1;
} finally {
  await pool().end();
}

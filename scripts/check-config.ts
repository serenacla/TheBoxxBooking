import { configurationIssues } from "../lib/configuration";
import { deployment } from "../lib/deployment";

console.log(
  `THE BOXX ${deployment.version} · ${deployment.mode === "booking" ? "Buchung" : "Verwaltung"}`,
);
const issues = configurationIssues();
if (issues.length) {
  console.error("Einrichtung noch unvollständig:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Variablen formal vollständig. Werte werden nicht ausgegeben.");
  console.log(
    "Datenbankzugriff, Mailzustellung und Google-Freigabe anschließend im echten Hosting testen.",
  );
}

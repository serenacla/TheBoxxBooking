import { getSettings } from "@/lib/db";
import { defaultSettings } from "@/lib/model";
import { notFound } from "next/navigation";
import { deployment } from "@/lib/deployment";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (deployment.mode !== "booking") notFound();
  const s = process.env.DATABASE_URL
    ? (await getSettings()).data
    : defaultSettings;
  return (
    <main className="legal-page">
      <a href="/">← THE BOXX</a>
      <h1>Rechtliches</h1>
      {[
        ["impressum", "Impressum", s.imprint],
        ["datenschutz", "Datenschutz", s.privacy],
        ["bedingungen", "Buchungsbedingungen", s.terms],
      ].map(([id, title, text]) => (
        <section id={id} key={id}>
          <h2>{title}</h2>
          <p>
            {text ||
              "Noch nicht hinterlegt. Echte Anfragen sind bis zur Freigabe gesperrt."}
          </p>
        </section>
      ))}
    </main>
  );
}

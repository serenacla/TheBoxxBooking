import WithdrawalLink from "@/components/withdrawal-link";
import type { Metadata } from "next";
import { deployment } from "@/lib/deployment";
import "./globals.css";
import "./story.css";
export const metadata: Metadata = {
  title:
    deployment.mode === "admin"
      ? "THE BOXX · Verwaltung"
      : "THE BOXX · Deine Fotobox",
  description:
    deployment.mode === "admin"
      ? "Buchungen, Kalender und Team verwalten."
      : "Individuell zusammenstellen, Termin wählen und THE BOXX für dein Event anfragen.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
     <body>
  {children}
  <WithdrawalLink />
</body>
    </html>
  );
}

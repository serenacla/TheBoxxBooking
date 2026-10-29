import { redirect,notFound } from "next/navigation";
import { deployment } from "@/lib/deployment";
import { actor } from "@/lib/auth";
import WithdrawalAdmin from "@/components/withdrawal-admin";
export const dynamic="force-dynamic";
export default async function Page(){if(deployment.mode!=="admin")notFound();const user=await actor();if(!user)redirect("/login");return <main style={{maxWidth:1000,margin:"0 auto",padding:"40px 24px 120px"}}><a href="/admin">Zur Verwaltung</a><h1>Eingegangene Widerrufe</h1><p>Erklärungen sind bereits eingegangen. Bitte unverzüglich zuordnen und bearbeiten. Eine Markierung hier verändert weder die Buchung noch den Kalender. Die zugehörige Buchung bearbeiten Sie in der bestehenden Verwaltung.</p><WithdrawalAdmin editable={user.role!=="viewer"}/></main>;}

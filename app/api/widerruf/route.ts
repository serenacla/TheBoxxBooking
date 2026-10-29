import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { body, handle, json, sameOrigin, publicMode, AppError, baseUrl } from "@/lib/http";
import { requireActor, rateLimit, clientKey } from "@/lib/auth";
import { query, transaction, getSettings } from "@/lib/db";
import { encrypt, hash } from "@/lib/crypto";
import { runJobs } from "@/lib/jobs";
import { withdrawalSchema, withdrawalText, withdrawalReceipt } from "@/lib/withdrawals";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function queueMails(id:string) {
 const from = process.env.MAIL_FROM;
 if (!from || !process.env.RESEND_API_KEY) return false;
 const settings = (await getSettings()).data;
 const [row] = await query("SELECT * FROM withdrawals WHERE id=$1", [id]);
 if (!row) throw new AppError(404,"Vorgang nicht gefunden.");
 const receipt = withdrawalReceipt(row as Parameters<typeof withdrawalReceipt>[0]);
 await transaction(async c => {
  for (const [kind,to,text] of [
   ["customer",row.email,receipt],
   ["team",settings.notificationEmail,receipt+`\n\nTeam-Übersicht: ${baseUrl("admin")}/widerrufe`]
  ]) {
   if (!to) continue;
   const payload = {from,to,subject:`THE BOXX – Widerruf ${row.id}`,text,reply_to: kind === "team" ? row.email : (settings.replyTo || settings.notificationEmail || "info@creative-lens.de")};
   await c.query("INSERT INTO jobs(unique_key,kind,payload) VALUES($1,'email',$2) ON CONFLICT(unique_key) DO NOTHING",
    [`withdrawal:${id}:${kind}`,JSON.stringify({encrypted:encrypt(JSON.stringify(payload))})]);
  }
 });
 return true;
}
export async function POST(req:Request) { return handle(async()=>{
 publicMode(); sameOrigin(req);
 const input=withdrawalSchema.parse(await body(req));
 const fingerprint=hash(JSON.stringify([input.name,input.email,input.contract]));
 // No lookup/disclosure of existing customer bookings. The declaration is accepted independently.
 const [prior]=await query("SELECT * FROM withdrawals WHERE request_key=$1",[input.requestKey]);
 if (!prior) await rateLimit(`withdrawal:${clientKey(req)}`,30,900);
 const row=await transaction(async c=>{
  await c.query("INSERT INTO withdrawals(id,request_key,request_hash,name,email,contract,declaration) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(request_key) DO NOTHING",
   [randomUUID(),input.requestKey,fingerprint,input.name,input.email,input.contract,withdrawalText(input.name,input.contract)]);
  const {rows:[r]}=await c.query("SELECT * FROM withdrawals WHERE request_key=$1",[input.requestKey]);
  if(r.request_hash!==fingerprint) throw new AppError(409,"Diese Übermittlung wurde bereits mit anderen Angaben gespeichert. Bitte die Seite neu öffnen.");
  return r;
 });
 let queued=false;
 try {queued=await queueMails(row.id);} catch {console.error("Withdrawal saved; email enqueue failed");}
 if(queued) after(async()=>{try{await runJobs(3);}catch{console.error("Withdrawal email dispatch deferred");}});
 return json({id:row.id,receivedAt:row.received_at,receipt:withdrawalReceipt(row as Parameters<typeof withdrawalReceipt>[0]),emailQueued:queued},201);
});}
export async function GET(){return handle(async()=>{
 await requireActor();
 const rows=await query(`SELECT w.id,w.name,w.email,w.contract,w.declaration,w.received_at,w.reviewed_at,
 COALESCE(j.status,'not_queued') AS email_status,
 COALESCE(t.status,'not_queued') AS team_email_status
 FROM withdrawals w LEFT JOIN jobs j ON j.unique_key='withdrawal:'||w.id::text||':customer'
 LEFT JOIN jobs t ON t.unique_key='withdrawal:'||w.id::text||':team'
 ORDER BY w.received_at DESC LIMIT 500`);
 return json({rows});
});}
export async function PATCH(req:Request){return handle(async()=>{
 sameOrigin(req);const user=await requireActor(["owner","manager"]);
 const data=await body(req);
 if(!/^[0-9a-f-]{36}$/i.test(data.id || "")) throw new AppError(400,"Ungültiger Vorgang.");
 if(data.action==="queue") {
  const queued=await queueMails(data.id);
  if(!queued) throw new AppError(503,"MAIL_FROM und RESEND_API_KEY fehlen. Erklärung bleibt gespeichert.");
  after(async()=>{try{await runJobs(3);}catch{console.error("Withdrawal dispatch deferred");}});
 } else if(data.action==="review") {
  await query("UPDATE withdrawals SET reviewed_at=now(),reviewed_by=$2 WHERE id=$1",[data.id,user.id]);
 } else throw new AppError(400,"Ungültige Aktion.");
 return json({ok:true});
});}

import { z } from "zod";
export const withdrawalSchema = z.object({
 requestKey: z.uuid(), name: z.string().trim().min(2).max(160),
 email: z.email().max(254).transform(v => v.toLowerCase()),
 contract: z.string().trim().min(3).max(2000),
});
export function withdrawalText(name: string, contract: string) {
 return `Hiermit widerrufe ich den von mir abgeschlossenen Vertrag beziehungsweise den nachfolgend bezeichneten Vertragsteil.\n\nName: ${name}\nVertrag / Vertragsteil: ${contract}`;
}
export function withdrawalReceipt(row: {id:string;name:string;email:string;contract:string;declaration:string;received_at:Date|string}) {
 return `THE BOXX – Eingangsbestätigung Ihres Widerrufs\n\nVorgang: ${row.id}\nEingang: ${new Date(row.received_at).toISOString()} (UTC)\nBestätigungsadresse: ${row.email}\n\n${row.declaration}\n\nDiese Bestätigung dokumentiert den Eingang Ihrer Erklärung. Sie trifft keine Aussage darüber, ob im Einzelfall ein gesetzliches Widerrufsrecht besteht. Die Bearbeitung Ihres Widerrufs ist nicht von einer weiteren Bestätigung durch Sie abhängig.\n\nCreative Lens · Zeißstr. 85 · 09131 Chemnitz\ninfo@creative-lens.de`;
}

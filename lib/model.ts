import { z } from "zod";

export const money = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export const dateLabel = (s: string) =>
  new Date(s + "T12:00:00Z").toLocaleDateString("de-DE");
export const todayBerlin = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
export function nextDate(s: string) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s + "T00:00:00Z")) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function daysInRange(start: string, end: string, max = 366) {
  if (!validDate(start) || !validDate(end) || end < start)
    throw new Error("Ungültiger Zeitraum.");
  const days: string[] = [];
  for (let d = start; d <= end; d = nextDate(d)) {
    days.push(d);
    if (days.length > max) throw new Error(`Höchstens ${max} Tage auswählen.`);
  }
  return days;
}
export const optionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(90),
  description: z.string().max(250),
  category: z.enum(["printer", "extra"]),
  priceCents: z.number().int().min(0).max(1000000),
  active: z.boolean(),
});
export const settingsSchema = z.object({
  basePriceCents: z.number().int().min(0).max(1000000),
  options: z
    .array(optionSchema)
    .max(30)
    .refine(
      (o) => new Set(o.map((i) => i.id)).size === o.length,
      "IDs müssen eindeutig sein.",
    ),
  included: z.array(z.string().min(1).max(150)).max(10),
  notificationEmail: z.union([z.email(), z.literal("")]),
  replyTo: z.union([z.email(), z.literal("")]),
  companyName: z.string().trim().min(1).max(120),
  phone: z.string().max(60),
  calendarId: z.string().max(300),
  blockedCalendarIds: z.array(z.string().min(1).max(300)).max(10),
  priceNote: z.string().max(500),
  imprint: z.string().max(12000),
  privacy: z.string().max(20000),
  terms: z.string().max(20000),
  bookingsEnabled: z.boolean(),
  pricesConfirmed: z.boolean(),
  legalConfirmed: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;
export type Option = z.infer<typeof optionSchema>;
export const defaultSettings: Settings = {
  basePriceCents: 19900,
  companyName: "THE BOXX",
  phone: "",
  notificationEmail: "",
  replyTo: "",
  calendarId: "",
  blockedCalendarIds: [],
  included: [
    "THE BOXX mit digitalen Fotos",
    "Aufbau, Abbau und Einweisung",
    "Online-Galerie nach dem Event",
  ],
  options: [
    {
      id: "printer-200",
      name: "Drucker · 200 Fotos",
      description: "Sofortbilder für eure liebsten Momente.",
      category: "printer",
      priceCents: 12500,
      active: true,
    },
    {
      id: "printer-300",
      name: "Drucker · 300 Fotos",
      description: "Mehr Erinnerungen für die ganze Runde.",
      category: "printer",
      priceCents: 17000,
      active: true,
    },
    {
      id: "printer-400",
      name: "Drucker · 400 Fotos",
      description: "Viel Platz für große Feiern.",
      category: "printer",
      priceCents: 21000,
      active: true,
    },
    {
      id: "backdrop",
      name: "Hintergrund",
      description: "Ein passender Fotohintergrund für euer Event.",
      category: "extra",
      priceCents: 2500,
      active: true,
    },
    {
      id: "photo-design",
      name: "Individuelles Bilddesign",
      description: "Namen, Datum oder Firmenlogo im Fotolayout.",
      category: "extra",
      priceCents: 2500,
      active: true,
    },
    {
      id: "event-support",
      name: "Betreuung vor Ort",
      description: "Persönliche Begleitung für bis zu vier Stunden.",
      category: "extra",
      priceCents: 14900,
      active: true,
    },
    {
      id: "props",
      name: "Requisiten",
      description: "Ein Set für kreative Gruppenfotos.",
      category: "extra",
      priceCents: 2900,
      active: true,
    },
    {
      id: "usb",
      name: "USB-Erinnerungsarchiv",
      description: "Alle Fotos zusätzlich auf einem USB-Stick.",
      category: "extra",
      priceCents: 1500,
      active: true,
    },
  ],
  priceNote:
    "Beispielpreise – vor Freischaltung durch THE BOXX prüfen. Eventuelle Anfahrt wird separat abgestimmt.",
  imprint: "",
  privacy: "",
  terms: "",
  bookingsEnabled: false,
  pricesConfirmed: false,
  legalConfirmed: false,
};
export const bookingSchema = z
  .object({
    startDate: z.string().refine(validDate),
    endDate: z.string().refine(validDate),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    name: z.string().trim().min(2).max(120),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    phone: z.string().trim().min(5).max(60),
    location: z.string().trim().min(3).max(350),
    eventType: z.string().trim().min(2).max(80),
    guestCount: z.coerce.number().int().min(1).max(100000),
    message: z.string().max(3000).default(""),
    printerId: z.string().max(40),
    addOns: z.array(z.string().max(40)).max(25),
    consent: z.literal(true),
    companyWebsite: z.literal("").default(""),
    catalogVersion: z.number().int().positive(),
    requestKey: z.uuid(),
  })
  .superRefine((v, c) => {
    try {
      daysInRange(v.startDate, v.endDate, 14);
    } catch {
      c.addIssue({
        code: "custom",
        message: "Bitte einen Zeitraum von 1 bis 14 Tagen wählen.",
      });
    }
    if (v.startDate < todayBerlin())
      c.addIssue({
        code: "custom",
        message: "Der Beginn darf nicht in der Vergangenheit liegen.",
      });
    const max = new Date();
    max.setUTCFullYear(max.getUTCFullYear() + 2);
    if (v.endDate > max.toISOString().slice(0, 10))
      c.addIssue({
        code: "custom",
        message: "Termine sind bis zu zwei Jahre im Voraus möglich.",
      });
    if (v.startDate === v.endDate && v.endTime <= v.startTime)
      c.addIssue({
        code: "custom",
        message:
          "Für ein Ende nach Mitternacht bitte den nächsten Tag als Enddatum wählen.",
      });
  });
export type BookingInput = z.infer<typeof bookingSchema>;
export function quote(
  s: Settings,
  start: string,
  end: string,
  printerId: string,
  addOns: string[],
) {
  const count = daysInRange(start, end, 14).length;
  const ids = [...(printerId === "none" ? [] : [printerId]), ...addOns];
  if (new Set(ids).size !== ids.length) throw new Error("Doppelte Auswahl.");
  const selected = ids.map((id) => {
    const o = s.options.find((x) => x.id === id && x.active);
    if (!o) throw new Error("Leistung nicht mehr verfügbar.");
    return o;
  });
  if (
    selected.filter((o) => o.category === "printer").length !==
      (printerId === "none" ? 0 : 1) ||
    addOns.some(
      (id) => s.options.find((o) => o.id === id)?.category !== "extra",
    ) ||
    (printerId !== "none" &&
      s.options.find((o) => o.id === printerId)?.category !== "printer")
  )
    throw new Error("Ungültige Auswahl.");
  const lines = [
    {
      name: `THE BOXX · ${count} ${count === 1 ? "Tag" : "Tage"}`,
      cents: s.basePriceCents * count,
    },
    ...selected.map((o) => ({ name: o.name, cents: o.priceCents })),
  ];
  return {
    dayCount: count,
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.cents, 0),
    selected,
  };
}
export const statusLabels = {
  requested: "Angefragt",
  confirmed: "Bestätigt",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};
export type Status = keyof typeof statusLabels;
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "viewer";
};
export type Booking = {
  id: string;
  reference: string;
  start_date: string;
  end_date: string;
  status: Status;
  occupied: boolean;
  data: BookingInput;
  quote: ReturnType<typeof quote>;
  version: number;
  notes: string;
  created_at: string;
  updated_at: string;
  calendar_synced_at: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  payment_status: "open" | "paid";
  payment_note: string;
};

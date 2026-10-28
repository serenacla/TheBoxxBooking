const bookingId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validBookingLink(value: unknown): value is string {
  return typeof value === "string" && bookingId.test(value);
}

export function adminDestination(value: unknown): string {
  return validBookingLink(value)
    ? `/admin?booking=${encodeURIComponent(value)}`
    : "/admin";
}

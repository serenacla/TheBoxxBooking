import BookingSite from "@/components/booking-site";
import AccessGate from "@/components/access-gate";
import { previewAllowed } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await previewAllowed())) return <AccessGate />;
  return <BookingSite />;
}

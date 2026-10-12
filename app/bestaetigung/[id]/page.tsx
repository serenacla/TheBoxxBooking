import Receipt from "@/components/receipt";
import { notFound } from "next/navigation";
import { deployment } from "@/lib/deployment";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  if (deployment.mode !== "booking") notFound();
  return (
    <Receipt id={(await params).id} token={(await searchParams).token ?? ""} />
  );
}

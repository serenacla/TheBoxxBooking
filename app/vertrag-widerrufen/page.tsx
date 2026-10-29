import { notFound } from "next/navigation";
import { deployment } from "@/lib/deployment";
import WithdrawalForm from "@/components/withdrawal-form";
export const metadata={title:"Vertrag widerrufen | THE BOXX",robots:{index:false,follow:false}};
export default function Page(){if(deployment.mode!=="booking")notFound();return <main style={{maxWidth:760,margin:"0 auto",padding:"48px 24px 120px"}}><a href="/">THE BOXX</a><h1>Vertrag widerrufen</h1><WithdrawalForm/></main>;}

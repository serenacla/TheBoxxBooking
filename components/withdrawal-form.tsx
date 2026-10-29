"use client";
import { useState, useRef, type FormEvent } from "react";
type Receipt={id:string;receivedAt:string;receipt:string;emailQueued:boolean};
export default function WithdrawalForm(){
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[contract,setContract]=useState("");
 const [step,setStep]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [receipt,setReceipt]=useState<Receipt|null>(null);const requestKey=useRef("");const locked=useRef(false);
 async function send(e:FormEvent){e.preventDefault();if(locked.current)return;locked.current=true;setBusy(true);setError("");
 try{if(!requestKey.current)requestKey.current=crypto.randomUUID();
 const r=await fetch("/api/widerruf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,contract,requestKey:requestKey.current})});
 const d=await r.json();if(!r.ok)throw new Error(d.error || "Übermittlung fehlgeschlagen.");setReceipt(d);
 }catch(e){setError(e instanceof Error?e.message:"Übermittlung fehlgeschlagen.");}finally{setBusy(false);locked.current=false;}}
 function download(){if(!receipt)return;const url=URL.createObjectURL(new Blob([receipt.receipt],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`THE-BOXX-Widerruf-${receipt.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 if(receipt)return <section aria-live="polite"><h2>Ihr Widerruf ist eingegangen.</h2><p>Vorgangsnummer: {receipt.id}</p><p>Eingang: {new Date(receipt.receivedAt).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})} (Europe/Berlin)</p><p>{receipt.emailQueued?"Die Eingangsbestätigung wurde für den E-Mail-Versand vorgemerkt. Bitte speichern Sie zusätzlich die Bestätigung unten.":"Die Erklärung wurde gespeichert. Die automatische E-Mail-Bestätigung konnte noch nicht zum Versand vorgemerkt werden. Bitte speichern Sie die Bestätigung und kontaktieren Sie uns bei Bedarf."}</p><button type="button" className="button" onClick={download}>Eingangsbestätigung herunterladen</button><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontFamily:"inherit",marginTop:24}}>{receipt.receipt}</pre></section>;
 return <><p>Hier können Sie den Widerruf eines Vertrags oder eines Vertragsteils erklären. Eine Anmeldung und eine Begründung sind nicht erforderlich. Die Funktion setzt keine Zustimmung zu weiteren Bedingungen voraus.</p>
 <p>Kontakt: <a href="mailto:info@creative-lens.de">info@creative-lens.de</a></p>
 <form onSubmit={step===1?(e)=>{e.preventDefault();setError("");setStep(2);}:send}>
 {step===1?<div style={{display:"grid",gap:18}}>
 <label>Ihr vollständiger Name<input style={{display:"block",width:"100%"}} required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={160}/></label>
 <label>E-Mail-Adresse für die Eingangsbestätigung<input style={{display:"block",width:"100%"}} required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254}/></label>
 <label>Welchen Vertrag oder Vertragsteil widerrufen Sie?<textarea style={{display:"block",width:"100%"}} required rows={4} minLength={3} maxLength={2000} value={contract} onChange={e=>setContract(e.target.value)} aria-describedby="contract-help"/></label>
 <p id="contract-help">Bitte nennen Sie Ihre Buchungsnummer oder beschreiben Sie die Buchung, zum Beispiel mit Veranstaltungsdatum und Ort. Für einen Teilwiderruf benennen Sie die betroffene Leistung.</p>
 <button className="button" type="submit">Angaben prüfen</button></div>:<section>
 <h2>Widerruf prüfen und bestätigen</h2><p>Hiermit widerrufe ich den von mir abgeschlossenen Vertrag beziehungsweise den nachfolgend bezeichneten Vertragsteil.</p>
 <dl><dt>Name</dt><dd>{name}</dd><dt>Bestätigungsadresse</dt><dd>{email}</dd><dt>Vertrag / Vertragsteil</dt><dd style={{whiteSpace:"pre-wrap"}}>{contract}</dd></dl>
 <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:24}}><button type="button" className="button secondary" disabled={busy} onClick={()=>{requestKey.current="";setStep(1);}}>Angaben bearbeiten</button><button className="button" type="submit" disabled={busy}>{busy?"Wird übermittelt …":"Widerruf bestätigen"}</button></div>
 </section>}
 {error&&<p role="alert" style={{color:"#b91c1c"}}>{error} Falls die Übermittlung nicht möglich ist, können Sie Ihre Erklärung an info@creative-lens.de senden.</p>}
 </form><p style={{marginTop:24}}>Die Eingangsbestätigung dokumentiert den Eingang Ihrer Erklärung. Ob ein gesetzliches Widerrufsrecht besteht, richtet sich nach Ihrem konkreten Vertrag. Ihre Erklärung wird unabhängig davon entgegengenommen.</p>
 <a href="/">Zur Website und ihren Datenschutzhinweisen</a></>;
}

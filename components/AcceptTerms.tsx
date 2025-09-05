"use client";
import Link from "next/link";

type Props = { agreed: boolean; setAgreed: (v:boolean)=>void };

export default function AcceptTerms({ agreed, setAgreed }: Props) {
  return (
    <label style={{display:"flex", gap:12, alignItems:"flex-start", margin:"12px 0"}}>
      <input
        type="checkbox"
        checked={agreed}
        onChange={e=>setAgreed(e.target.checked)}
        required
        aria-label="Agree to Terms of Use"
      />
      <span style={{fontSize:14, lineHeight:1.4}}>
        I agree to the <Link href="/terms" style={{color:"#1F48AF", textDecoration:"underline"}}>Terms of Use</Link>.
        Objectionable content is not allowed. Reports are reviewed within 24 hours.
      </span>
    </label>
  );
}

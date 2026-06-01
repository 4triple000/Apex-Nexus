import { useState } from "react";

const GREEN = "#55EFC4";
const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";

export default function PaymentUI({ total = "$49.99" }: { total?: string }) {
  const [step, setStep] = useState<"checkout" | "processing" | "done">("checkout");
  const [card, setCard] = useState("4242 4242 4242 4242");

  const pay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStep("processing");
    setTimeout(() => setStep("done"), 1800);
  };

  if (step === "done") return (
    <div style={{ padding: 18, background: "#0A0A12", borderRadius: 12, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
         onClick={e => e.stopPropagation()}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(85,239,196,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✓</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: GREEN }}>Payment Successful!</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Order #APX-{Math.floor(Math.random() * 90000 + 10000)}</div>
      <button onClick={e => { e.stopPropagation(); setStep("checkout"); }} style={{ fontSize: 9, padding: "4px 12px", borderRadius: 99, border: "none", background: "rgba(85,239,196,0.15)", color: GREEN, cursor: "pointer" }}>New Order</button>
    </div>
  );

  if (step === "processing") return (
    <div style={{ padding: 24, background: "#0A0A12", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
         onClick={e => e.stopPropagation()}>
      <div style={{ width: 36, height: 36, border: "3px solid rgba(162,155,254,0.2)", borderTopColor: "#A29BFE", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Processing payment…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ background: "#0A0A12", borderRadius: 12, overflow: "hidden" }}
         onClick={e => e.stopPropagation()}>
      <div style={{ padding: "8px 10px", background: "rgba(85,239,196,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#E8EAED" }}>💳 Checkout</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: GREEN }}>{total}</div>
      </div>

      <div style={{ padding: "10px 10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ padding: "10px 12px", background: "linear-gradient(135deg,#1A0A2E,#0A1A2E)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>CARD NUMBER</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E8EAED", letterSpacing: "0.1em" }}>{card}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>EXPIRES 12/26</div>
            <div style={{ fontSize: 14 }}>💳</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <input placeholder="MM/YY" style={{ flex: 1, padding: "6px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#E8EAED", fontSize: 9, outline: "none", fontFamily: "inherit" }} onClick={e => e.stopPropagation()} />
          <input placeholder="CVV" style={{ width: 50, padding: "6px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#E8EAED", fontSize: 9, outline: "none", fontFamily: "inherit" }} onClick={e => e.stopPropagation()} />
        </div>

        <button onClick={pay} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: GRAD, color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(108,92,231,0.4)" }}>
          Pay {total} 🔒
        </button>

        <div style={{ textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>Secured by Stripe · 256-bit SSL</div>
      </div>
    </div>
  );
}

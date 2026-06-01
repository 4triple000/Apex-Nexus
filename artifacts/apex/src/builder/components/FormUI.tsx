import { useState } from "react";

const GRAD = "linear-gradient(135deg,#6C5CE7,#A29BFE,#FD79A8)";
const PURPLE = "#A29BFE";
const GREEN = "#55EFC4";

export default function FormUI() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; pass?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.includes("@")) e.email = "Enter a valid email";
    if (pass.length < 6)      e.pass  = "Min. 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1200);
  };

  if (submitted) {
    return (
      <div style={{ padding: 20, background: "#0A0A12", borderRadius: 12, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
           onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 28 }}>🎉</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: GREEN }}>Welcome aboard!</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{email}</div>
        <button onClick={e => { e.stopPropagation(); setSubmitted(false); setEmail(""); setPass(""); }} style={{ fontSize: 9, padding: "4px 12px", borderRadius: 99, border: "none", background: PURPLE, color: "white", cursor: "pointer", marginTop: 4 }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "#0A0A12", borderRadius: 12, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}
          onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#E8EAED", textAlign: "center" }}>Create Account</div>

      <div>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@email.com"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: `1px solid ${errors.email ? "#FF5F6D44" : "rgba(255,255,255,0.1)"}`, background: "rgba(255,255,255,0.04)", color: "#E8EAED", fontSize: 10, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />
        {errors.email && <div style={{ fontSize: 8, color: "#FF5F6D", marginTop: 3, paddingLeft: 4 }}>{errors.email}</div>}
      </div>

      <div>
        <input
          type="password" value={pass} onChange={e => setPass(e.target.value)}
          placeholder="Password"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 9, border: `1px solid ${errors.pass ? "#FF5F6D44" : "rgba(255,255,255,0.1)"}`, background: "rgba(255,255,255,0.04)", color: "#E8EAED", fontSize: 10, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />
        {errors.pass && <div style={{ fontSize: 8, color: "#FF5F6D", marginTop: 3, paddingLeft: 4 }}>{errors.pass}</div>}
      </div>

      <button
        type="submit"
        style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: GRAD, color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {loading ? <div style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "Get Started →"}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  );
}

"use client";
import { useState, type FormEvent } from "react";
import { Logo, api, Alert } from "./ui";
export default function AccessGate() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("preview", "POST", {
        code: new FormData(e.currentTarget).get("code"),
      });
      location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Logo />
        <p className="eyebrow">Bald ist es so weit</p>
        <h1>
          Die besten Momente
          <br />
          <em>kommen noch.</em>
        </h1>
        <p>
          Diese Website befindet sich in der Vorschau. Gib deinen Zugangscode
          ein.
        </p>
        <form onSubmit={submit}>
          <label className="field">
            Zugangscode
            <input type="password" name="code" required autoComplete="off" />
          </label>
          <button className="button" disabled={busy}>
            Website öffnen ↗
          </button>
        </form>
        {error && <Alert>{error}</Alert>}
      </div>
    </main>
  );
}

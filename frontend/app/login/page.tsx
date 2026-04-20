"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Logging in...");
    const res = await fetch(`/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      setStatus(`Login failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as { access_token: string };
    localStorage.setItem("access_token", data.access_token);
    window.dispatchEvent(new Event("auth-changed"));
    setStatus("Logged in. Token stored in localStorage.");
  }

  return (
    <div className="glass-card max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">Login</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Email
          </label>
          <input 
            className="input-premium w-full"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="you@example.com" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Password
          </label>
          <input
            className="input-premium w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
          />
        </div>
        <button type="submit" className="btn-primary font-bold">
          Login
        </button>
        {status ? <div className="text-sm text-brand animate-pulse">{status}</div> : null}
      </form>
    </div>
  );
}

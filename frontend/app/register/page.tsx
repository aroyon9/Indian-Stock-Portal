"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Registering...");
    const res = await fetch(`/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName || null, password })
    });
    if (!res.ok) {
      setStatus(`Register failed (${res.status})`);
      return;
    }
    setStatus("Registered. Now login.");
  }

  return (
    <div className="glass-card max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">Register</h2>
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
            Full name (optional)
          </label>
          <input 
            className="input-premium w-full"
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            placeholder="Your name" 
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
            placeholder="Min 8 characters"
            type="password"
          />
        </div>
        <button type="submit" className="btn-primary font-bold">
          Create account
        </button>
        {status ? <div className="text-sm text-brand animate-pulse">{status}</div> : null}
      </form>
    </div>
  );
}

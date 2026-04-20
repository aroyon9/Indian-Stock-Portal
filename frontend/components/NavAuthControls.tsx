"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MeResponse = {
  id: number;
  email: string;
  full_name: string | null;
};

function normalizeName(profile: MeResponse): string {
  const source = (profile.full_name || profile.email || "").trim();
  if (!source) return "User";
  const firstToken = source.split("@")[0].trim().split(/\s+/)[0];
  return firstToken || "User";
}

export default function NavAuthControls() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    if (typeof window === "undefined") return;

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setDisplayName(null);
      return;
    }

    try {
      const res = await fetch("/api/v1/me", {
        method: "GET",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        window.localStorage.removeItem("access_token");
        setDisplayName(null);
        return;
      }
      const me = (await res.json()) as MeResponse;
      setDisplayName(normalizeName(me));
    } catch {
      setDisplayName(null);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const onAuthChanged = () => {
      void loadUser();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "access_token") {
        void loadUser();
      }
    };

    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [loadUser]);

  const loggedIn = useMemo(() => Boolean(displayName), [displayName]);

  const handleLogout = () => {
    window.localStorage.removeItem("access_token");
    setDisplayName(null);
    window.dispatchEvent(new Event("auth-changed"));
    router.push("/login");
  };

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className="text-sm font-medium text-muted hover:text-white transition-colors">
          Sign In
        </Link>
        <Link href="/register" className="btn-primary text-sm font-semibold">
          Join Free
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-semibold text-brand whitespace-nowrap">As - {displayName}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="text-sm font-medium text-muted hover:text-white transition-colors"
      >
        Log Off
      </button>
    </div>
  );
}

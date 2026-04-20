"use client";

import { useEffect } from "react";

const RELOAD_ONCE_KEY = "portal_chunk_reload_once";

function shouldRecoverFromError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("chunkloaderror") ||
    text.includes("loading chunk") ||
    text.includes("failed to fetch dynamically imported module")
  );
}

export default function ChunkErrorRecovery() {
  useEffect(() => {
    const tryRecover = (rawMessage: unknown) => {
      const message = String(rawMessage ?? "");
      if (!shouldRecoverFromError(message)) return;

      if (sessionStorage.getItem(RELOAD_ONCE_KEY) === "1") {
        sessionStorage.removeItem(RELOAD_ONCE_KEY);
        return;
      }

      sessionStorage.setItem(RELOAD_ONCE_KEY, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      tryRecover(event?.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason as { message?: string } | undefined;
      tryRecover(reason?.message ?? String(event?.reason ?? ""));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

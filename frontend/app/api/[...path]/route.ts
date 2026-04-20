import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const BACKEND_REQUEST_TIMEOUT_MS = 20000;

function normalizeBackendBaseUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/\/api(?:\/v1)?$/i, "");
}

async function readBackendUrlFromState(): Promise<string | null> {
  const stateFiles = [
    path.join(process.cwd(), ".logs", "portal-processes.json"),
    path.join(process.cwd(), "..", ".logs", "portal-processes.json"),
  ];

  for (const stateFile of stateFiles) {
    try {
      const content = await fs.readFile(stateFile, "utf8");
      const parsed = JSON.parse(content) as { backendUrl?: unknown };
      if (typeof parsed.backendUrl === "string" && parsed.backendUrl.trim()) {
        return parsed.backendUrl;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function getBackendBaseUrls() {
  const out: string[] = [];
  const push = (value?: string | null) => {
    const normalized = normalizeBackendBaseUrl(value);
    if (normalized) out.push(normalized);
  };

  push(process.env.BACKEND_INTERNAL_URL);
  push(process.env.BACKEND_URL);
  push(process.env.NEXT_PUBLIC_API_URL);
  push(await readBackendUrlFromState());

  push("http://127.0.0.1:8010");
  push("http://localhost:8010");
  push("http://127.0.0.1:8000");
  push("http://localhost:8000");

  return Array.from(new Set(out));
}

function filteredHeaders(req: NextRequest): Headers {
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const url = new URL(req.url);
  const path = params.path.join("/");
  const backendPath = path.startsWith("api/") ? path : `api/${path}`;
  const baseUrls = await getBackendBaseUrls();
  const body =
    req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;
  const initBase: RequestInit = {
    method: req.method,
    headers: filteredHeaders(req),
    redirect: "manual",
  };
  if (body) {
    initBase.body = body;
  }

  let lastError: unknown = null;
  for (const base of baseUrls) {
    const backendUrl = `${base}/${backendPath}${url.search}`;
    try {
      const res = await fetchWithTimeout(backendUrl, initBase, BACKEND_REQUEST_TIMEOUT_MS);
      return new NextResponse(res.body, { status: res.status, headers: res.headers });
    } catch (err) {
      lastError = err;
    }
  }

  return NextResponse.json(
    {
      detail: "Backend API unavailable",
      attempted: baseUrls,
      error: lastError instanceof Error ? lastError.message : "Unknown proxy error",
    },
    { status: 502 },
  );
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}

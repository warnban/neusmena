import "server-only";

import type { NextRequest } from "next/server";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_ACCOUNT = 5;
const MAX_FAILS_PER_IP = 30;

type Bucket = { fails: number; windowStart: number; blockedUntil: number };

/** In-memory: рассчитано на один процесс Next за nginx; после рестарта счётчики обнуляются. */
const buckets = new Map<string, Bucket>();

function bucket(key: string, now: number): Bucket {
  const b = buckets.get(key);
  if (!b || (now - b.windowStart > WINDOW_MS && b.blockedUntil <= now)) {
    const fresh = { fails: 0, windowStart: now, blockedUntil: 0 };
    buckets.set(key, fresh);
    return fresh;
  }
  return b;
}

function prune(now: number) {
  if (buckets.size < 5000) return;
  buckets.forEach((b, key) => {
    if (b.blockedUntil <= now && now - b.windowStart > WINDOW_MS) buckets.delete(key);
  });
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function keys(scope: string, ip: string, account: string) {
  return { ipKey: `${scope}:ip:${ip}`, accountKey: `${scope}:acc:${account.trim().toLowerCase()}` };
}

/** Секунд до разблокировки, либо 0 если вход разрешён. */
export function loginBlockedFor(scope: string, ip: string, account: string): number {
  const now = Date.now();
  const { ipKey, accountKey } = keys(scope, ip, account);
  const until = Math.max(bucket(ipKey, now).blockedUntil, bucket(accountKey, now).blockedUntil);
  return until > now ? Math.ceil((until - now) / 1000) : 0;
}

export function registerLoginFailure(scope: string, ip: string, account: string): void {
  const now = Date.now();
  prune(now);
  const { ipKey, accountKey } = keys(scope, ip, account);
  for (const [key, max] of [
    [ipKey, MAX_FAILS_PER_IP],
    [accountKey, MAX_FAILS_PER_ACCOUNT],
  ] as const) {
    const b = bucket(key, now);
    b.fails += 1;
    if (b.fails >= max) b.blockedUntil = now + WINDOW_MS;
  }
}

export function registerLoginSuccess(scope: string, account: string): void {
  buckets.delete(`${scope}:acc:${account.trim().toLowerCase()}`);
}

export function tooManyAttemptsMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Слишком много неудачных попыток входа. Повторите через ${minutes} мин.`;
}

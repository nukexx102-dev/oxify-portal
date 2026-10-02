// Simple in-memory sliding-window rate limiter, keyed by client IP.
//
// Not distributed — this only protects whichever single warm serverless
// instance happens to receive a given request, and resets on cold start.
// That's a deliberate tradeoff, not an oversight: there's no password to
// "crack" here, the actual threat is a script enumerating order-number +
// email combinations, and this is enough to blunt that without adding
// paid infra (Redis/Vercel KV) for v1. Revisit if traffic volume or abuse
// patterns ever justify a real distributed limiter.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, { count: number; windowStart: number }>();

// Opportunistic cleanup so `attempts` doesn't grow unbounded across a long
// warm-instance lifetime — cheap, doesn't need to be exact.
let callsSinceSweep = 0;
function sweepStale(now: number) {
  callsSinceSweep += 1;
  if (callsSinceSweep < 200) return;
  callsSinceSweep = 0;
  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > WINDOW_MS) attempts.delete(key);
  }
}

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  sweepStale(now);

  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

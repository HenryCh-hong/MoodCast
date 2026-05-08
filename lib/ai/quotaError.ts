// Detection + typed error for AI provider quota / rate-limit failures.
//
// Both Anthropic and Google SDKs surface quota exhaustion in different shapes:
//   - Anthropic: `status: 429` and message text like "rate limit"
//   - Google Gemini: `status: 429`, code "RESOURCE_EXHAUSTED", or messages
//     containing "quota", "exceeded", "insufficient quota"
//
// We normalise these into a single `QuotaExhaustedError` so callers (CLI + API
// route) can react with one code path and surface a structured response.

import type { Provider } from './provider';

export class QuotaExhaustedError extends Error {
  readonly code = 'AI_QUOTA_EXCEEDED';
  readonly provider: Provider;
  readonly originalMessage: string;
  constructor(provider: Provider, originalMessage: string) {
    super(`AI provider quota exhausted (${provider})`);
    this.name = 'QuotaExhaustedError';
    this.provider = provider;
    this.originalMessage = originalMessage;
  }
}

const QUOTA_PATTERNS: RegExp[] = [
  /quota/i,
  /rate[\s_-]?limit/i,
  /resource[\s_-]?exhausted/i,
  /insufficient[\s_-]?quota/i,
  /api key.*(limit|exhaust)/i,
  /too many requests/i,
  /\b429\b/,
];

interface ErrorLike {
  status?: number;
  statusCode?: number;
  code?: string | number;
  message?: string;
}

export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const e = err as ErrorLike;
  if (e.status === 429 || e.statusCode === 429) return true;
  if (typeof e.code === 'number' && e.code === 429) return true;
  if (typeof e.code === 'string' && /RESOURCE_EXHAUSTED|insufficient_quota|rate_limit/i.test(e.code)) return true;
  const message = e.message ?? String(err);
  return QUOTA_PATTERNS.some((re) => re.test(message));
}

export function asQuotaError(err: unknown, provider: Provider): QuotaExhaustedError | null {
  if (err instanceof QuotaExhaustedError) return err;
  if (!isQuotaError(err)) return null;
  const original = err instanceof Error ? err.message : String(err);
  return new QuotaExhaustedError(provider, original);
}

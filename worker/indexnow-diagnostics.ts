import config from '../src/data/indexnow.json';

/** The fixed public provider may return untrusted HTML or reflect the ownership key. */
export async function indexNowDiagnostics(response: Response) {
  const headers: Record<string, string> = {};
  for (const name of [
    'content-type',
    'server',
    'retry-after',
    'date',
    'x-request-id',
    'x-msedge-ref',
    'cf-ray',
  ]) {
    const value = response.headers.get(name);
    if (value) headers[name] = value.slice(0, 200);
  }
  let excerpt: string | null = null;
  let bodyTruncated = false;
  if (![200, 202].includes(response.status) && response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (size < 4096) {
        const { value, done } = await reader.read();
        if (done) break;
        const part = value.subarray(0, 4096 - size);
        chunks.push(part);
        size += part.length;
        if (part.length < value.length || size === 4096) bodyTruncated = true;
      }
      const data = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      const plain = new TextDecoder()
        .decode(data)
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replaceAll(config.key, '[ownership-key]')
        .replace(/Bearer\s+[^\s"<>]+/gi, 'Bearer [redacted]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
      excerpt = plain.slice(0, 800) || null;
    } catch {
      excerpt = '[response body unavailable]';
    } finally {
      void reader.cancel().catch(() => {});
    }
  } else {
    void response.body?.cancel().catch(() => {});
  }
  return { receivedAt: new Date().toISOString(), headers, excerpt, bodyTruncated };
}

export function indexNowDelay(httpStatus: number | null, failureStreak: number, retryAfter: number) {
  const day = 86400_000;
  const adaptive = httpStatus === 429 ? day * Math.min(3, Math.max(1, failureStreak)) : day;
  return Math.max(day, adaptive, Number.isFinite(retryAfter) ? Math.max(0, retryAfter) : 0);
}

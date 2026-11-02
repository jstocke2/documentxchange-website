const DEFAULT_TIMEOUT_MS = 15000;

export async function requestJson(path, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const relayAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) relayAbort();
  else signal?.addEventListener('abort', relayAbort, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      ...fetchOptions,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(fetchOptions.headers || {}) },
    });
  } catch (error) {
    if (signal?.aborted) {
      const aborted = new Error('Request cancelled');
      aborted.name = 'AbortError';
      throw aborted;
    }
    if (timedOut || error?.name === 'AbortError') {
      throw new Error('The server took too long to respond. Please try again.');
    }
    throw new Error('Unable to connect to DocumentXchange. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', relayAbort);
  }

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  return data;
}

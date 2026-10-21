import { useRef, useCallback } from 'react';

/**
 * Generates one stable key per form instance, sent with a settlement so the
 * API can recognise a double submit and record the repayment only once. The key
 * is regenerated only after a successful submission.
 */
function generateKey() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '');
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function useIdempotencyKey() {
  const keyRef = useRef(generateKey());
  const reset = useCallback(() => {
    keyRef.current = generateKey();
  }, []);
  return { key: keyRef.current, reset };
}

export default useIdempotencyKey;

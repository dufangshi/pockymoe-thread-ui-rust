import { createContext, useContext } from 'react';

/** A failed turn's error, shown on the turn's prompt. */
export const TurnFailureContext = createContext<{ promptId: string; error: string } | null>(null);

export function useTurnFailure(itemId: string) {
  const failure = useContext(TurnFailureContext);
  return failure?.promptId === itemId ? failure.error : null;
}

/** The readable part of an error such as `ACP session/prompt failed: {"code":…,"message":"Internal error: …"}`. */
export function failureMessage(error: string) {
  const start = error.indexOf('{');
  if (start >= 0) {
    try {
      const parsed = JSON.parse(error.slice(start)) as { message?: unknown };
      if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.replace(/^Internal error:\s*/, '').trim();
    } catch { /* not JSON */ }
  }
  return error.trim();
}

/** A reply that only repeats its turn's error, like the one Claude writes for an API error. */
export function echoesFailure(error: string, text: string) {
  const reply = text.trim();
  return reply.length >= 8 && (error.includes(reply) || failureMessage(error).includes(reply));
}

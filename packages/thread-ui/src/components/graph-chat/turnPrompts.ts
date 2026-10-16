import { createContext, useContext } from 'react';

/** The turn a prompt belongs to: which prompt started it, and its error if it failed. */
export const TurnPromptContext = createContext<{ firstPromptId: string; error: string | null } | null>(null);

/** The error of the failed turn this prompt started. */
export function useTurnFailure(itemId: string) {
  const turn = useContext(TurnPromptContext);
  return turn?.firstPromptId === itemId ? turn.error : null;
}

/** Whether this prompt was added while the turn was already working. */
export function useAddedPrompt(itemId: string) {
  const turn = useContext(TurnPromptContext);
  return Boolean(turn && turn.firstPromptId !== itemId);
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

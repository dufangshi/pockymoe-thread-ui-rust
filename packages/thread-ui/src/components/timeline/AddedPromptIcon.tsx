/** A prompt joining a turn that is already running: a line bending into the
    turn's own line, the way a merge reads. */
export function AddedPromptIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`thread-added-prompt-icon ${className}`} fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 19h18" />
      <path d="M7 4v3.5a6.5 6.5 0 0 0 6.5 6.5H19" />
      <path d="m16 11 3 3-3 3" />
    </svg>
  );
}

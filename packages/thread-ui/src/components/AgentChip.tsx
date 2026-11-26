import { useLayoutEffect, type DependencyList, type RefObject } from 'react';

/* An agent's mark (`.thread-map-agent`, thread-map.css): the theme pack's art
   for it, else a monogram in the agent's own colour. The thread map and the
   composer's model picker use the same mark. */

/** Monograms for agents a theme gives no art. */
const MONOGRAMS: Record<string, string> = {
  claude: 'Cl', codex: 'Cx', copilot: 'Co', cursor: 'Cu', deepseek: 'DS', gemini: 'Ge', grok: 'Gk', kimi: 'Ki', opencode: 'OC', qwen: 'Qw',
};
export const agentMonogram = (agent: string) => MONOGRAMS[agent] ?? agent.replace(/[^a-z0-9]/gi, '').slice(0, 2).replace(/^./, c => c.toUpperCase());

/** An agent's mark: the theme's art for it (see `useAgentArt`), else a monogram. */
export function AgentChip({ agent }: { agent: string | undefined }) {
  return agent ? <span className="thread-map-agent" data-agent={agent} aria-hidden="true">{agentMonogram(agent)}</span> : null;
}

/** Marks the chips under `root` whose agent the theme pack draws (`data-art`).
    Read once per agent after structural or theme changes, never per chip on hover. */
export function useAgentArt(root: RefObject<HTMLElement | null>, deps: DependencyList) {
  useLayoutEffect(() => {
    const paint = () => {
      const chips = [...(root.current?.querySelectorAll<HTMLElement>('.thread-map-agent') ?? [])];
      const art = new Map<string, boolean>();
      for (const chip of chips) if (!art.has(chip.dataset.agent!)) art.set(chip.dataset.agent!, getComputedStyle(chip).getPropertyValue('--theme-agent-avatar').includes('url('));
      for (const chip of chips) chip.toggleAttribute('data-art', art.get(chip.dataset.agent!) ?? false);
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-preset', 'data-theme-effective'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers name what changes the chips
  }, deps);
}

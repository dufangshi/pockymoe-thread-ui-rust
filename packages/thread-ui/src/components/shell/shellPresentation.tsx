import { translate } from '../../i18n';
import type { ShellStatusDto } from '@pockymoe/shared';
import { cssHexVariable } from '../themeHooks';

/** Matches the workbench panel surfaces so the terminal reads as part of the panel.
 *  A theme preset may override the surface colors with `--terminal-bg`, `--terminal-fg`,
 *  `--terminal-cursor` and `--terminal-selection`, and any ANSI color with
 *  `--terminal-<name>` (`--terminal-red`, `--terminal-bright-black`, …), all hex, on the
 *  terminal's container. */
export function terminalThemeFor(effectiveTheme: 'light' | 'dark', container?: Element | null) {
  const light = effectiveTheme === 'light';
  const background = cssHexVariable(container, '--terminal-bg') ?? (light ? '#ebeeeb' : '#0f1317');
  const foreground = cssHexVariable(container, '--terminal-fg') ?? (light ? '#22282b' : '#d6dde6');
  const ansi = {
    black: light ? '#c4c9c4' : '#1c242a',
    brightBlack: light ? '#6b736e' : '#5b6770',
    red: light ? '#c62f3a' : '#f87171',
    brightRed: light ? '#e0444f' : '#fb7185',
    green: light ? '#13803f' : '#4ade80',
    brightGreen: light ? '#18994c' : '#86efac',
    yellow: light ? '#9a6700' : '#fbbf24',
    brightYellow: light ? '#b07800' : '#fcd34d',
    blue: light ? '#2563eb' : '#93c5fd',
    brightBlue: light ? '#3b82f6' : '#60a5fa',
    magenta: light ? '#7c3aed' : '#c4b5fd',
    brightMagenta: light ? '#8b5cf6' : '#a78bfa',
    cyan: light ? '#0e7490' : '#67e8f9',
    brightCyan: light ? '#0891b2' : '#22d3ee',
    white: light ? '#4b5258' : '#e2e8f0',
    brightWhite: light ? '#121416' : '#f8fafc',
  };
  return {
    background,
    foreground,
    cursor: cssHexVariable(container, '--terminal-cursor') ?? foreground,
    cursorAccent: background,
    selectionBackground: cssHexVariable(container, '--terminal-selection') ?? (light ? 'rgba(0, 139, 83, 0.24)' : 'rgba(0, 204, 118, 0.28)'),
    ...Object.fromEntries(Object.entries(ansi).map(([name, color]) => [
      name,
      cssHexVariable(container, `--terminal-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`) ?? color,
    ])) as typeof ansi,
  };
}

export function statusLabel(status: ShellStatusDto) {
  switch (status) {
    case 'not_created':
      return translate("chat.notCreated");
    case 'creating':
      return translate("chat.creating");
    case 'running':
      return translate("chat.running");
    case 'attached':
      return translate("chat.attached");
    case 'detached':
      return translate("chat.detached");
    case 'exited':
      return translate("chat.exited");
    case 'not_found':
      return translate("chat.missing");
    case 'workspace_missing':
      return translate("chat.workspaceMissing");
  }
}

export function basenameFromPath(filePath: string | null | undefined) {
  if (!filePath) {
    return '';
  }

  const normalized = filePath.replace(/[\\/]+$/, '');
  if (!normalized) {
    return '';
  }

  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? normalized;
}

export function buildPromptLabel(
  cwdBaseName: string | null | undefined,
  envPrefix: string | null | undefined,
) {
  const parts = [envPrefix?.trim(), cwdBaseName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

export function clampPaneRatio(value: number) {
  return Math.min(75, Math.max(25, value));
}

# Agent notes

This repository is Pockymoe's shared thread UI. It is checked out at
`pockymoe-thread-ui/` inside the Pockymoe repository (`dufangshi/pockymoe`), which
pins it through `thread-ui.sha` and deploys it with the Web UI.

## UI

- Every change follows Pockymoe's UI and interaction principles,
  `docs/ui-principles.md` in the Pockymoe repository (`../docs/ui-principles.md`
  from this checkout). Read it before designing a control, menu, window, status
  mark, input or wording.
- Reuse the shared building blocks it names instead of making variants:
  `CopyButton`/`PathChip`, `StatusMark`, `useMenuKeyboard`, `useModalFocus`,
  `confirmAsync`/`ConfirmDialog` (never `window.confirm`), `MiddleName`.
- An exception needs a reason in a code comment and in that document.
- Theme packs (in the Pockymoe repository's `themes/`) change appearance only.
- Before finishing, look at the change in every theme, light and dark, at a phone
  and a desktop width.

## Building

- `packages/thread-ui/dist` is committed: run `corepack pnpm --filter @pockymoe/thread-ui build`
  and commit `dist` with the source change.
- Component CSS must be imported from `src/index.ts` as well as `styles.css`.

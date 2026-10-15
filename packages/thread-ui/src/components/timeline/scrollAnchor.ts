import { createContext } from 'react';

/** The timeline that holds a clicked control in place. `hold` applies the hold
    at once; a toggle calls it from the layout effect of its commit, so the
    control never shows out of place, not even for one frame. */
export const ScrollAnchorContext = createContext<{ hold?: () => void }>({});

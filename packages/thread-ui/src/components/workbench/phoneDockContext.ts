import { createContext, useContext } from 'react';

/** True inside a workbench showing the one-handed phone dock: the composer then
    leaves usage to the status bar and the pinned threads to the dock. */
export const PhoneDockContext = createContext(false);

export function usePhoneDock() {
  return useContext(PhoneDockContext);
}

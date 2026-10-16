import { createContext, useContext } from 'react';

export const FilePanelContext = createContext<{
  close: () => void;
  label?: string;
  /** Where the files view sits beside the conversation, it can be minimized: its
      tree a strip on the left, its editor a tab on the right edge. */
  minimized?: boolean;
  setMinimized?: (minimized: boolean) => void;
} | null>(null);
export const useFilePanel = () => useContext(FilePanelContext);

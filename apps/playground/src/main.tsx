import { installStatusBeat } from '@pockymoe/thread-ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PlaygroundApp } from './PlaygroundApp';
import './styles.css';

installStatusBeat();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlaygroundApp />
  </StrictMode>,
);

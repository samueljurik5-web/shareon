import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/index.css';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { UiProvider } from './context/UiContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UiProvider>
          <App />
        </UiProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

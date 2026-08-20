import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

async function bootstrap() {
  let useMock = true;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/auth/me', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) useMock = false;
  } catch {
    // Backend unreachable — use mock
  }

  if (useMock) {
    const { installMock } = await import('./mock');
    installMock();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Install mock immediately — no probe delay.
// On local dev the real Express backend is on the same origin, so the mock's
// fetch interceptor defers any call that returns valid JSON with a user to the
// real backend. On Vercel/static hosts there is no backend, so every /api/*
// call is handled in-memory.
async function bootstrap() {
  const { installMock } = await import('./mock');
  installMock();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();

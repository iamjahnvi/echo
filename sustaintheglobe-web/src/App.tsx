import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { create } from 'zustand';
import moment from 'moment';
import { fetchHealth, getApiBaseUrl } from './api';

type Store = { count: number; inc: () => void };
export const useStore = create<Store>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));

export function backendMode(): string {
  const v = (import.meta as never as { env: Record<string, string | undefined> }).env
    .VITE_BACKEND;
  if (v === undefined || v === '' || v === 'firebase') return 'firebase';
  return v;
}

function Home() {
  const { count, inc } = useStore();
  const mode = backendMode();
  const apiBase =
    typeof import.meta !== 'undefined'
      ? getApiBaseUrl(
          (import.meta as never as { env: Record<string, string | undefined> })
            .env,
        )
      : '';
  const [health, setHealth] = useState<string>(
    mode === 'firebase'
      ? 'Firebase mode — backend API not used.'
      : apiBase === ''
        ? 'API URL not configured (VITE_API_URL).'
        : 'Checking backend…',
  );

  useEffect(() => {
    if (mode === 'firebase' || apiBase === '') return;
    let cancelled = false;
    fetchHealth(apiBase)
      .then((body) => {
        if (!cancelled) setHealth(`Backend: ${body.status} (${body.service})`);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setHealth(
            `Backend unavailable: ${err instanceof Error ? err.message : String(err)}`,
          );
      });
    return () => {
      cancelled = true;
    };
  }, [mode, apiBase]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">SustainTheGlobe</h1>
      <p>Backend mode: {mode}</p>
      <p>Backend status: {health}</p>
      <p>Today: {moment().format('YYYY-MM-DD')}</p>
      <p>Count: {count}</p>
      <button onClick={inc}>Increment</button>
      <nav>
        <Link to="/about">About</Link>
      </nav>
    </div>
  );
}

function About() {
  return (
    <div className="p-8">
      <h2>About</h2>
      <Link to="/">Home</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}

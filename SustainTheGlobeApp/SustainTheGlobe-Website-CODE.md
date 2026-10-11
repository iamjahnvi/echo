# SustainTheGlobe — complete website source code

This one file contains **every file needed to run the redesigned SustainTheGlobe website** (React + Vite + TypeScript + Tailwind CSS v3). To use it: create a project folder, then recreate each file below using the **exact same relative path** shown in its heading, and paste the code exactly. Then run the commands in *Setup*.

> The code in the sections below was copied **verbatim from the project on disk** (not retyped), so it is the exact, working source.

---

## What's inside

| Area | Files |
|---|---|
| Redesigned UI | `src/App.tsx`, `src/pages.tsx`, `src/ui.tsx`, `src/dashboard.tsx` |
| Design tokens & styles | `tailwind.config.js`, `postcss.config.js`, `src/index.css` |
| Build/tooling config | `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.env.example`, `public/robots.txt` |
| App logic (behavior unchanged) | `src/main.tsx`, `src/api.ts`, `src/auth.tsx`, `src/lib.ts` |
| Tests | `src/api.test.ts`, `src/auth.test.ts`, `src/lib.test.ts` |

**Not included:** the AWS backend (`backend/`). The website is a front end and renders its full design without it; only live sign-in/logging need the deployed API.

---

## Requirements

- **Node.js 20 or newer** and **npm**.

## Setup

1. Create a folder (for example `sustaintheglobe-web`).
2. Recreate the files below at these relative paths:

```
sustaintheglobe-web/
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── public/
│   └── robots.txt
└── src/
    ├── App.tsx
    ├── api.test.ts
    ├── api.ts
    ├── auth.test.ts
    ├── auth.tsx
    ├── dashboard.tsx
    ├── index.css
    ├── lib.test.ts
    ├── lib.ts
    ├── main.tsx
    ├── pages.tsx
    └── ui.tsx
```

3. Open a terminal in that folder and run:

```bash
npm install
npm run dev
```

4. Open the URL Vite prints (usually `http://localhost:5173/`).

## Seeing the full UI (sign-in + dashboard)

By default the app runs in **"demo mode"**: it shows the public marketing pages (Home, About) plus an honest note where live logging would be. That is intentional — the design is real, no data is faked.

To also show the **sign-in / sign-up screen** (and the dashboard once signed in), create a file named `.env.local` next to `package.json`, copy the contents of `.env.example` into it, and set:

```
VITE_BACKEND=aws
```

Then restart `npm run dev`.

To actually sign in and log actions you need a deployed AWS backend (Amazon Cognito + API Gateway). Put its **public** values in `.env.local` (`VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION`). Those come from the SAM stack outputs — never put secrets in the browser environment.

## Verify

```bash
npm test       # 42 tests should pass
npm run build  # TypeScript + Vite production build
```

## Notes

- **No new dependencies** beyond those already listed in `package.json`.
- Colors are reusable Tailwind tokens: `forest`, `ivory`, `cream`, `mist`, `sage`, `sand`, `ink`, `moss`, `clay`.
- Headings use an editorial serif stack; body/UI uses a system sans stack. No external fonts or images are loaded (the art is self-contained SVG).
- Motion respects `prefers-reduced-motion`.
- The front end never calculates points — the server does. Accessibility targets are met (contrast ≥ 4.5:1, semantic landmarks, labels, `aria-live`).

---

# Source files


## `package.json`

````json
{
  "name": "sustaintheglobe-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@mui/material": "^5.15.10",
    "amazon-cognito-identity-js": "^6.3.20",
    "firebase": "^10.8.0",
    "moment": "^2.30.1",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-router-dom": "^6.22.1",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.4",
    "vitest": "^1.6.1"
  }
}
````

## `tsconfig.json`

````json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
````

## `tsconfig.node.json`

````json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
````

## `vite.config.ts`

````ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Cognito's browser dependency on `buffer` expects Node's `global`.
  // Point that identifier at the standard browser global without adding a polyfill.
  define: { global: 'globalThis' },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    // Only run the web app's own tests; ignore any nested/synced backend copies.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  } as never,
});
````

## `tailwind.config.js`

````js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Muted, natural palette. Light warm surfaces carry most of the UI;
      // deep forest is reserved for primary actions and a few dark bands.
      colors: {
        forest: {
          50: '#f1f5f2',
          100: '#e1ebe5',
          200: '#c5d7cc',
          300: '#a0baa8',
          400: '#74927d',
          500: '#4e6e5a',
          600: '#244337', // brand primary
          700: '#1e3830',
          800: '#1b3028', // deep pine — dark sections / footer
          900: '#16261f',
          950: '#0c1712',
        },
        ivory: '#f5f3ea', // main page background
        cream: '#efece1', // alt warm surface
        mist: '#d5dfd1', // subtle card surface
        sage: '#a8b5a0', // supporting accent
        sand: '#e4e2d8', // dividers / understated borders
        ink: '#1b201b', // primary text (deepened for a darker, higher-contrast reading experience)
        moss: '#4c574f', // secondary text — deepened from the original #68746a to clear AA (4.5:1) on every surface, incl. mist
        clay: {
          100: '#f4e8db',
          200: '#e9d5bd',
          300: '#dcbd97',
          400: '#cb9a63',
          500: '#b67b4b',
          600: '#9c6438',
          700: '#7d4f2d',
        },
      },
      fontFamily: {
        // Editorial serif for headings; highly readable sans for UI.
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: [
          '"Iowan Old Style"',
          '"Palatino Linotype"',
          'Palatino',
          '"Book Antiqua"',
          'Georgia',
          '"Times New Roman"',
          'serif',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(12, 23, 18, 0.04), 0 10px 30px -18px rgba(12, 23, 18, 0.18)',
        lift: '0 2px 6px rgba(12, 23, 18, 0.05), 0 28px 52px -26px rgba(12, 23, 18, 0.28)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      transitionTimingFunction: {
        gentle: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'points-pop': {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease-out both',
        'points-pop': 'points-pop 0.45s ease-out',
      },
    },
  },
  plugins: [],
};
````

## `postcss.config.js`

````js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
````

## `index.html`

````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#244337" />
    <meta
      name="description"
      content="SustainTheGlobe — record everyday environmental actions, earn server-verified points, and climb the community leaderboard."
    />
    <title>SustainTheGlobe — Everyday green actions, verified</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

## `.env.example`

````ini
# AWS mode uses the authenticated SustainTheGlobe API. During Vite development,
# /api is proxied to SAM at http://127.0.0.1:3000; VITE_API_URL is only needed
# when connecting a non-development build to a deployed API.
VITE_BACKEND=aws
# Deployed API base URL (leave blank for local Vite + SAM development).
VITE_API_URL=PASTE_API_GATEWAY_URL_HERE
# Real public IDs are required for Cognito sign-in. Local SAM does not emulate Cognito.
# Get these from deployed SAM outputs UserPoolId and UserPoolClientId.
VITE_COGNITO_USER_POOL_ID=PASTE_USER_POOL_ID_HERE
VITE_COGNITO_CLIENT_ID=PASTE_APP_CLIENT_ID_HERE
# Cognito region is encoded in UserPoolId and inferred by the SDK.
VITE_COGNITO_REGION=us-east-1
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_SOME_KEY=
````

## `public/robots.txt`

````txt
User-agent: *
Allow: /
````

## `src/main.tsx`

````tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
````

## `src/index.css`

````css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    -webkit-text-size-adjust: 100%;
    scroll-behavior: smooth;
  }

  body {
    @apply bg-ivory font-sans text-ink antialiased;
  }

  h1,
  h2,
  h3,
  h4 {
    @apply font-serif text-forest-900;
    text-wrap: balance;
  }

  p {
    text-wrap: pretty;
  }

  ::selection {
    @apply bg-forest-200 text-forest-900;
  }

  :focus-visible {
    @apply outline-none ring-2 ring-forest-500 ring-offset-2 ring-offset-ivory;
  }

  /* Keep anchored sections clear of the sticky header. */
  :where(section[id], div[id], h2[id]) {
    scroll-margin-top: 6rem;
  }
}

@layer components {
  .eyebrow {
    @apply text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-moss;
  }

  .card {
    @apply rounded-3xl border border-sand/80 bg-white shadow-soft;
  }

  .card-pad {
    @apply p-6 sm:p-8;
  }

  .btn {
    @apply inline-flex select-none items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 ease-gentle focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55;
  }

  .btn-primary {
    @apply bg-forest-600 text-ivory shadow-soft hover:bg-forest-700 hover:shadow-lift active:scale-[0.98];
  }

  .btn-secondary {
    @apply border border-sand bg-white text-forest-800 hover:border-forest-300 hover:bg-cream active:scale-[0.98];
  }

  .btn-ghost {
    @apply px-4 text-forest-700 hover:bg-forest-50 active:scale-[0.98];
  }

  .btn-onDark {
    @apply bg-ivory text-forest-800 hover:bg-white active:scale-[0.98];
  }

  .btn-onDark-ghost {
    @apply border border-ivory/30 px-4 text-ivory hover:bg-ivory/10 active:scale-[0.98];
  }

  .input {
    @apply w-full rounded-2xl border border-sand bg-white px-4 py-3 text-sm text-ink placeholder:text-moss transition-colors focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200;
  }

  .label {
    @apply mb-1.5 block text-sm font-medium text-forest-800;
  }

  .hint {
    @apply text-xs leading-relaxed text-moss;
  }

  .badge {
    @apply inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700;
  }

  .chip {
    @apply inline-flex items-center gap-2 rounded-full border border-sand bg-white/70 px-3 py-1.5 text-xs font-medium text-moss;
  }

  .alert {
    @apply rounded-2xl px-4 py-3 text-sm leading-relaxed;
  }

  .alert-success {
    @apply bg-forest-50 text-forest-800;
  }

  .alert-error {
    @apply bg-[#fbeaea] text-[#8f2d2d];
  }

  .alert-info {
    @apply bg-cream text-moss;
  }

  .link {
    @apply font-medium text-forest-700 underline decoration-forest-300 underline-offset-4 transition-colors hover:text-forest-600 hover:decoration-forest-500;
  }

  .tnum {
    font-variant-numeric: tabular-nums;
  }
}

/* Gentle, one-shot scroll reveals. Content is never hidden if JS/motion is off. */
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

.reveal.is-visible {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  .reveal {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
````

## `src/App.tsx`

````tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { fetchHealth, getApiBaseUrl, getDevelopmentApiBaseUrl } from './api';
import { backendModeFromEnv } from './lib';
import { About, Home, NotFound } from './pages';
import type { BackendInfo } from './pages';
import {
  IconClose,
  IconLeaf,
  IconMenu,
  Logo,
  StatusPill,
  prefersReducedMotion,
} from './ui';
import type { StatusTone } from './ui';

/* ------------------------------------------------------------------ *
 * Backend status — preserves the existing health check, presented in
 * plain language instead of raw mode/status strings.
 * ------------------------------------------------------------------ */

function initialHealth(mode: string, apiBase: string): string {
  if (mode === 'firebase') return 'Firebase mode — backend API not used.';
  if (apiBase === '') return 'API URL not configured (VITE_API_URL).';
  return 'Checking backend…';
}

function describeBackend(
  mode: string,
  apiBase: string,
  health: string,
): { tone: StatusTone; label: string; detail: string } {
  if (mode === 'firebase')
    return {
      tone: 'muted',
      label: 'Demo mode',
      detail: 'Demo mode — the live backend API is not used in this build.',
    };
  if (apiBase === '')
    return {
      tone: 'warn',
      label: 'API not configured',
      detail:
        'The API URL is not configured, so sign-in and live logging stay hidden in this build.',
    };
  if (/unavailable|failed|could not/i.test(health))
    return { tone: 'error', label: 'API offline', detail: health };
  if (/^Backend:\s*ok/i.test(health))
    return { tone: 'ok', label: 'API online', detail: health.replace(/^Backend:\s*/i, 'Live API: ') };
  return { tone: 'warn', label: 'Checking API…', detail: 'Checking the backend connection…' };
}

function useBackend(): BackendInfo {
  const env =
    typeof import.meta !== 'undefined'
      ? (import.meta as never as { env: Record<string, string | undefined> & { DEV?: boolean } }).env
      : {};
  const mode = backendModeFromEnv(env);
  const configuredApiBase = getApiBaseUrl(env);
  const apiBase = env.DEV
    ? getDevelopmentApiBaseUrl(configuredApiBase, window.location.origin)
    : configuredApiBase;
  const ready = mode !== 'firebase' && apiBase !== '';

  const [health, setHealth] = useState<string>(() => initialHealth(mode, apiBase));

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchHealth(apiBase)
      .then((body) => {
        if (!cancelled) setHealth(`Backend: ${body.status} (${body.service})`);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setHealth(`Backend unavailable: ${err instanceof Error ? err.message : String(err)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, apiBase]);

  const { tone, label, detail } = describeBackend(mode, apiBase, health);
  return { mode, apiBase, ready, tone, label, detail };
}

/* ------------------------------------------------------------------ *
 * Scroll handling for in-page anchors and route changes
 * ------------------------------------------------------------------ */

function ScrollManager() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({
              behavior: prefersReducedMotion() ? 'auto' : 'smooth',
              block: 'start',
            });
          }
        });
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);
  return null;
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-forest-50 text-forest-800' : 'text-moss hover:bg-cream hover:text-forest-800'
  }`;
}

const HEADER_ANCHOR = 'rounded-full px-3.5 py-2 text-sm font-medium text-moss transition-colors hover:bg-cream hover:text-forest-800';

function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-sand/70 bg-ivory/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-full focus-visible:outline-none"
          aria-label="SustainTheGlobe — home"
          onClick={() => setOpen(false)}
        >
          <Logo />
          <span className="font-serif text-lg font-semibold tracking-tight text-forest-800">
            SustainTheGlobe
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <Link to="/#how" className={HEADER_ANCHOR}>
            How it works
          </Link>
          <NavLink to="/about" className={navLinkClass}>
            About
          </NavLink>
        </nav>

        <div className="hidden md:block">
          <Link to="/#start" className="btn btn-primary px-4 py-2.5 text-sm">
            Start logging
          </Link>
        </div>

        <button
          type="button"
          className="btn btn-ghost !px-3 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-sand/70 bg-ivory md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4" aria-label="Mobile">
            <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>
              Home
            </NavLink>
            <Link to="/#how" className={HEADER_ANCHOR} onClick={() => setOpen(false)}>
              How it works
            </Link>
            <Link to="/#actions" className={HEADER_ANCHOR} onClick={() => setOpen(false)}>
              Ways to help
            </Link>
            <NavLink to="/about" className={navLinkClass} onClick={() => setOpen(false)}>
              About
            </NavLink>
            <Link
              to="/#start"
              className="btn btn-primary mt-2 w-full"
              onClick={() => setOpen(false)}
            >
              Start logging
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

function SiteFooter({ backend }: { backend: BackendInfo }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 bg-forest-800 text-ivory sm:mt-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-forest-600 text-ivory ring-1 ring-ivory/15">
              <IconLeaf className="h-5 w-5" />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight">SustainTheGlobe</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ivory/70">
            Record environmental actions, earn server-verified points, and climb the community
            leaderboard — one honest entry at a time.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StatusPill tone={backend.tone} className="border-ivory/20 bg-ivory/10 text-ivory/85">
              {backend.label}
            </StatusPill>
          </div>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">Explore</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/" className="text-ivory/75 transition-colors hover:text-ivory">
                Home
              </Link>
            </li>
            <li>
              <Link to="/#mission" className="text-ivory/75 transition-colors hover:text-ivory">
                Our mission
              </Link>
            </li>
            <li>
              <Link to="/#how" className="text-ivory/75 transition-colors hover:text-ivory">
                How it works
              </Link>
            </li>
            <li>
              <Link to="/#actions" className="text-ivory/75 transition-colors hover:text-ivory">
                Ways to help
              </Link>
            </li>
            <li>
              <Link to="/about" className="text-ivory/75 transition-colors hover:text-ivory">
                About
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">Get started</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/#start" className="text-ivory/75 transition-colors hover:text-ivory">
                Start logging actions
              </Link>
            </li>
            <li>
              <Link to="/about" className="text-ivory/75 transition-colors hover:text-ivory">
                Read about the project
              </Link>
            </li>
          </ul>
          <p className="mt-5 max-w-xs text-xs leading-relaxed text-ivory/70">{backend.detail}</p>
        </div>
      </div>

      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-5 py-6 text-xs text-ivory/70 sm:flex-row sm:px-8">
          <p>© {year} SustainTheGlobe</p>
          <p>Points reflect the actions you submit, not measured environmental impact.</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

export default function App() {
  const backend = useBackend();
  return (
    <BrowserRouter>
      <ScrollManager />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-forest-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ivory"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14"
        >
          <Routes>
            <Route path="/" element={<Home backend={backend} />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <SiteFooter backend={backend} />
      </div>
    </BrowserRouter>
  );
}
````

## `src/pages.tsx`

````tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { AuthProvider } from './auth';
import { ACTION_META, ACTION_ORDER, AwsSection } from './dashboard';
import {
  HeroScene,
  IconArrowRight,
  IconCheck,
  IconGlobe,
  IconLeaf,
  IconLock,
  IconShield,
  IconTrend,
  IconInfo,
  MediaPanel,
  Reveal,
  SectionHeading,
  StatusPill,
  TopoPattern,
} from './ui';
import type { StatusTone } from './ui';

export interface BackendInfo {
  /** Raw mode from VITE_BACKEND ('firebase' | 'aws' | …). */
  mode: string;
  /** Resolved API base URL ('' when not configured). */
  apiBase: string;
  /** Fully resolved: aws mode with a usable API base. */
  ready: boolean;
  tone: StatusTone;
  /** Short, human-readable status for chips. */
  label: string;
  /** Full sentence for the footer status line. */
  detail: string;
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

function SectionLink({
  to,
  className,
  children,
  ariaLabel,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Link to={`/${to}`} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

function Hero({ backend }: { backend: BackendInfo }) {
  return (
    <section
      id="top"
      className="relative overflow-hidden rounded-4xl border border-sand/70 bg-cream/50 px-6 py-12 shadow-soft sm:px-10 sm:py-16"
    >
      <TopoPattern className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 text-forest-200/60" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-sage/20 blur-3xl" />

      <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="animate-fade-in-up">
          <p className="eyebrow">SustainTheGlobe · Environmental action tracker</p>
          <h1 className="mt-4 text-[clamp(2.1rem,5vw,3.4rem)] font-semibold leading-[1.05] tracking-tight">
            Turn everyday green choices into shared momentum.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-moss sm:text-lg">
            Record the environmental actions you already take — recycling, transit, energy,
            cleanups and planting — and watch them add up with a community that cares. Points are
            computed by the server and tied to your own account.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SectionLink to="#start" className="btn btn-primary">
              Start logging actions
              <IconArrowRight className="h-4 w-4" />
            </SectionLink>
            <Link to="/about" className="btn btn-secondary">
              Discover our mission
            </Link>
          </div>

          <ul className="mt-9 flex flex-wrap gap-2.5">
            <li>
              <StatusPill tone={backend.tone}>{backend.label}</StatusPill>
            </li>
            <li className="chip">
              <IconCheck className="h-3.5 w-3.5 text-forest-500" />
              Server-verified points
            </li>
            <li className="chip">
              <IconLock className="h-3.5 w-3.5 text-forest-500" />
              Private photo evidence
            </li>
            <li className="chip">
              <IconTrend className="h-3.5 w-3.5 text-forest-500" />
              Community leaderboard
            </li>
          </ul>
        </div>

        <div className="animate-fade-in">
          <MediaPanel ratio="aspect-[4/3] lg:aspect-[5/6]" alt="">
            <HeroScene className="h-full w-full" />
          </MediaPanel>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Mission
 * ------------------------------------------------------------------ */

const PRINCIPLES = [
  {
    Icon: IconShield,
    title: 'Honest by default',
    body: 'Points come from a fixed server-side rule table — never from the browser — so the numbers you see are the numbers that were earned.',
  },
  {
    Icon: IconLock,
    title: 'Private by design',
    body: 'Photos are stored privately and are treated as evidence of an action, not as surveillance. Only you can attach them to your record.',
  },
  {
    Icon: IconGlobe,
    title: 'Built to encourage',
    body: 'The goal is momentum, not a leaderboard that shames. A shared board makes quiet, everyday effort visible.',
  },
];

function Mission() {
  return (
    <section id="mission" aria-labelledby="mission-heading">
      <Reveal>
        <SectionHeading
          eyebrow="Our mission"
          title={<span id="mission-heading">Good habits deserve to be seen.</span>}
          lead="Most environmental effort happens quietly and alone — a full recycling bin, a walk instead of a drive, a bag of litter collected on the way home. None of it gets counted. SustainTheGlobe exists to make that effort visible, shared, and a little more rewarding."
        />
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PRINCIPLES.map((p, i) => (
          <Reveal key={p.title} delay={i * 80}>
            <article className="card card-pad h-full">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-forest-50 text-forest-600">
                <p.Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">{p.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * How it works
 * ------------------------------------------------------------------ */

const STEPS = [
  {
    n: '01',
    title: 'Record an action',
    body: 'Pick a category, add an optional note, and attach a photo if you like. It takes seconds.',
  },
  {
    n: '02',
    title: 'Earn verified points',
    body: 'The server scores each submission from a fixed rule table and stores it under your account.',
  },
  {
    n: '03',
    title: 'Grow together',
    body: 'Your totals and your place on the shared leaderboard update as your actions add up.',
  },
];

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title={<span id="how-heading">Three calm steps, no guilt.</span>}
          lead="SustainTheGlobe is deliberately simple. Record what you did, let the server do the maths, and let the totals speak for themselves."
        />
      </Reveal>

      <Reveal delay={80}>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-4xl border border-sand/80 bg-sand/70 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-white p-7 sm:p-8">
              <span className="tnum font-serif text-3xl text-forest-400">{s.n}</span>
              <h3 className="mt-4 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">{s.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Ways to help — the five real action categories
 * ------------------------------------------------------------------ */

function WaysToHelp() {
  return (
    <section id="actions" aria-labelledby="actions-heading">
      <Reveal>
        <SectionHeading
          eyebrow="Ways to help"
          title={<span id="actions-heading">Five everyday actions you can log today.</span>}
          lead="Each category is worth a fixed number of server-verified points. Start with whichever fits your day — they all count."
        />
      </Reveal>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ACTION_ORDER.map((key, i) => {
          const meta = ACTION_META[key];
          const Icon = meta.Icon;
          return (
            <Reveal key={key} delay={i * 60}>
              <article className="card group flex h-full flex-col p-6 transition-shadow duration-300 ease-gentle hover:shadow-lift">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-600 transition-colors duration-300 ease-gentle group-hover:bg-forest-600 group-hover:text-ivory">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="badge tnum">+{meta.points} pts</span>
                </div>
                <h3 className="mt-5 text-lg">{meta.label}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-moss">{meta.blurb}</p>
                <SectionLink
                  to="#start"
                  ariaLabel={`Log this action: ${meta.label}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 transition-colors hover:text-forest-600"
                >
                  Log this action
                  <IconArrowRight className="h-4 w-4 transition-transform duration-300 ease-gentle group-hover:translate-x-0.5" />
                </SectionLink>
              </article>
            </Reveal>
          );
        })}

        <Reveal delay={300}>
          <article className="flex h-full flex-col justify-between rounded-3xl border border-dashed border-forest-300 bg-forest-50/50 p-6">
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-forest-600">
                <IconLeaf className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg">Your own habit</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">
                Something else good for the planet? Pick the closest category and describe it in a
                note.
              </p>
            </div>
            <SectionLink
              to="#start"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-600"
            >
              Add an action
              <IconArrowRight className="h-4 w-4" />
            </SectionLink>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Start — auth gate / dashboard, or an honest fallback
 * ------------------------------------------------------------------ */

function StartSection({ backend }: { backend: BackendInfo }) {
  return (
    <section id="start" aria-labelledby="start-heading">
      <Reveal>
        <SectionHeading
          align="center"
          eyebrow="Take action"
          title={<span id="start-heading">Start your log.</span>}
          lead={
            backend.ready
              ? 'Sign in to record actions, earn points, and see where you stand on the community leaderboard.'
              : 'This demo build is running without the AWS backend, so sign-in and live logging are switched off.'
          }
        />
      </Reveal>

      <div className="mt-10">
        {backend.ready ? (
          <AuthProvider>
            <AwsSection apiBase={backend.apiBase} />
          </AuthProvider>
        ) : (
          <Reveal>
            <div className="card mx-auto max-w-xl p-7 text-center sm:p-9">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cream text-moss">
                <IconInfo className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl">Live logging is not connected here</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">
                SustainTheGlobe stores actions, points and private photo evidence through its AWS
                API. In this build {backend.mode === 'firebase' ? 'the app is in demo mode' : 'the API URL is not configured'}
                , so the sign-in and logging screens stay hidden rather than showing fake data.
              </p>
              <Link to="/about" className="btn btn-secondary mt-6">
                Read about the project
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Closing CTA
 * ------------------------------------------------------------------ */

function ClosingCta() {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-4xl bg-forest-800 px-8 py-14 text-ivory sm:px-14 sm:py-16">
        <TopoPattern className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 text-ivory/10" />
        <div className="relative max-w-2xl">
          <p className="eyebrow text-sage">Every action counts</p>
          <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.6rem)] font-semibold leading-tight text-ivory">
            A healthier planet starts with what we do next.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ivory/75">
            Small, consistent choices are how change actually happens. Start with one — then let the
            totals do the talking.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SectionLink to="#start" className="btn btn-onDark">
              Start logging actions
              <IconArrowRight className="h-4 w-4" />
            </SectionLink>
            <Link to="/about" className="btn btn-onDark-ghost">
              Read our mission
            </Link>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

export function Home({ backend }: { backend: BackendInfo }) {
  return (
    <div className="space-y-20 sm:space-y-28">
      <Hero backend={backend} />
      <Mission />
      <HowItWorks />
      <WaysToHelp />
      <StartSection backend={backend} />
      <ClosingCta />
    </div>
  );
}

export function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <Reveal>
        <header className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-forest-600 text-ivory shadow-soft">
            <IconLeaf className="h-7 w-7" />
          </span>
          <h1 className="mt-6 text-[clamp(1.9rem,4vw,2.8rem)] font-semibold leading-tight">
            About SustainTheGlobe
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-moss sm:text-lg">
            A small, honest tool for recording everyday environmental action — and for making quiet
            effort feel worth something.
          </p>
        </header>
      </Reveal>

      <Reveal delay={60}>
        <section className="card card-pad">
          <h2 className="text-xl">What it does</h2>
          <p className="mt-3 text-sm leading-relaxed text-moss">
            SustainTheGlobe lets you record everyday environmental actions and earn points for
            them. Points are computed on the server from a fixed rule table — recycle 10, transit
            15, energy 20, cleanup 25, plant 30 — and every action is tied to your signed-in
            identity. Photos are stored privately as evidence and are never used for automatic
            verification.
          </p>

          <dl className="mt-7 grid gap-5 sm:grid-cols-3">
            {ACTION_ORDER.map((key) => {
              const meta = ACTION_META[key];
              const Icon = meta.Icon;
              return (
                <div key={key} className="rounded-2xl border border-sand/80 bg-cream/50 p-4">
                  <dt className="flex items-center gap-2 text-sm font-semibold text-forest-800">
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </dt>
                  <dd className="tnum mt-1 text-sm text-moss">+{meta.points} pts</dd>
                </div>
              );
            })}
          </dl>
        </section>
      </Reveal>

      <Reveal delay={120}>
        <section className="card card-pad">
          <h2 className="text-xl">How to read this build</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-moss">
            <li className="flex gap-3">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
              SustainTheGlobe runs against an AWS SAM API with Amazon Cognito sign-in. When the API
              URL and public Cognito IDs are configured, the sign-in and logging screens appear.
            </li>
            <li className="flex gap-3">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
              Without that configuration, this interface stays honest: it explains what is
              available instead of showing invented actions or stand-in numbers.
            </li>
            <li className="flex gap-3">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
              Nothing here is a claim about real environmental outcomes — points measure actions
              you submit, not measured impact.
            </li>
          </ul>
          <Link to="/" className="btn btn-primary mt-7">
            Back to home
          </Link>
        </section>
      </Reveal>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="eyebrow">Page not found</p>
      <h1 className="mt-3 text-3xl">This path leads nowhere.</h1>
      <p className="mt-3 text-sm leading-relaxed text-moss">
        The page you were looking for does not exist. Head back and pick up where you left off.
      </p>
      <Link to="/" className="btn btn-primary mt-7">
        Back to home
      </Link>
    </div>
  );
}
````

## `src/ui.tsx`

````tsx
import React, { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ *
 * Motion helper
 * ------------------------------------------------------------------ */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------------------ *
 * Icons — dependency-free inline SVGs with a consistent 1.7 stroke.
 * ------------------------------------------------------------------ */

export type IconProps = { className?: string };

function base(className: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function IconLeaf({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

export function IconRecycle({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
      <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
      <path d="m14 16-3 3 3 3" />
      <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
      <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
      <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
    </svg>
  );
}

export function IconTransit({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 17.5V14l-3-3 4-3 2 3h2" />
    </svg>
  );
}

export function IconEnergy({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function IconCleanup({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4M22 5h-4" />
    </svg>
  );
}

export function IconPlant({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}

export function IconTrophy({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function IconSignOut({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconImage({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export function IconAlert({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

export function IconCalendar({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 2v4M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export function IconArrowRight({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconMenu({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconCheck({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconShield({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconGlobe({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

export function IconLock({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconMail({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function IconTrend({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M17 8h4v4" />
    </svg>
  );
}

export function IconInfo({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function IconSpark({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Brand mark
 * ------------------------------------------------------------------ */

export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-2xl bg-forest-600 text-ivory shadow-soft ${className}`}
    >
      <IconLeaf className="h-[55%] w-[55%]" />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Decorative patterns & illustration
 * ------------------------------------------------------------------ */

export function TopoPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1">
        <path d="M200 52c64 0 116 52 116 116s-52 116-116 116S84 232 84 168 136 52 200 52Z" />
        <path d="M200 86c46 0 82 37 82 82s-36 82-82 82-82-37-82-82 36-82 82-82Z" />
        <path d="M200 122c26 0 46 21 46 46s-20 46-46 46-46-21-46-46 20-46 46-46Z" />
        <path d="M200 158c6 0 10 5 10 10s-4 10-10 10-10-5-10-10 4-10 10-10Z" />
      </g>
    </svg>
  );
}

/**
 * Self-contained editorial landscape. Rendered when no photo is supplied so the
 * hero never depends on an external image service or a repo asset that may be missing.
 */
export function HeroScene({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 720 560"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Illustrated landscape of layered green hills beneath a soft sun"
    >
      <defs>
        <linearGradient id="eco-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8efe8" />
          <stop offset="55%" stopColor="#f1f5f2" />
          <stop offset="100%" stopColor="#f5f3ea" />
        </linearGradient>
        <radialGradient id="eco-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbeee0" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fbeee0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="eco-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c5d7cc" />
          <stop offset="100%" stopColor="#a0baa8" />
        </linearGradient>
      </defs>

      <rect width="720" height="560" fill="url(#eco-sky)" />

      {/* Sun */}
      <circle cx="512" cy="150" r="150" fill="url(#eco-sun)" />
      <circle cx="512" cy="150" r="56" fill="#f0ddc2" />
      <circle cx="512" cy="150" r="56" fill="none" stroke="#fff" strokeOpacity="0.5" />

      {/* Birds */}
      <g stroke="#68746a" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M300 128c5-6 10-6 15 0 5-6 10-6 15 0" />
        <path d="M352 106c4-5 8-5 12 0 4-5 8-5 12 0" />
        <path d="M272 168c4-5 8-5 12 0 4-5 8-5 12 0" />
      </g>

      {/* Far ridge */}
      <path
        d="M0 318c110-26 210-12 320-32s220 14 310-4c45-9 70-6 90-12v290H0Z"
        fill="#c5d7cc"
      />
      {/* Mid ridge */}
      <path
        d="M0 372c120-28 230-6 350-28s210 12 310-6c30-6 48-2 60-6v228H0Z"
        fill="#a0baa8"
      />
      {/* Tree line on the mid ridge */}
      <g fill="#4e6e5a" opacity="0.85">
        <Tree x={96} y={352} />
        <Tree x={132} y={360} />
        <Tree x={168} y={350} />
        <Tree x={574} y={336} />
        <Tree x={606} y={344} />
        <Tree x={642} y={334} />
      </g>
      {/* Near ridge */}
      <path
        d="M0 430c150-26 300 8 450-16 110-17 200 10 270-6v152H0Z"
        fill="#4e6e5a"
      />
      {/* Foreground ridge */}
      <path
        d="M0 496c180-22 360 10 540-12 70-8 140 2 180-4v80H0Z"
        fill="#244337"
      />
      {/* Pond */}
      <ellipse cx="470" cy="516" rx="128" ry="24" fill="url(#eco-water)" opacity="0.55" />
      {/* Contour detail on the dark foreground */}
      <g stroke="#f5f3ea" strokeOpacity="0.12" strokeWidth="1.4" fill="none">
        <path d="M-20 520c160-18 340 12 520-10 90-11 160 0 240-6" />
        <path d="M-20 538c170-16 350 10 540-10 70-8 130 0 210-6" />
      </g>
    </svg>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 -6l-13 30h26Z" />
      <path d="M0 -20l-8 22h16Z" />
      <rect x="-2.4" y="24" width="4.8" height="8" rx="1.6" />
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  className = '',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={`${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}
    >
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="mt-3 text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.15]">{title}</h2>
      {lead ? <p className="mt-4 text-base leading-relaxed text-moss sm:text-lg">{lead}</p> : null}
    </div>
  );
}

export type StatusTone = 'ok' | 'warn' | 'error' | 'muted';

const STATUS_DOT: Record<StatusTone, string> = {
  ok: 'bg-forest-500',
  warn: 'bg-clay-500',
  error: 'bg-[#b4463f]',
  muted: 'bg-moss/50',
};

export function StatusPill({
  tone,
  children,
  className = '',
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`chip ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Photography-ready media frame. When `src` is supplied it renders a lazy,
 * object-cover image and gracefully falls back to `children` (vector art) if the
 * image is missing or fails to load — so the layout never breaks.
 */
export function MediaPanel({
  src,
  alt = '',
  ratio = 'aspect-[4/5]',
  className = '',
  children,
}: {
  src?: string;
  alt?: string;
  ratio?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div
      className={`relative overflow-hidden rounded-4xl border border-sand/80 bg-mist/40 ${ratio} ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        children
      )}
    </div>
  );
}
````

## `src/dashboard.tsx`

````tsx
import React, { useEffect, useState } from 'react';
import {
  deleteUpload,
  getLeaderboard,
  getMe,
  getPoints,
  isSessionExpired,
  listActions,
  newClientActionId,
  putPhotoBytes,
  requestUploadUrl,
  submitAction,
  validatePhotoFile,
} from './api';
import type { ActionItem, LeaderEntry } from './api';
import { isValidAddress, isValidEmail, useAuth } from './auth';
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconImage,
  IconLeaf,
  IconLock,
  IconPlant,
  IconRecycle,
  IconSignOut,
  IconTransit,
  IconTrophy,
  IconEnergy,
  IconCleanup,
} from './ui';
import type { IconProps } from './ui';

/* ------------------------------------------------------------------ *
 * Action taxonomy — the single source of truth for labels and the
 * server-side point values (points are always computed by the backend).
 * ------------------------------------------------------------------ */

export const ACTION_META: Record<
  string,
  { label: string; points: number; blurb: string; Icon: React.ComponentType<IconProps> }
> = {
  recycle: {
    label: 'Recycle',
    points: 10,
    blurb: 'Sort and recycle what you can instead of binning it.',
    Icon: IconRecycle,
  },
  transit: {
    label: 'Transit',
    points: 15,
    blurb: 'Walk, cycle, or take public transport instead of driving.',
    Icon: IconTransit,
  },
  energy: {
    label: 'Energy',
    points: 20,
    blurb: 'Trim household energy use — lights, heating, standby loads.',
    Icon: IconEnergy,
  },
  cleanup: {
    label: 'Cleanup',
    points: 25,
    blurb: 'Collect litter from a local park, beach, or street.',
    Icon: IconCleanup,
  },
  plant: {
    label: 'Plant',
    points: 30,
    blurb: 'Plant a tree, shrub, or pollinator-friendly plant.',
    Icon: IconPlant,
  },
};

export const ACTION_ORDER = ['recycle', 'transit', 'energy', 'cleanup', 'plant'] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusTone(status: string): 'success' | 'error' | 'info' {
  if (/^Recorded!/i.test(status)) return 'success';
  if (/rejected|failed|invalid|must|duplicate|not signed|could not|error|expired/i.test(status))
    return 'error';
  return 'info';
}

const STATUS_CLASS: Record<'success' | 'error' | 'info', string> = {
  success: 'alert-success',
  error: 'alert-error',
  info: 'alert-info',
};

/* ------------------------------------------------------------------ *
 * Auth screen — sign in / sign up / email confirmation
 * ------------------------------------------------------------------ */

export function AuthScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [mail, setMail] = useState('');
  const [address, setAddress] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  async function run(fn: () => Promise<void>, done?: string) {
    setBusy(true);
    setInfo('');
    try {
      await fn();
      if (done) setInfo(done);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'unconfirmed' && msg !== 'UNCONFIRMED') setInfo(msg);
    } finally {
      setBusy(false);
    }
  }

  if (auth.status === 'unconfirmed') {
    return (
      <div className="mx-auto w-full max-w-md">
        <section className="card card-pad">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-600">
            <IconLeaf className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-2xl">Confirm your email</h3>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            We sent a code to {auth.pendingEmail}. Enter it below.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => auth.confirm(code));
            }}
          >
            <div>
              <label className="label" htmlFor="confirm-code">
                Confirmation code
              </label>
              <input
                id="confirm-code"
                className="input tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
                {busy ? 'Working…' : 'Confirm'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => run(() => auth.resend())}
              >
                Resend code
              </button>
            </div>
          </form>
          {info !== '' || auth.error !== '' ? (
            <p className="alert alert-error mt-4" role="alert">
              <IconAlert className="mr-1 inline h-4 w-4 align-[-2px]" />
              {info !== '' ? info : auth.error}
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <section className="card card-pad">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-600">
            <IconLeaf className="h-6 w-6" />
          </span>
          <h3 className="mt-5 text-2xl">
            {tab === 'in' ? 'Welcome back' : 'Create your account'}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            {tab === 'in'
              ? 'Sign in to log actions and earn points.'
              : 'Join in and start earning points for green actions.'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Sign in or create an account"
          className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-cream p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'in'}
            onClick={() => {
              setTab('in');
              auth.clearError();
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'in' ? 'bg-white text-forest-800 shadow-soft' : 'text-moss hover:text-forest-800'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'up'}
            onClick={() => {
              setTab('up');
              auth.clearError();
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'up' ? 'bg-white text-forest-800 shadow-soft' : 'text-moss hover:text-forest-800'
            }`}
          >
            Sign up
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidEmail(mail)) {
              setInfo('Enter a valid email address.');
              return;
            }
            if (tab === 'in') run(() => auth.signIn(mail, pw));
            else if (!isValidAddress(address)) {
              setInfo('Enter your address.');
            } else run(() => auth.signUp(mail, pw, address));
          }}
        >
          <div>
            <label className="label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
            />
          </div>
          {tab === 'up' ? (
            <div>
              <label className="label" htmlFor="auth-address">
                Address
              </label>
              <input
                id="auth-address"
                className="input"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div>
            <label className="label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="input"
              type="password"
              autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            {tab === 'up' ? (
              <p className="hint mt-1.5">At least 8 characters, with upper and lowercase letters and a number.</p>
            ) : null}
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Working…' : tab === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {info !== '' || auth.error !== '' ? (
          <p className="alert alert-error mt-4" role="alert">
            <IconAlert className="mr-1 inline h-4 w-4 align-[-2px]" />
            {info !== '' ? info : auth.error}
          </p>
        ) : null}

        <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-moss">
          <IconLock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Sign-in is handled by Amazon Cognito. Your session token is only ever sent to the
          SustainTheGlobe API.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Dashboard pieces
 * ------------------------------------------------------------------ */

function AccountBar({
  apiBase,
  token,
  fallback,
}: {
  apiBase: string;
  token: string;
  fallback: string;
}) {
  const auth = useAuth();
  const [email, setEmail] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    getMe(apiBase, token)
      .then((me) => {
        if (!cancelled && me.email) setEmail(me.email);
      })
      .catch(() => {
        // Best-effort — fall back to the Cognito-known email.
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, token]);

  const initial = (email || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-forest-100 font-serif text-lg font-semibold text-forest-700">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="eyebrow">Signed in as</p>
          <p className="truncate font-medium text-ink">{email}</p>
        </div>
      </div>
      <button type="button" className="btn btn-secondary self-start sm:self-auto" onClick={auth.signOut}>
        <IconSignOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

function TotalPointsCard({ total, actionCount }: { total: number | null; actionCount: number }) {
  return (
    <section className="card card-pad">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Your total points</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-600">
          <IconTrophy className="h-4 w-4" />
        </span>
      </div>
      <p
        key={total}
        className="tnum mt-3 animate-points-pop font-serif text-5xl font-semibold leading-none text-forest-800"
      >
        {total === null ? '—' : total}
      </p>
      <p className="mt-2 text-sm text-moss">
        {actionCount} {actionCount === 1 ? 'action recorded' : 'actions recorded'}
      </p>
    </section>
  );
}

export function Leaderboard({
  apiBase,
  token,
  onSessionExpired,
}: {
  apiBase: string;
  token: string;
  onSessionExpired: () => void;
}) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [note, setNote] = useState('Loading leaderboard…');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeaderboard(apiBase, token, 10)
      .then((b) => {
        if (cancelled) return;
        setLeaders(b.leaders);
        setNote(
          b.leaders.length === 0
            ? 'No actions yet — be the first on the board!'
            : `${b.participantCount} participant(s) this season.`,
        );
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isSessionExpired(err)) {
          onSessionExpired();
          return;
        }
        setNote('Leaderboard unavailable right now.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  return (
    <section className="card card-pad">
      <header className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-100 text-clay-600">
          <IconTrophy className="h-4 w-4" />
        </span>
        <h3 className="text-xl">Leaderboard</h3>
      </header>

      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-[58px] animate-pulse items-center gap-3 rounded-2xl border border-sand/60 bg-cream/70 px-3"
            >
              <span className="h-8 w-8 shrink-0 rounded-full bg-sand" />
              <div className="flex-1">
                <div className="h-3 w-2/3 rounded bg-sand" />
                <div className="mt-1.5 h-2 w-1/3 rounded bg-sand/70" />
              </div>
              <div className="h-5 w-14 rounded-full bg-sand" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-moss">{note}</p>
          {leaders.length > 0 ? (
            <ol className="mt-4 space-y-2">
              {leaders.map((l, i) => (
                <li
                  key={l.displayId}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                    i === 0 ? 'border-clay-200 bg-clay-100/60' : 'border-sand/60 bg-cream/50'
                  }`}
                >
                  <span
                    className={`tnum grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      i === 0
                        ? 'bg-clay-600 text-white'
                        : i === 1
                          ? 'bg-sage text-forest-900'
                          : i === 2
                            ? 'bg-clay-200 text-clay-700'
                            : 'bg-mist text-moss'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">
                    {l.displayId}
                  </span>
                  <span className="text-right">
                    <span className="badge tnum">{l.totalPoints} pts</span>
                    <span className="mt-0.5 block text-xs text-moss">
                      {l.actionCount} actions
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}

export function ActionsPanel({
  apiBase,
  token,
  onSessionExpired,
  onPoints,
}: {
  apiBase: string;
  token: string;
  onSessionExpired: () => void;
  onPoints?: (total: number, count: number) => void;
}) {
  const [actionType, setActionType] = useState('recycle');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState('Record an environmental action below.');
  const [busy, setBusy] = useState(false);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);

  function expired(err: unknown): boolean {
    if (isSessionExpired(err)) {
      onSessionExpired();
      return true;
    }
    return false;
  }

  async function refresh() {
    try {
      const [list, pts] = await Promise.all([listActions(apiBase, token), getPoints(apiBase, token)]);
      setActions(list.actions);
      setTotalPoints(pts.totalPoints);
      onPoints?.(pts.totalPoints, list.actions.length);
    } catch (err) {
      if (!expired(err)) {
        // Best-effort refresh; submit reports its own errors.
      }
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setPhoto(null);
      return;
    }
    const err = validatePhotoFile(f);
    if (err) {
      setStatus(err);
      e.target.value = '';
      setPhoto(null);
      return;
    }
    setPhoto(f);
    setStatus('Photo selected — not uploaded yet.');
  }

  function focusActionForm() {
    const el = document.getElementById('action-type');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // One idempotency key for the whole attempt: safe to retry after any failure.
    const clientActionId = newClientActionId();
    let uploadedKey: string | undefined;
    try {
      let photoKey: string | undefined;
      let photoName: string | undefined;
      let photoSize: number | undefined;
      let photoType: string | undefined;
      if (photo) {
        setStatus('Requesting photo upload…');
        const ticket = await requestUploadUrl(
          apiBase,
          { clientActionId, photoType: photo.type, photoSize: photo.size },
          token,
        );
        setStatus('Uploading photo…');
        await putPhotoBytes(ticket.uploadUrl, photo, photo.type);
        uploadedKey = ticket.photoKey;
        photoKey = ticket.photoKey;
        photoName = photo.name;
        photoSize = photo.size;
        photoType = photo.type;
      }
      setStatus('Saving action…');
      // userId is a display value only — the backend derives ownership from the
      // verified access token and ignores it.
      const r = await submitAction(
        apiBase,
        {
          userId: 'token-owner',
          clientActionId,
          actionType: actionType as 'recycle',
          note: note === '' ? undefined : note,
          photoName,
          photoSize,
          photoType,
          photoKey,
        },
        token,
      );
      uploadedKey = undefined; // recorded — no longer an orphan.
      setStatus(`Recorded! +${r.pointsAwarded} pts for this submitted action.`);
      setNote('');
      setPhoto(null);
      await refresh();
    } catch (err) {
      if (uploadedKey) {
        // The bytes landed but the record did not: remove our own orphan.
        // Best-effort — the submit error below is what the user must see.
        await deleteUpload(apiBase, uploadedKey, token);
      }
      if (!expired(err)) setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card card-pad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl">Log an action</h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-moss">
              Every entry earns server-verified points. Photos are stored privately as evidence —
              they are not used for automatic verification.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-6" onSubmit={onSubmit}>
          <fieldset>
            <legend className="label">Choose an action</legend>
            <div
              id="action-type"
              role="radiogroup"
              aria-label="Action type"
              tabIndex={-1}
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
            >
              {ACTION_ORDER.map((key) => {
                const meta = ACTION_META[key];
                const TypeIcon = meta.Icon;
                const active = actionType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setActionType(key)}
                    className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-200 ease-gentle ${
                      active
                        ? 'border-forest-500 bg-forest-50 shadow-soft'
                        : 'border-sand bg-white hover:border-forest-300 hover:bg-cream/60'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-xl ${
                          active ? 'bg-forest-600 text-ivory' : 'bg-forest-50 text-forest-600'
                        }`}
                      >
                        <TypeIcon className="h-4 w-4" />
                      </span>
                      <span
                        className={`tnum text-xs font-bold ${
                          active ? 'text-forest-700' : 'text-moss'
                        }`}
                      >
                        +{meta.points}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-ink">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label className="label" htmlFor="action-note">
              Note <span className="font-normal text-moss">(optional)</span>
            </label>
            <input
              id="action-note"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Where, what, roughly how much…"
            />
          </div>

          <div>
            <span className="label">Photo (optional)</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-forest-300 bg-forest-50/40 px-4 py-3.5 text-sm text-moss transition-colors hover:border-forest-400 hover:bg-forest-50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-forest-600">
                <IconImage className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-forest-800">
                {photo ? photo.name : 'Choose a photo…'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={onFile}
              />
            </label>
            <p className="hint mt-2">JPEG, PNG or WebP — up to 5&nbsp;MB. Stored privately.</p>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Working…' : 'Submit action'}
          </button>
        </form>

        <p
          role="status"
          aria-live="polite"
          className={`alert mt-4 flex items-start gap-2 ${STATUS_CLASS[statusTone(status)]}`}
        >
          {statusTone(status) === 'success' ? (
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : statusTone(status) === 'error' ? (
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : null}
          <span>{status}</span>
        </p>
      </section>

      <section className="card card-pad">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xl">Your activity</h3>
          <span className="text-xs font-medium text-moss">
            {actions.length} {actions.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {actions.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-sand bg-cream/50 px-5 py-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-forest-50 text-forest-600">
              <IconLeaf className="h-6 w-6" />
            </span>
            <p className="mt-4 font-semibold text-ink">No actions yet.</p>
            <p className="mt-1 text-sm text-moss">Log your first action to start earning points.</p>
            <button type="button" className="btn btn-primary mt-5" onClick={focusActionForm}>
              Log your first action
            </button>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-sand/70">
            {actions.map((a) => {
              const meta = ACTION_META[a.actionType];
              const TypeIcon = meta?.Icon ?? IconLeaf;
              return (
                <li key={a.actionId} className="flex gap-3 py-4">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
                    <TypeIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize text-ink">{a.actionType}</span>
                      <span className="badge tnum">+{a.points} pts</span>
                    </div>
                    {a.note ? <p className="mt-0.5 text-sm text-moss">{a.note}</p> : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-moss">
                      {formatDate(a.createdAt) ? (
                        <span className="inline-flex items-center gap-1">
                          <IconCalendar className="h-3.5 w-3.5" />
                          {formatDate(a.createdAt)}
                        </span>
                      ) : null}
                      {a.photoName ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <IconImage className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{a.photoName}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Authenticated gate — renders auth screen or the full dashboard
 * ------------------------------------------------------------------ */

export function AwsSection({ apiBase }: { apiBase: string }) {
  const auth = useAuth();
  const [points, setPoints] = useState<{ total: number | null; count: number }>({
    total: null,
    count: 0,
  });

  if (auth.status === 'loading') {
    return (
      <div className="card card-pad">
        <div className="flex items-center gap-3 text-sm text-moss">
          <span className="h-2 w-2 animate-pulse rounded-full bg-forest-400" />
          Checking session…
        </div>
      </div>
    );
  }

  if (auth.status !== 'authed') return <AuthScreen />;

  return (
    <div className="space-y-6">
      <AccountBar apiBase={apiBase} token={auth.accessToken} fallback={auth.email} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ActionsPanel
            apiBase={apiBase}
            token={auth.accessToken}
            onSessionExpired={auth.sessionExpired}
            onPoints={(total, count) => setPoints({ total, count })}
          />
        </div>
        <div className="space-y-6 lg:col-span-1">
          <TotalPointsCard total={points.total} actionCount={points.count} />
          <Leaderboard
            apiBase={apiBase}
            token={auth.accessToken}
            onSessionExpired={auth.sessionExpired}
          />
        </div>
      </div>
    </div>
  );
}
````

## `src/api.ts`

````ts
export interface HealthResponse {
  status: string;
  service: string;
}

export function getApiBaseUrl(env: Record<string, string | undefined>): string {
  const raw = env.VITE_API_URL ?? '';
  return raw.trim().replace(/\/+$/, '');
}

/** Use the local SAM API when development config is missing or points back at Vite. */
export function getDevelopmentApiBaseUrl(
  configuredBaseUrl: string,
  pageOrigin: string,
): string {
  const base = configuredBaseUrl.trim().replace(/\/+$/, '');
  if (base === '') return '/api';
  try {
    if (new URL(base, pageOrigin).origin === pageOrigin) return '/api';
  } catch {
    return '/api';
  }
  return base;
}

export function buildHealthUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/health`;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function postJson<T>(
  url: string,
  payload: unknown,
  fetcher: FetchFn,
  headers?: Record<string, string>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Request failed: ${msg}`);
  }
  if (res.status === 400) throw new Error('Invalid action (check inputs).');
  if (res.status === 409)
    throw new Error('Duplicate action (already recorded — no extra points).');
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Server returned invalid JSON.');
  }
}

async function getJson<T>(url: string, fetcher: FetchFn, headers?: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, headers ? { headers } : undefined);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Request failed: ${msg}`);
  }
  if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('Server returned invalid JSON.');
  }
}

export type ActionType = 'recycle' | 'cleanup' | 'plant' | 'transit' | 'energy';

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export function validatePhotoFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type))
    return 'Photo must be JPEG, PNG, or WebP.';
  if (file.size <= 0) return 'Photo file is empty.';
  if (file.size > MAX_PHOTO_SIZE_BYTES) return 'Photo must be at most 5 MB.';
  return null;
}

export interface UploadTicket {
  uploadUrl: string;
  photoKey: string;
  expiresIn: number;
}

export async function requestUploadUrl(
  baseUrl: string,
  input: { clientActionId: string; photoType: string; photoSize: number },
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<UploadTicket> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  let res: Response;
  try {
    res = await fetcher(`${base}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(input),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Upload request failed: ${msg}`);
  }
  if (res.status === 400) throw new Error('Photo rejected by server (type/size).');
  if (!res.ok) throw new Error(`Upload request failed: HTTP ${res.status}`);
  try {
    const body = (await res.json()) as UploadTicket;
    if (typeof body.uploadUrl !== 'string' || typeof body.photoKey !== 'string')
      throw new Error('bad shape');
    return body;
  } catch (err) {
    if (err instanceof Error && err.message === 'bad shape')
      throw new Error('Upload service returned unexpected response.');
    throw new Error('Upload service returned invalid JSON.');
  }
}

/** PUT raw bytes straight to private S3 via the presigned URL (no creds involved). */
export async function putPhotoBytes(
  uploadUrl: string,
  file: Blob,
  photoType: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<void> {
  let res: Response;
  try {
    res = await fetcher(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': photoType },
      body: file,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Photo upload failed: ${msg}`);
  }
  if (!res.ok) throw new Error(`Photo upload failed: HTTP ${res.status}`);
}

export const ACTION_TYPES: ActionType[] = [
  'recycle',
  'cleanup',
  'plant',
  'transit',
  'energy',
];

export interface SubmitActionInput {
  userId: string;
  clientActionId: string;
  actionType: ActionType;
  note?: string;
  photoName?: string;
  photoSize?: number;
  photoType?: string;
  /** S3 key returned by requestUploadUrl — submit only after PUT succeeds. */
  photoKey?: string;
}

export interface SubmitActionResult {
  actionId: string;
  pointsAwarded: number;
  createdAt: string;
}

export interface ActionItem {
  actionId: string;
  actionType: string;
  points: number;
  note?: string;
  photoName?: string;
  createdAt: string;
}

export interface PointsSummary {
  userId: string;
  totalPoints: number;
  actionCount: number;
}

/** Authorization header for protected API calls. Never logs the token itself. */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** True when an API error means the session expired/invalid → re-authenticate. */
export function isSessionExpired(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b401\b/.test(msg);
}

function requireToken(token: string): void {
  if (token.trim() === '') throw new Error('Not signed in.');
}

export function newClientActionId(): string {
  const c = globalThis.crypto as undefined | { randomUUID?: () => string };
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitAction(
  baseUrl: string,
  input: SubmitActionInput,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<SubmitActionResult> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return postJson<SubmitActionResult>(`${base}/actions`, input, fetcher, authHeaders(token));
}

export async function listActions(
  baseUrl: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<{ actions: ActionItem[]; count: number }> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/actions`, fetcher, authHeaders(token));
}

export async function getPoints(
  baseUrl: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<PointsSummary> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/points`, fetcher, authHeaders(token));
}

export interface UserProfile {
  userId: string;
  email: string | null;
  address: string | null;
}

export interface LeaderEntry {
  displayId: string;
  totalPoints: number;
  actionCount: number;
}

export async function getMe(
  baseUrl: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<UserProfile> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/me`, fetcher, authHeaders(token));
}

export async function getLeaderboard(
  baseUrl: string,
  token: string,
  limit = 10,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<{ leaders: LeaderEntry[]; participantCount: number }> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  return getJson(`${base}/leaderboard?limit=${limit}`, fetcher, authHeaders(token));
}

/** Best-effort orphan cleanup: delete our own uploaded object after a failed submit. */
export async function deleteUpload(
  baseUrl: string,
  photoKey: string,
  token: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<void> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') throw new Error('API URL is not configured (VITE_API_URL).');
  requireToken(token);
  let res: Response;
  try {
    res = await fetcher(
      `${base}/uploads?photoKey=${encodeURIComponent(photoKey)}`,
      { method: 'DELETE', headers: authHeaders(token) },
    );
  } catch {
    return; // cleanup is best-effort; the submit error is what matters.
  }
  if (!res.ok && res.status !== 404) {
    return;
  }
}

export async function fetchHealth(
  baseUrl: string,
  fetcher: FetchFn = globalThis.fetch.bind(globalThis),
): Promise<HealthResponse> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') {
    throw new Error('API URL is not configured (VITE_API_URL).');
  }
  let res: Response;
  try {
    res = await fetcher(buildHealthUrl(base));
  } catch {
    throw new Error(
      base.startsWith('/api')
        ? 'Could not reach the local API. Start the SAM backend on port 3000.'
        : 'Could not reach the API. Check the API URL and confirm the server is running.',
    );
  }
  const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  let raw: string;
  try {
    raw = await res.text();
  } catch {
    throw new Error(`Health check failed: HTTP ${res.status}; response could not be read.`);
  }
  const looksLikeHtml =
    contentType === 'text/html' || /^\s*(?:<!doctype\s+html|<html\b)/i.test(raw);
  if (!res.ok) {
    if (base.startsWith('/api') && /\bECONNREFUSED\b/i.test(raw)) {
      throw new Error(
        `Health check failed: HTTP ${res.status}. The local API proxy cannot connect to SAM at 127.0.0.1:3000 (connection refused). Start the backend.`,
      );
    }
    const diagnostic = !looksLikeHtml
      ? ''
      : base.startsWith('/api')
        ? ' The local API proxy returned HTML; confirm SAM is running on port 3000.'
        : ' The server returned an HTML page; check that the API URL points to the backend.';
    throw new Error(`Health check failed: HTTP ${res.status}.${diagnostic}`);
  }
  if (looksLikeHtml) {
    const diagnostic = base.startsWith('/api')
      ? ' The local API proxy returned HTML; confirm SAM is running on port 3000.'
      : ' The URL is serving a web page instead of the backend API.';
    throw new Error(`Health check failed: HTTP ${res.status} returned HTML.${diagnostic}`);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    const type = contentType ?? 'unknown content type';
    throw new Error(
      `Health check failed: HTTP ${res.status} returned non-JSON (${type}). Check that the URL points to the backend API.`,
    );
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    (body as { status?: unknown }).status !== 'ok'
  ) {
    throw new Error('Health check returned unexpected response.');
  }
  return body as HealthResponse;
}
````

## `src/auth.tsx`

````tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
}

const COGNITO_SETUP_MESSAGE =
  'Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID to real public IDs from your deployed SAM stack. Local SAM does not provide Cognito authentication.';

/** Public identifiers only — never secrets. Null when not configured. */
export function getCognitoConfig(
  env: Record<string, string | undefined>,
): CognitoConfig | null {
  const userPoolId = (env.VITE_COGNITO_USER_POOL_ID ?? '').trim();
  const clientId = (env.VITE_COGNITO_CLIENT_ID ?? '').trim();
  if (userPoolId === '' || userPoolId.startsWith('PASTE_')) return null;
  if (clientId === '' || clientId.startsWith('PASTE_')) return null;
  return { userPoolId, clientId };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidAddress(address: string): boolean {
  return address.trim() !== '';
}

export function buildSignUpAttributes(email: string, address: string): CognitoUserAttribute[] {
  return [
    new CognitoUserAttribute({ Name: 'email', Value: email.trim() }),
    new CognitoUserAttribute({ Name: 'address', Value: address.trim() }),
  ];
}

/**
 * Maps Cognito errors to UI-safe messages. Returns the sentinel
 * 'UNCONFIRMED' when the account exists but email is not verified, so the
 * caller can switch to the confirmation screen. Never includes tokens.
 */
export function mapAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const fallback =
    err instanceof Error && err.message !== '' ? err.message : 'Something went wrong.';
  switch (code) {
    case 'UserNotFoundException':
    case 'NotAuthorizedException':
      return 'Incorrect email or password.';
    case 'UserNotConfirmedException':
      return 'UNCONFIRMED';
    case 'UsernameExistsException':
      return 'An account with this email already exists. Try signing in.';
    case 'CodeMismatchException':
      return 'Wrong confirmation code. Check the email and try again.';
    case 'ExpiredCodeException':
      return 'That code expired. Resend a new one.';
    case 'LimitExceededException':
      return 'Too many attempts. Wait a bit and try again.';
    case 'InvalidPasswordException':
      return 'Password needs 8+ characters with upper/lowercase and a number.';
    case 'NetworkError':
      return 'Network error. Check your connection and try again.';
    default:
      return fallback;
  }
}

export interface AuthState {
  status: 'loading' | 'authed' | 'anon' | 'unconfirmed';
  email: string;
  accessToken: string;
  error: string;
  pendingEmail: string;
  signUp: (email: string, password: string, address: string) => Promise<void>;
  confirm: (code: string) => Promise<void>;
  resend: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  clearError: () => void;
  /** Called when an API returns 401 — clears the session, routes to sign-in. */
  sessionExpired: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider.');
  return v;
}

function toErrorMessage(err: unknown): string {
  return mapAuthError(err);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const env =
    typeof import.meta !== 'undefined'
      ? (import.meta as never as { env: Record<string, string | undefined> }).env
      : {};
  const config = useMemo(() => getCognitoConfig(env), [env.VITE_COGNITO_USER_POOL_ID, env.VITE_COGNITO_CLIENT_ID]);
  const pool = useMemo(
    () =>
      config
        ? new CognitoUserPool({ UserPoolId: config.userPoolId, ClientId: config.clientId })
        : null,
    [config?.userPoolId, config?.clientId],
  );

  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [email, setEmail] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState(config ? '' : COGNITO_SETUP_MESSAGE);
  const [pendingEmail, setPendingEmail] = useState('');

  const fail = (err: unknown, unconfirmedEmail?: string) => {
    const msg = toErrorMessage(err);
    if (msg === 'UNCONFIRMED') {
      setPendingEmail(unconfirmedEmail ?? '');
      setStatus('unconfirmed');
      setError('Please confirm your email to continue.');
    } else {
      setError(msg);
    }
  };

  const applySession = (userEmail: string, token: string) => {
    setEmail(userEmail);
    setAccessToken(token);
    setPendingEmail('');
    setError('');
    setStatus('authed');
  };

  // Restore session on load (refreshes tokens via the SDK when possible).
  useEffect(() => {
    if (!pool) {
      setStatus('anon');
      return;
    }
    const user = pool.getCurrentUser();
    if (!user) {
      setStatus('anon');
      return;
    }
    user.getSession((err: unknown, session: {
      isValid: () => boolean;
      getAccessToken: () => { getJwtToken: () => string };
    } | null) => {
      if (err || !session || !session.isValid()) {
        setStatus('anon');
        return;
      }
      const token = session.getAccessToken().getJwtToken();
      user.getUserAttributes((attrErr: unknown, attrs?: { getValue: () => string; Name: string }[]) => {
        const mail =
          !attrErr && attrs
            ? (attrs.find((a) => a.Name === 'email')?.getValue() ?? user.getUsername())
            : user.getUsername();
        applySession(mail, token);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const needPool = (): CognitoUserPool => {
    if (!pool) throw new Error(COGNITO_SETUP_MESSAGE);
    return pool;
  };

  const signUp: AuthState['signUp'] = async (mail, password, address) => {
    const p = needPool();
    if (!isValidEmail(mail)) throw new Error('Enter a valid email address.');
    if (!isValidAddress(address)) throw new Error('Enter your address.');
    if (password.length < 8) throw new Error('Password needs at least 8 characters.');
    await new Promise<void>((resolve, reject) => {
      p.signUp(
        mail.trim(),
        password,
        buildSignUpAttributes(mail, address),
        [],
        (err, result) => {
          if (err || !result) {
            reject(err ?? new Error('Sign-up failed.'));
            return;
          }
          setPendingEmail(mail.trim());
          if (result.userConfirmed) {
            setStatus('anon');
          } else {
            setStatus('unconfirmed');
          }
          resolve();
        },
      );
    }).catch((err) => {
      fail(err, mail.trim());
      throw new Error(mapAuthError(err) === 'UNCONFIRMED' ? 'unconfirmed' : toErrorMessage(err));
    });
  };

  const confirm: AuthState['confirm'] = async (code) => {
    const p = needPool();
    const user = new CognitoUser({ Username: pendingEmail, Pool: p });
    await new Promise<void>((resolve, reject) => {
      user.confirmRegistration(code.trim(), true, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    }).catch((err) => {
      const msg = toErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    });
    setStatus('anon');
    setError('Email confirmed — sign in to continue.');
  };

  const resend: AuthState['resend'] = async () => {
    const p = needPool();
    const user = new CognitoUser({ Username: pendingEmail, Pool: p });
    await new Promise<void>((resolve, reject) => {
      user.resendConfirmationCode((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    }).catch((err) => {
      const msg = toErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    });
    setError('A new code was sent to your email.');
  };

  const signIn: AuthState['signIn'] = async (mail, password) => {
    const p = needPool();
    const user = new CognitoUser({ Username: mail.trim(), Pool: p });
    const details = new AuthenticationDetails({ Username: mail.trim(), Password: password });
    await new Promise<void>((resolve, reject) => {
      user.authenticateUser(details, {
        onSuccess: (session) => {
          applySession(mail.trim(), session.getAccessToken().getJwtToken());
          resolve();
        },
        onFailure: (err) => reject(err),
      });
    }).catch((err) => {
      fail(err, mail.trim());
      throw new Error(toErrorMessage(err));
    });
  };

  const signOut = () => {
    pool?.getCurrentUser()?.signOut();
    setEmail('');
    setAccessToken('');
    setPendingEmail('');
    setError('');
    setStatus('anon');
  };

  const sessionExpired = () => {
    pool?.getCurrentUser()?.signOut();
    setAccessToken('');
    setEmail('');
    setStatus('anon');
    setError('Session expired — please sign in again.');
  };

  const value: AuthState = {
    status,
    email,
    accessToken,
    error,
    pendingEmail,
    signUp,
    confirm,
    resend,
    signIn,
    signOut,
    clearError: () => setError(''),
    sessionExpired,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
````

## `src/lib.ts`

````ts
export function backendModeFromEnv(env: Record<string, string | undefined>): string {
  const v = env.VITE_BACKEND;
  if (v === undefined || v === '' || v === 'firebase') return 'firebase';
  return v;
}
````

## `src/api.test.ts`

````ts
import { describe, it, expect, vi } from 'vitest';
import {
  getApiBaseUrl,
  getDevelopmentApiBaseUrl,
  buildHealthUrl,
  fetchHealth,
  submitAction,
  listActions,
  getPoints,
  requestUploadUrl,
  putPhotoBytes,
  validatePhotoFile,
  newClientActionId,
  authHeaders,
  isSessionExpired,
  getMe,
  getLeaderboard,
  deleteUpload,
} from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getApiBaseUrl', () => {
  it('returns empty string when unset', () => {
    expect(getApiBaseUrl({})).toBe('');
  });

  it('trims whitespace and trailing slashes', () => {
    expect(getApiBaseUrl({ VITE_API_URL: 'https://api.example.com/Prod/// ' })).toBe(
      'https://api.example.com/Prod',
    );
  });

  it('keeps localhost URLs intact', () => {
    expect(getApiBaseUrl({ VITE_API_URL: 'http://127.0.0.1:3000' })).toBe(
      'http://127.0.0.1:3000',
    );
  });
});

describe('getDevelopmentApiBaseUrl', () => {
  it('uses the SAM proxy when unset, invalid, or pointed at the Vite page', () => {
    expect(getDevelopmentApiBaseUrl('', 'http://localhost:5173')).toBe('/api');
    expect(getDevelopmentApiBaseUrl('PASTE_API_URL_HERE', 'http://localhost:5173')).toBe('/api');
    expect(getDevelopmentApiBaseUrl('http://localhost:5173', 'http://localhost:5173')).toBe('/api');
  });

  it('keeps a configured external API URL for development', () => {
    expect(getDevelopmentApiBaseUrl('https://api.example.com/Prod/', 'http://localhost:5173')).toBe(
      'https://api.example.com/Prod',
    );
  });
});

describe('buildHealthUrl', () => {
  it('appends /health without doubling slashes', () => {
    expect(buildHealthUrl('https://api.example.com/Prod/')).toBe(
      'https://api.example.com/Prod/health',
    );
  });
});

describe('fetchHealth', () => {
  it('returns parsed body on success', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ status: 'ok', service: 'sustain-the-globe-api' }),
    );
    const body = await fetchHealth('http://127.0.0.1:3000', fetcher);
    expect(body.status).toBe('ok');
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:3000/health');
  });

  it('throws when base URL is missing', async () => {
    const fetcher = vi.fn();
    await expect(fetchHealth('', fetcher)).rejects.toThrow('not configured');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('throws on non-200 status', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'boom' }, 500));
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('reports local SAM connection refusal as an unsuccessful health check', async () => {
    const fetcher = vi.fn(async () => new Response(
      'http proxy error: Error: connect ECONNREFUSED 127.0.0.1:3000',
      { status: 500, headers: { 'Content-Type': 'text/plain' } },
    ));
    await expect(fetchHealth('/api', fetcher)).rejects.toThrow(
      'HTTP 500. The local API proxy cannot connect to SAM at 127.0.0.1:3000',
    );
  });

  it('throws on invalid JSON', async () => {
    const fetcher = vi.fn(
      async () => new Response('not-json{{{', { status: 200 }),
    );
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'HTTP 200 returned non-JSON',
    );
  });

  it('diagnoses a Vite HTML fallback instead of calling it invalid JSON', async () => {
    const fetcher = vi.fn(async () => new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));
    await expect(fetchHealth('/api', fetcher)).rejects.toThrow(
      'HTTP 200 returned HTML. The local API proxy returned HTML',
    );
  });

  it('includes HTTP status and identifies HTML on error responses', async () => {
    const fetcher = vi.fn(async () => new Response('<html>not found</html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    }));
    await expect(fetchHealth('http://localhost:5173', fetcher)).rejects.toThrow(
      'HTTP 404. The server returned an HTML page',
    );
  });

  it('throws on unexpected response shape', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ status: 'weird' }));
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'unexpected response',
    );
  });

  it('wraps network failures', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(fetchHealth('http://127.0.0.1:3000', fetcher)).rejects.toThrow(
      'Could not reach the API',
    );
  });
});

const BASE = 'http://127.0.0.1:3000';
const TOKEN = 'test-access-token';

describe('submitAction', () => {
  const input = {
    userId: 'token-owner',
    clientActionId: 'a1',
    actionType: 'recycle' as const,
  };

  it('POSTs to /actions with a Bearer token and returns server-computed award', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ actionId: 'a1', pointsAwarded: 10, createdAt: 'x' }),
    );
    const r = await submitAction(BASE, input, TOKEN, fetcher);
    expect(r.pointsAwarded).toBe(10);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/actions`);
    expect((init?.body as string) ?? '').toContain('recycle');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('rejects missing token without calling fetch', async () => {
    const fetcher = vi.fn();
    await expect(submitAction(BASE, input, '', fetcher)).rejects.toThrow(
      'Not signed in',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps 409 duplicates to a no-double-award message', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: 'dup' }, 409));
    await expect(submitAction(BASE, input, TOKEN, fetcher)).rejects.toThrow(
      'no extra points',
    );
  });

  it('maps 400 to an invalid-input message and wraps network errors', async () => {
    const bad = vi.fn(async () => jsonResponse({ message: 'nope' }, 400));
    await expect(submitAction(BASE, input, TOKEN, bad)).rejects.toThrow('Invalid action');
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(submitAction(BASE, input, TOKEN, down)).rejects.toThrow('Request failed');
  });

  it('requires base URL without calling fetch', async () => {
    const fetcher = vi.fn();
    await expect(submitAction('', input, TOKEN, fetcher)).rejects.toThrow('not configured');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('listActions / getPoints', () => {
  it('GETs the token-protected URLs (no userId in the URL) and returns bodies', async () => {
    const listFetch = vi.fn(async () =>
      jsonResponse({ userId: 'sub', count: 1, actions: [] }),
    );
    await listActions(BASE, TOKEN, listFetch);
    const [listUrl, listInit] = listFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(listUrl).toBe(`${BASE}/actions`);
    expect((listInit?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );

    const ptsFetch = vi.fn(async () =>
      jsonResponse({ userId: 'sub', totalPoints: 35, actionCount: 2 }),
    );
    const pts = await getPoints(BASE, TOKEN, ptsFetch);
    expect(pts.totalPoints).toBe(35);
    const [ptsUrl] = ptsFetch.mock.calls[0] as unknown as [string];
    expect(ptsUrl).toBe(`${BASE}/points`);
  });

  it('throws on HTTP errors and rejects missing token', async () => {
    const err = vi.fn(async () => jsonResponse({}, 500));
    await expect(listActions(BASE, TOKEN, err)).rejects.toThrow('HTTP 500');
    await expect(getPoints(BASE, TOKEN, err)).rejects.toThrow('HTTP 500');
    const fetcher = vi.fn();
    await expect(listActions(BASE, '', fetcher)).rejects.toThrow('Not signed in');
    await expect(getPoints(BASE, '', fetcher)).rejects.toThrow('Not signed in');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('detects expired sessions from 401 errors', () => {
    expect(isSessionExpired(new Error('Request failed: HTTP 401'))).toBe(true);
    expect(isSessionExpired(new Error('Request failed: HTTP 500'))).toBe(false);
    expect(authHeaders(TOKEN)).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });
});

describe('photo upload flow', () => {
  it('validatePhotoFile accepts jpeg/png/webp ≤5MB, rejects gif/empty/oversize', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 100 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/webp', size: 100 })).toBeNull();
    expect(validatePhotoFile({ type: 'image/gif', size: 100 })).toMatch(/JPEG/);
    expect(validatePhotoFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(validatePhotoFile({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(
      /5 MB/,
    );
  });

  it('requestUploadUrl POSTs to /uploads with a Bearer token and returns the ticket', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ uploadUrl: 'https://s3.example/put', photoKey: 'uploads/u1/a1.png', expiresIn: 300 }),
    );
    const t = await requestUploadUrl(
      BASE,
      { clientActionId: 'a1', photoType: 'image/png', photoSize: 10 },
      TOKEN,
      fetcher,
    );
    expect(t.photoKey).toBe('uploads/u1/a1.png');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/uploads`);
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('requestUploadUrl maps 400 rejections and wraps network failures', async () => {
    const rej = vi.fn(async () => jsonResponse({ message: 'bad' }, 400));
    await expect(
      requestUploadUrl(BASE, { clientActionId: 'a', photoType: 'image/gif', photoSize: 1 }, TOKEN, rej),
    ).rejects.toThrow('rejected by server');
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(
      requestUploadUrl(BASE, { clientActionId: 'a', photoType: 'image/png', photoSize: 1 }, TOKEN, down),
    ).rejects.toThrow('Upload request failed');
    const anon = vi.fn();
    await expect(
      requestUploadUrl(BASE, { clientActionId: 'a', photoType: 'image/png', photoSize: 1 }, '', anon),
    ).rejects.toThrow('Not signed in');
    expect(anon).not.toHaveBeenCalled();
  });

  it('putPhotoBytes PUTs bytes with content type and throws on HTTP/network failure', async () => {
    const ok = vi.fn(async () => new Response(null, { status: 200 }));
    const blob = new Blob(['bytes'], { type: 'image/png' });
    await putPhotoBytes('https://s3.example/put', blob, 'image/png', ok);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://s3.example/put');
    expect(init?.method).toBe('PUT');

    const denied = vi.fn(async () => new Response(null, { status: 403 }));
    await expect(putPhotoBytes('https://s3.example/put', blob, 'image/png', denied)).rejects.toThrow(
      'HTTP 403',
    );
    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(putPhotoBytes('https://s3.example/put', blob, 'image/png', down)).rejects.toThrow(
      'Photo upload failed',
    );
  });

  it('newClientActionId generates unique ids', () => {
    expect(newClientActionId()).not.toBe(newClientActionId());
  });
});

describe('profile, leaderboard, orphan cleanup', () => {
  it('getMe GETs /me with Bearer and returns the profile', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ userId: 'sub-1', email: 'a@example.com', address: '1 Main St' }),
    );
    const me = await getMe(BASE, TOKEN, fetcher);
    expect(me.email).toBe('a@example.com');
    expect(me.address).toBe('1 Main St');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/me`);
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('getLeaderboard GETs /leaderboard with limit and Bearer', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ leaders: [{ displayId: 'user-1', totalPoints: 40, actionCount: 2 }], participantCount: 1 }),
    );
    const board = await getLeaderboard(BASE, TOKEN, 5, fetcher);
    expect(board.participantCount).toBe(1);
    expect(board.leaders[0].totalPoints).toBe(40);
    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${BASE}/leaderboard?limit=5`);
  });

  it('getMe/getLeaderboard reject missing token and surface HTTP errors', async () => {
    const fetcher = vi.fn();
    await expect(getMe(BASE, '', fetcher)).rejects.toThrow('Not signed in');
    await expect(getLeaderboard(BASE, '', 10, fetcher)).rejects.toThrow('Not signed in');
    expect(fetcher).not.toHaveBeenCalled();
    const err = vi.fn(async () => jsonResponse({}, 401));
    await expect(getMe(BASE, TOKEN, err)).rejects.toThrow('401');
  });

  it('deleteUpload sends authed DELETE and tolerates cleanup failures', async () => {
    const ok = vi.fn(async () => jsonResponse({ deleted: true }));
    await deleteUpload(BASE, 'uploads/sub/a.jpg', TOKEN, ok);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/uploads?photoKey=${encodeURIComponent('uploads/sub/a.jpg')}`);
    expect(init?.method).toBe('DELETE');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );

    const down = vi.fn(async () => {
      throw new TypeError('down');
    });
    await expect(
      deleteUpload(BASE, 'uploads/sub/a.jpg', TOKEN, down),
    ).resolves.toBeUndefined(); // best-effort: never throws
    const gone = vi.fn(async () => jsonResponse({}, 500));
    await expect(
      deleteUpload(BASE, 'uploads/sub/a.jpg', TOKEN, gone),
    ).resolves.toBeUndefined();
  });
});
````

## `src/auth.test.ts`

````ts
import { describe, it, expect } from 'vitest';
import { buildSignUpAttributes, getCognitoConfig, isValidAddress, isValidEmail, mapAuthError } from './auth';

describe('getCognitoConfig', () => {
  it('returns null when pool/client IDs are missing or placeholders', () => {
    expect(getCognitoConfig({})).toBeNull();
    expect(
      getCognitoConfig({
        VITE_COGNITO_USER_POOL_ID: 'PASTE_USER_POOL_ID_HERE',
        VITE_COGNITO_CLIENT_ID: 'PASTE_APP_CLIENT_ID_HERE',
      }),
    ).toBeNull();
    expect(
      getCognitoConfig({ VITE_COGNITO_USER_POOL_ID: 'us-east-1_abc' }),
    ).toBeNull();
  });

  it('returns public identifiers when configured (no secrets involved)', () => {
    const c = getCognitoConfig({
      VITE_COGNITO_USER_POOL_ID: 'us-east-1_abc123',
      VITE_COGNITO_CLIENT_ID: 'client123',
    });
    expect(c).toEqual({ userPoolId: 'us-east-1_abc123', clientId: 'client123' });
  });
});

describe('isValidEmail', () => {
  it('accepts normal emails and rejects junk', () => {
    expect(isValidEmail('a@example.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('signup address', () => {
  it('requires a nonblank address and sends Cognito standard address attribute', () => {
    expect(isValidAddress('  ')).toBe(false);
    expect(isValidAddress('  123 Main Street  ')).toBe(true);
    expect(buildSignUpAttributes(' a@example.com ', ' 123 Main Street ')
      .map((attribute) => [attribute.getName(), attribute.getValue()]))
      .toEqual([['email', 'a@example.com'], ['address', '123 Main Street']]);
  });
});

describe('mapAuthError', () => {
  it('maps wrong credentials without leaking details', () => {
    expect(mapAuthError({ code: 'NotAuthorizedException' })).toBe(
      'Incorrect email or password.',
    );
    expect(mapAuthError({ code: 'UserNotFoundException' })).toBe(
      'Incorrect email or password.',
    );
  });

  it('returns UNCONFIRMED sentinel for unverified accounts', () => {
    expect(mapAuthError({ code: 'UserNotConfirmedException' })).toBe('UNCONFIRMED');
  });

  it('maps signup/confirmation/rate-limit/password cases', () => {
    expect(mapAuthError({ code: 'UsernameExistsException' })).toMatch(/already exists/);
    expect(mapAuthError({ code: 'CodeMismatchException' })).toMatch(/Wrong confirmation/);
    expect(mapAuthError({ code: 'ExpiredCodeException' })).toMatch(/expired/);
    expect(mapAuthError({ code: 'LimitExceededException' })).toMatch(/Too many/);
    expect(mapAuthError({ code: 'InvalidPasswordException' })).toMatch(/Password/);
    expect(mapAuthError({ code: 'NetworkError' })).toMatch(/Network/);
  });

  it('never includes tokens in mapped messages', () => {
    const msgs = [
      mapAuthError({ code: 'X', message: 'x' }),
      mapAuthError(new Error('plain failure')),
      mapAuthError(undefined),
    ];
    for (const m of msgs) {
      expect(m).not.toMatch(/Bearer|eyJ|secret/i);
    }
  });
});
````

## `src/lib.test.ts`

````ts
import { describe, it, expect } from 'vitest';
import { backendModeFromEnv } from './lib';

describe('backend mode', () => {
  it('defaults to firebase when unset', () => {
    expect(backendModeFromEnv({})).toBe('firebase');
  });
  it('passes through aws mode', () => {
    expect(backendModeFromEnv({ VITE_BACKEND: 'aws' })).toBe('aws');
  });
});
````

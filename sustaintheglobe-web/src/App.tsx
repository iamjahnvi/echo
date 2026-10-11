import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import {
  fetchHealth,
  getApiBaseUrl,
  getDevelopmentApiBaseUrl,
  listActions,
  getPoints,
  getMe,
  getLeaderboard,
  deleteUpload,
  submitAction,
  requestUploadUrl,
  putPhotoBytes,
  validatePhotoFile,
  newClientActionId,
  isSessionExpired,
} from './api';
import type { ActionItem, ActionType, LeaderEntry } from './api';
import { AuthProvider, useAuth, isValidEmail, isValidAddress } from './auth';

export function backendMode(): string {
  const v = (import.meta as never as { env: Record<string, string | undefined> }).env
    .VITE_BACKEND;
  if (v === undefined || v === '' || v === 'firebase') return 'firebase';
  return v;
}

/* ------------------------------------------------------------------ */
/* Shared display data (UI only — backend remains authoritative)       */
/* ------------------------------------------------------------------ */

const ACTION_OPTIONS: { value: ActionType; label: string; points: number; blurb: string }[] = [
  { value: 'recycle', label: 'Recycle', points: 10, blurb: 'Sort & recycle waste' },
  { value: 'transit', label: 'Transit', points: 15, blurb: 'Bus, rail, bike or walk' },
  { value: 'energy', label: 'Energy', points: 20, blurb: 'Save electricity' },
  { value: 'cleanup', label: 'Cleanup', points: 25, blurb: 'Clean a public space' },
  { value: 'plant', label: 'Plant', points: 30, blurb: 'Plant a tree or garden' },
];

function actionMeta(value: string) {
  return ACTION_OPTIONS.find((o) => o.value === value) ?? ACTION_OPTIONS[0];
}

function statusTone(status: string | undefined): 'pending' | 'approved' | 'rejected' {
  const s = (status ?? 'approved').toLowerCase();
  if (s.includes('pend') || s.includes('verif') || s.includes('review')) return 'pending';
  if (s.includes('reject') || s.includes('fail') || s.includes('denied')) return 'rejected';
  return 'approved';
}

function StatusPill({ status }: { status: string | undefined }) {
  const tone = statusTone(status);
  const label = status ?? 'approved';
  return <span className={`pill pill-${tone}`}>{label}</span>;
}

function ActionGlyph({ value }: { value: string }) {
  const common = 'h-9 w-9 shrink-0 rounded-lg flex items-center justify-center border';
  const tone =
    value === 'plant'
      ? 'bg-forest text-ivory border-forest'
      : value === 'cleanup'
        ? 'bg-mist text-forest border-sage'
        : 'bg-cream text-forest border-sand';
  const path =
    value === 'recycle'
      ? 'M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M18 3v5h-5M6 21v-5h5'
      : value === 'cleanup'
        ? 'M4 20l4-1 11-11-3-3L5 16l-1 4zM13 7l3 3'
        : value === 'plant'
          ? 'M12 21v-8m0 0c0-4 3-7 8-7 0 4-3 7-8 7zm0 0c0-4-3-7-8-7 0 4 3 7 8 7z'
          : value === 'transit'
            ? 'M4 16V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8M4 16h16M4 16v2m16-2v2M7 20v1m10-1v1M7 12h.01M17 12h.01'
            : 'M13 2L4 14h6l-1 8 9-12h-6l1-8z';
  return (
    <span className={`${common} ${tone}`} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

function BrandMark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
          onDark ? 'bg-ivory/10 border-ivory/25 text-ivory' : 'bg-forest border-forest text-ivory'
        }`}
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3c-3 3.5-3 9 0 12M12 3c3 3.5 3 9 0 12M5.5 9.5h13M5.5 14.5h13" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={`block text-[17px] font-bold tracking-tight ${onDark ? 'text-ivory' : 'text-ink'}`}>
          SustainTheGlobe
        </span>
        <span className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${onDark ? 'text-mist' : 'text-moss'}`}>
          Environmental action
        </span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Home / routing                                                      */
/* ------------------------------------------------------------------ */

function Home() {
  const mode = backendMode();
  const env =
    typeof import.meta !== 'undefined'
      ? (import.meta as never as { env: Record<string, string | undefined> & { DEV?: boolean } }).env
      : {};
  const configuredApiBase = getApiBaseUrl(env);
  const apiBase = env.DEV
    ? getDevelopmentApiBaseUrl(configuredApiBase, window.location.origin)
    : configuredApiBase;
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

  if (mode === 'firebase' || apiBase === '') {
    return (
      <div className="min-h-screen bg-ivory">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <BrandMark />
          <h1 className="font-editorial mt-8 text-4xl leading-tight">SustainTheGlobe</h1>
          <p className="mt-3 text-moss">Backend mode: {mode}</p>
          <p className="mt-1 text-moss">Backend status: {health}</p>
          <div className="card mt-6 p-6">
            <p className="text-sm text-moss">
              The AWS experience needs an API URL. Set <code>VITE_API_URL</code> and the
              public Cognito IDs, then reload.
            </p>
          </div>
          <nav className="mt-6">
            <Link className="font-semibold text-forest underline underline-offset-4" to="/about">
              About SustainTheGlobe
            </Link>
          </nav>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AuthGate apiBase={apiBase} health={health} />
    </AuthProvider>
  );
}

function AuthGate({ apiBase, health }: { apiBase: string; health: string }) {
  const auth = useAuth();
  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory px-5">
        <div className="card w-full max-w-md p-8 text-center" role="status" aria-live="polite">
          <BrandMark />
          <p className="mt-6 font-semibold">Checking session…</p>
          <p className="mt-1 text-sm text-moss">Restoring your secure sign-in.</p>
        </div>
      </div>
    );
  }
  if (auth.status !== 'authed') return <AuthScreen health={health} />;
  return <Dashboard apiBase={apiBase} health={health} />;
}

/* ------------------------------------------------------------------ */
/* Authentication experience                                           */
/* ------------------------------------------------------------------ */

function AuthScreen({ health }: { health: string }) {
  const auth = useAuth();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [mail, setMail] = useState('');
  const [address, setAddress] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [fieldError, setFieldError] = useState('');

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

  const message = info !== '' ? info : auth.error;
  const isConfirm = auth.status === 'unconfirmed';

  return (
    <div className="auth-panel flex h-dvh flex-col overflow-hidden bg-ivory lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Slim brand bar — mobile only, keeps the form visible without scrolling */}
      <div className="flex shrink-0 items-center justify-between bg-deepforest px-5 py-3 lg:hidden">
        <BrandMark onDark />
        <Link className="text-xs font-semibold text-mist underline-offset-4 hover:underline" to="/about">
          About
        </Link>
      </div>
      {/* Editorial forest panel — desktop only so everything fits one screen */}
      <aside className="relative hidden overflow-hidden bg-deepforest text-ivory lg:block">
        <div className="absolute inset-0 bg-darkest" aria-hidden="true" />
        <svg
          className="absolute -right-24 -top-24 h-[420px] w-[420px] opacity-20"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="96" fill="none" stroke="#d5dfd1" strokeWidth="1" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#d5dfd1" strokeWidth="1" />
          <circle cx="100" cy="100" r="44" fill="none" stroke="#dcbd97" strokeWidth="1" />
        </svg>
        <svg
          className="absolute -bottom-28 -left-20 h-[380px] w-[380px] opacity-15"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <path d="M100 10 C 60 70, 60 130, 100 190 M100 10 C 140 70, 140 130, 100 190" fill="none" stroke="#a8b5a0" strokeWidth="1.2" />
          <path d="M100 60 C 80 70, 70 90, 68 110 M100 60 C 120 70, 130 90, 132 110" fill="none" stroke="#e9d5bd" strokeWidth="1.2" />
        </svg>
        <div className="relative flex h-full min-h-0 flex-col justify-center px-14 py-8">
          <BrandMark onDark />
          <div className="mt-8 max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-claysand">
              Every action counts
            </p>
            <h1 className="font-editorial mt-3 text-[2.6rem] leading-[1.06]">
              Small everyday actions, grown into a greener globe.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ivory/85">
              Log recycling, cleanups, plantings, low-carbon transit and energy savings.
              Verified actions earn points and move you up the seasonal leaderboard.
            </p>
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-2.5">
              {[
                { k: '5', v: 'Action types' },
                { k: '10–30', v: 'Points each' },
                { k: 'Top 20', v: 'Leaderboard' },
              ].map((s) => (
                <div key={s.v} className="leaf-ring rounded-xl px-3.5 py-2.5">
                  <dt className="font-editorial text-xl">{s.k}</dt>
                  <dd className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-mist">{s.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex max-w-md flex-wrap gap-1.5">
              {ACTION_OPTIONS.map((a) => (
                <span key={a.value} className="rounded-full border border-ivory/25 bg-ivory/[0.06] px-3 py-1 text-xs font-semibold capitalize">
                  {a.label} · <span className="text-claymid">{a.points}</span>
                </span>
              ))}
            </div>
          </div>
          <p className="mt-6 text-xs text-ivory/60">{health}</p>
        </div>
      </aside>

      {/* Form panel — fills the viewport height, centers the card, no page scroll */}
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-4 sm:px-8">
        <div className="w-full max-w-md py-2">
          <div className="card p-6">
            {isConfirm ? (
              <section aria-labelledby="confirm-heading">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-claydeep">Almost there</p>
                <h2 id="confirm-heading" className="font-editorial mt-1 text-[1.7rem] leading-tight">
                  Confirm your email
                </h2>
                <p className="mt-1 text-sm text-moss">
                  We sent a verification code to{' '}
                  <strong className="text-ink">{auth.pendingEmail}</strong>. Enter it below.
                </p>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim() === '') {
                      setInfo('Enter the verification code from your email.');
                      return;
                    }
                    run(() => auth.confirm(code));
                  }}
                >
                  <div>
                    <label className="field-label" htmlFor="confirm-code">
                      Verification code
                    </label>
                    <input
                      id="confirm-code"
                      className="field-input tracking-[0.3em]"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="••••••"
                      aria-invalid={fieldError !== '' ? true : undefined}
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full" disabled={busy}>
                    {busy ? 'Confirming…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary w-full"
                    disabled={busy}
                    onClick={() => run(() => auth.resend(), 'A new code was sent to your email.')}
                  >
                    {busy ? 'Working…' : 'Resend code'}
                  </button>
                </form>
                {message !== '' ? (
                  <p role={message.startsWith('Email confirmed') || message.startsWith('A new code') ? 'status' : 'alert'} className="mt-4 rounded-lg bg-cream px-4 py-3 text-sm font-medium">
                    {message}
                  </p>
                ) : null}
              </section>
            ) : (
              <section aria-labelledby="auth-heading">
                <h2 id="auth-heading" className="font-editorial text-[1.7rem] leading-tight">
                  {tab === 'in' ? 'Welcome back' : 'Join the movement'}
                </h2>
                <p className="mt-0.5 text-sm text-moss">
                  {tab === 'in'
                    ? 'Sign in to log actions and track your impact.'
                    : 'Create an account to start earning verified points.'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1" role="tablist" aria-label="Sign in or sign up">
                  {(
                    [
                      { key: 'in', label: 'Sign in' },
                      { key: 'up', label: 'Sign up' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={tab === t.key}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setTab(t.key);
                        auth.clearError();
                        setInfo('');
                        setFieldError('');
                      }}
                      className={`min-h-[2.75rem] rounded-lg text-[15px] font-semibold transition ${
                        tab === t.key ? 'bg-forest text-ivory' : 'text-moss hover:text-ink'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <form
                  className="mt-3 space-y-3"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!isValidEmail(mail)) {
                      setFieldError('email');
                      setInfo('Enter a valid email address.');
                      return;
                    }
                    if (tab === 'up' && !isValidAddress(address)) {
                      setFieldError('address');
                      setInfo('Enter your address.');
                      return;
                    }
                    if (pw.length < 8) {
                      setFieldError('password');
                      setInfo('Password needs at least 8 characters.');
                      return;
                    }
                    setFieldError('');
                    if (tab === 'in') run(() => auth.signIn(mail, pw));
                    else run(() => auth.signUp(mail, pw, address));
                  }}
                >
                  <div>
                    <label className="field-label" htmlFor="auth-email">
                      Email
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      className="field-input"
                      value={mail}
                      onChange={(e) => setMail(e.target.value)}
                      autoComplete="email"
                      placeholder="you@example.org"
                      aria-invalid={fieldError === 'email' ? true : undefined}
                    />
                  </div>
                  {tab === 'up' ? (
                    <div>
                      <label className="field-label" htmlFor="auth-address">
                        Address
                      </label>
                      <input
                        id="auth-address"
                        className="field-input"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        autoComplete="street-address"
                        placeholder="Street, city"
                        required
                        aria-invalid={fieldError === 'address' ? true : undefined}
                      />
                      <p className="field-hint mt-1">Required for registration.</p>
                    </div>
                  ) : null}
                  <div>
                    <label className="field-label" htmlFor="auth-password">
                      Password
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      className="field-input"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
                      placeholder="••••••••"
                      aria-invalid={fieldError === 'password' ? true : undefined}
                    />
                    {tab === 'up' ? (
                      <p className="field-hint mt-1">8+ characters with upper/lowercase and a number.</p>
                    ) : null}
                  </div>
                  <button type="submit" className="btn-primary w-full" disabled={busy}>
                    {busy ? 'Working…' : tab === 'in' ? 'Sign in' : 'Create account'}
                  </button>
                </form>
                {message !== '' ? (
                  <p role="alert" className="mt-3 rounded-lg bg-cream px-3.5 py-2.5 text-sm font-medium">
                    {message}
                  </p>
                ) : null}
                <p className="mt-3 text-xs leading-relaxed text-moss">
                  Protected by Amazon Cognito — tokens and private photos never leave safe handling.
                </p>
              </section>
            )}
          </div>
          <div className="mt-2.5 hidden items-center justify-between text-sm lg:flex">
            <Link className="font-semibold text-forest underline-offset-4 hover:underline" to="/about">
              About SustainTheGlobe
            </Link>
            <span className="hidden text-xs text-moss sm:block">{health}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Authenticated dashboard                                             */
/* ------------------------------------------------------------------ */

function ProfileLine({
  apiBase,
  token,
  fallback,
  onEmail,
}: {
  apiBase: string;
  token: string;
  fallback: string;
  onEmail: (e: string) => void;
}) {
  const [email, setEmail] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    getMe(apiBase, token)
      .then((me) => {
        if (!cancelled && me.email) {
          setEmail(me.email);
          onEmail(me.email);
        }
      })
      .catch(() => {
        // Fall back to the Cognito-known email; profile is best-effort.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);
  const initial = (email.trim()[0] ?? 'E').toUpperCase();
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-bold text-forest" aria-hidden="true">
        {initial}
      </span>
      <span className="min-w-0">
        <span className="block max-w-[220px] truncate text-sm font-semibold text-ink sm:max-w-[320px]">
          {email}
        </span>
        <span className="block text-xs text-moss">Verified member</span>
      </span>
    </span>
  );
}

function Leaderboard({
  apiBase,
  token,
  onSessionExpired,
  refreshKey,
}: {
  apiBase: string;
  token: string;
  onSessionExpired: () => void;
  refreshKey: number;
}) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [note, setNote] = useState('Loading leaderboard…');
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setNote('Loading leaderboard…');
    getLeaderboard(apiBase, token, 10)
      .then((b) => {
        if (cancelled) return;
        setLeaders(b.leaders);
        setParticipantCount(b.participantCount);
        setState('ready');
        setNote(
          b.leaders.length === 0
            ? 'No actions yet — be the first on the board!'
            : `${b.participantCount} participant(s) this season.`,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isSessionExpired(err)) {
          onSessionExpired();
          return;
        }
        setState('error');
        setNote(err instanceof Error ? `Leaderboard unavailable: ${err.message}` : 'Leaderboard unavailable.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token, refreshKey]);

  const rankStyle = (i: number) =>
    i === 0
      ? 'bg-claylight text-claydeep border-claymid'
      : i === 1
        ? 'bg-cream text-forest border-sand'
        : i === 2
          ? 'bg-mist/60 text-forest border-sage/60'
          : 'bg-cream text-moss border-sand';

  return (
    <section aria-labelledby="leaderboard-heading" className="card overflow-hidden">
      <div className="border-b border-sand bg-cream/60 px-6 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="leaderboard-heading" className="font-editorial text-2xl">
              Leaderboard
            </h2>
            <p className="mt-0.5 text-sm text-moss" role="status">
              {note}
            </p>
          </div>
          {participantCount !== null && state === 'ready' ? (
            <span className="rounded-full border border-sand bg-ivory px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss">
              {participantCount} this season
            </span>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-3 sm:px-5">
        {state === 'loading' ? (
          <ul className="space-y-2 py-2" aria-label="Loading leaderboard">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-14 animate-pulse rounded-xl bg-cream" />
            ))}
          </ul>
        ) : state === 'error' ? (
          <p role="alert" className="mx-1 my-4 rounded-lg bg-[#fbe9e7] px-4 py-3 text-sm font-medium text-[#8f1d14]">
            {note}
          </p>
        ) : leaders.length === 0 ? (
          <div className="mx-1 my-4 rounded-xl border border-dashed border-sage bg-ivory px-5 py-8 text-center">
            <p className="font-editorial text-xl">No actions yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-moss">
              Be the first on the board — submit a verified action and watch your name appear here.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-sand">
            {leaders.map((l, i) => (
              <li key={l.displayId} className="flex items-center gap-3 px-1 py-3 sm:gap-4 sm:px-2">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${rankStyle(i)}`}
                  aria-label={`Rank ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] ${i < 3 ? 'font-bold' : 'font-semibold'}`}>
                    {l.displayId}
                  </span>
                  <span className="block text-xs text-moss">{l.actionCount} action{l.actionCount === 1 ? '' : 's'}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-bold text-forest">{l.totalPoints} pts</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function ActionsPanel({
  apiBase,
  token,
  onSessionExpired,
  onSubmitted,
}: {
  apiBase: string;
  token: string;
  onSessionExpired: () => void;
  onSubmitted: () => void;
}) {
  const [actionType, setActionType] = useState<ActionType>('recycle');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('Record an environmental action below.');
  const [statusKind, setStatusKind] = useState<'info' | 'success' | 'error'>('info');
  const [busy, setBusy] = useState(false);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [actionCount, setActionCount] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = actionMeta(actionType);
  const preview = useMemo(() => previewUrl, [previewUrl]);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function expired(err: unknown): boolean {
    if (isSessionExpired(err)) {
      onSessionExpired();
      return true;
    }
    return false;
  }

  async function refresh() {
    try {
      const [list, pts] = await Promise.all([
        listActions(apiBase, token),
        getPoints(apiBase, token),
      ]);
      setActions(list.actions);
      setTotalPoints(pts.totalPoints);
      setActionCount(pts.actionCount);
    } catch (err) {
      if (!expired(err)) {
        // List/points refresh is best-effort; submit reports its own errors.
      }
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  function say(msg: string, kind: 'info' | 'success' | 'error' = 'info') {
    setStatus(msg);
    setStatusKind(kind);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setPhoto(null);
      return;
    }
    const err = validatePhotoFile(f);
    if (err) {
      say(err, 'error');
      e.target.value = '';
      setPhoto(null);
      return;
    }
    setPhoto(f);
    say('Photo selected — not uploaded yet.', 'info');
  }

  function clearPhoto() {
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = '';
    say('Photo removed. You can submit without evidence.', 'info');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
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
        say('Requesting photo upload…', 'info');
        const ticket = await requestUploadUrl(
          apiBase,
          { clientActionId, photoType: photo.type, photoSize: photo.size },
          token,
        );
        say('Uploading photo…', 'info');
        await putPhotoBytes(ticket.uploadUrl, photo, photo.type);
        uploadedKey = ticket.photoKey;
        photoKey = ticket.photoKey;
        photoName = photo.name;
        photoSize = photo.size;
        photoType = photo.type;
      }
      say('Saving action…', 'info');
      // userId is a display value only — the backend derives ownership from
      // the verified access token and ignores it.
      const r = await submitAction(
        apiBase,
        {
          userId: 'token-owner',
          clientActionId,
          actionType,
          note: note === '' ? undefined : note,
          photoName,
          photoSize,
          photoType,
          photoKey,
        },
        token,
      );
      uploadedKey = undefined; // recorded — no longer an orphan.
      say(
        `Submitted for verification (status: ${r.status}). Points are awarded only after approval — nothing yet.`,
        'success',
      );
      setNote('');
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
      onSubmitted();
    } catch (err) {
      if (uploadedKey) {
        // The bytes landed but the record did not: remove our own orphan.
        // Best-effort — the submit error below is what the user must see.
        await deleteUpload(apiBase, uploadedKey, token);
      }
      if (!expired(err)) say(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const statusBox =
    statusKind === 'success'
      ? 'bg-[#e3ecdf] text-forest border-sage/70'
      : statusKind === 'error'
        ? 'bg-[#fbe9e7] text-[#8f1d14] border-[#e5a9a3]'
        : 'bg-cream text-moss border-sand';

  return (
    <div className="space-y-6">
      <section aria-labelledby="log-action-heading" className="card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="log-action-heading" className="font-editorial text-2xl">
              Log an action
            </h2>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-moss">
              Submitted actions enter verification as <strong>pending</strong> — points are
              awarded only after approval. Photos stay private and are shown here by filename only.
            </p>
          </div>
          <span className="rounded-full border border-claymid bg-claylight px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#7a4a1f]">
            {meta.points} pts · {meta.label}
          </span>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <fieldset>
            <legend className="field-label">Action</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Action type">
              {ACTION_OPTIONS.map((o) => {
                const active = actionType === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={busy}
                    onClick={() => setActionType(o.value)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                      active ? 'border-forest bg-forest text-ivory' : 'border-sand bg-ivory text-ink hover:border-sage'
                    }`}
                  >
                    <span className={`text-sm font-bold capitalize ${active ? 'text-ivory' : 'text-ink'}`}>{o.label}</span>
                    <span className={`text-xs font-semibold ${active ? 'text-claymid' : 'text-claydeep'}`}>{o.points} pts</span>
                  </button>
                );
              })}
            </div>
            <label className="field-label mt-4" htmlFor="action-select">
              Or choose from the list
            </label>
            <select
              id="action-select"
              className="field-input"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
              disabled={busy}
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.points} pts · {o.blurb}
                </option>
              ))}
            </select>
          </fieldset>

          <div>
            <label className="field-label" htmlFor="action-note">
              Note <span className="font-normal text-moss">(optional)</span>
            </label>
            <textarea
              id="action-note"
              className="field-input min-h-[5.5rem] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={busy}
              placeholder="Where, what, and who joined you…"
            />
            <p className="field-hint mt-1.5">{note.length}/500</p>
          </div>

          <div>
            <span className="field-label" id="photo-label">
              Photo evidence <span className="font-normal text-moss">(optional · JPEG/PNG/WebP ≤ 5 MB)</span>
            </span>
            {!photo ? (
              <label
                htmlFor="action-photo"
                className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sage bg-ivory px-6 py-8 text-center transition hover:border-forest hover:bg-cream"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#244337" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="M21 15l-5-5-9 9" />
                </svg>
                <span className="text-sm font-semibold text-forest">Choose a photo — or drag it here</span>
                <span className="text-xs text-moss">Stored privately as verification evidence. Never made public.</span>
              </label>
            ) : (
              <div className="mt-1 flex items-center gap-4 rounded-xl border border-sand bg-ivory p-3">
                {preview ? (
                  <img src={preview} alt="Selected evidence preview" className="h-16 w-16 shrink-0 rounded-lg border border-sand object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{photo.name}</p>
                  <p className="text-xs text-moss">
                    {(photo.size / 1024).toFixed(1)} KB · {photo.type} · uploads on submit
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-secondary !min-h-[2.5rem] px-3 py-1.5 text-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                    Change
                  </button>
                  <button type="button" className="btn-secondary !min-h-[2.5rem] px-3 py-1.5 text-sm" disabled={busy} onClick={clearPhoto}>
                    Remove
                  </button>
                </div>
              </div>
            )}
            <input
              id="action-photo"
              ref={fileRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFile}
              disabled={busy}
              aria-labelledby="photo-label"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Submitting…
              </>
            ) : (
              'Submit action for verification'
            )}
          </button>
        </form>

        <p role="status" aria-live="polite" className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${statusBox}`}>
          {status}
        </p>
      </section>

      <section aria-labelledby="recent-heading" className="card overflow-hidden">
        <div className="border-b border-sand bg-cream/60 px-6 py-4">
          <h2 id="recent-heading" className="font-editorial text-xl">
            Your recent actions
          </h2>
          <p className="text-sm text-moss">
            {actionCount === null ? 'Loading…' : `${actionCount} verified action${actionCount === 1 ? '' : 's'} · `}
            {totalPoints === null ? '—' : `${totalPoints} total points`}
          </p>
        </div>
        {actions.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="font-semibold">Nothing here yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-moss">
              Your submitted actions will appear here with their verification status.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-sand">
            {actions.map((a) => (
              <li key={a.actionId} className="flex items-start gap-3 px-6 py-4">
                <ActionGlyph value={a.actionType} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold capitalize">{a.actionType}</span>
                    <span className="text-sm font-bold text-forest">+{a.points} pts</span>
                    <StatusPill status={a.status} />
                  </div>
                  {a.note ? <p className="mt-0.5 truncate text-sm text-moss">{a.note}</p> : null}
                  <p className="mt-0.5 text-xs text-moss">
                    {a.photoName ? `Evidence: ${a.photoName} (private) · ` : ''}
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dashboard({ apiBase, health }: { apiBase: string; health: string }) {
  const auth = useAuth();
  const authed = auth.status === 'authed' ? auth : null;
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!authed) return null;
  const displayEmail = profileEmail ?? authed.email;

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-sand bg-ivory/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3.5">
          <Link to="/" aria-label="SustainTheGlobe home">
            <BrandMark />
          </Link>
          <nav className="ml-2 hidden items-center gap-5 text-sm font-semibold sm:flex" aria-label="Primary">
            <span className="text-forest">Home</span>
            <Link className="text-moss hover:text-ink" to="/about">
              About
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ProfileLine apiBase={apiBase} token={authed.idToken} fallback={authed.email} onEmail={setProfileEmail} />
            <button type="button" onClick={auth.signOut} className="btn-secondary !min-h-[2.5rem] px-4 py-2 text-sm">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        {/* Hero */}
        <section aria-labelledby="welcome-heading" className="relative mt-6 overflow-hidden rounded-2xl bg-forest text-ivory">
          <svg className="absolute -right-16 -top-20 h-72 w-72 opacity-20" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="96" fill="none" stroke="#f5f3ea" strokeWidth="1" />
            <circle cx="100" cy="100" r="64" fill="none" stroke="#d5dfd1" strokeWidth="1" />
            <circle cx="100" cy="100" r="34" fill="none" stroke="#dcbd97" strokeWidth="1.5" />
          </svg>
          <div className="relative grid gap-6 p-7 sm:p-9 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-claysand">Season in progress</p>
              <h1 id="welcome-heading" className="font-editorial mt-2 text-3xl leading-tight sm:text-4xl">
                Welcome back, planet keeper.
              </h1>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ivory/85">
                Signed in as <strong className="text-ivory">{displayEmail}</strong>. Every action
                you submit enters verification — points land only after approval.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                {ACTION_OPTIONS.map((a) => (
                  <span key={a.value} className="rounded-full border border-ivory/25 bg-ivory/10 px-3 py-1 capitalize">
                    {a.label} · {a.points}
                  </span>
                ))}
              </div>
            </div>
            <HeroPoints apiBase={apiBase} token={authed.idToken} onSessionExpired={auth.sessionExpired} bump={refreshKey} />
          </div>
        </section>

        <p className="mt-3 text-xs text-moss" role="status">
          {health}
        </p>

        {/* Main grid */}
        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <ActionsPanel
            apiBase={apiBase}
            token={authed.idToken}
            onSessionExpired={auth.sessionExpired}
            onSubmitted={() => setRefreshKey((k) => k + 1)}
          />
          <div className="space-y-6">
            <Leaderboard apiBase={apiBase} token={authed.idToken} onSessionExpired={auth.sessionExpired} refreshKey={refreshKey} />
            <section aria-labelledby="verify-heading" className="card bg-deepforest p-6 text-ivory">
              <h2 id="verify-heading" className="font-editorial text-xl">
                How verification works
              </h2>
              <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-ivory/85">
                <li className="flex gap-2.5"><span className="font-bold text-claymid">1.</span> You submit an action — it is recorded as pending.</li>
                <li className="flex gap-2.5"><span className="font-bold text-claymid">2.</span> A reviewer checks your note and private photo.</li>
                <li className="flex gap-2.5"><span className="font-bold text-claymid">3.</span> Approved actions add points to your total and the leaderboard.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="pill pill-pending">Pending</span>
                <span className="pill pill-approved">Approved</span>
                <span className="pill pill-rejected">Rejected</span>
              </div>
            </section>
          </div>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-sand pt-5 text-sm text-moss">
          <span>SustainTheGlobe · Verified environmental action</span>
          <Link className="font-semibold text-forest underline-offset-4 hover:underline" to="/about">
            About this project
          </Link>
        </footer>
      </main>
    </div>
  );
}

function HeroPoints({
  apiBase,
  token,
  onSessionExpired,
  bump,
}: {
  apiBase: string;
  token: string;
  onSessionExpired: () => void;
  bump: number;
}) {
  const [points, setPoints] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPoints(apiBase, token)
      .then((p) => {
        if (cancelled) return;
        setPoints(p.totalPoints);
        setCount(p.actionCount);
      })
      .catch((err: unknown) => {
        if (isSessionExpired(err)) {
          onSessionExpired();
          return;
        }
        // Hero points are best-effort; the panel below reports errors.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token, bump]);

  return (
    <div className="rounded-2xl border border-ivory/20 bg-darkest/60 p-6" aria-live="polite">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-mist">Your total points</p>
      <p className="font-editorial mt-1 text-6xl leading-none">{points === null ? '—' : points}</p>
      <p className="mt-2 text-sm text-ivory/75">
        {count === null ? 'Loading your impact…' : `${count} verified action${count === 1 ? '' : 's'} on record`}
      </p>
      <p className="mt-3 border-t border-ivory/15 pt-3 text-xs leading-relaxed text-ivory/60">
        Points update only when the backend approves an action. Nothing is added at submit time.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* About (preserved route)                                             */
/* ------------------------------------------------------------------ */

function About() {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-sand">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-4">
          <Link to="/" aria-label="Back to home">
            <BrandMark />
          </Link>
          <nav className="ml-auto text-sm font-semibold" aria-label="Primary">
            <Link className="text-forest underline-offset-4 hover:underline" to="/">
              Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-claydeep">About</p>
        <h1 className="font-editorial mt-2 text-4xl leading-tight sm:text-5xl">
          Small actions, verified impact.
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-moss">
          SustainTheGlobe is an environmental action platform backed by AWS. Members sign in
          with Amazon Cognito, record everyday actions — recycling, cleanups, plantings,
          low-carbon transit and energy savings — and earn server-computed points once actions
          are approved. Photos are stored privately in S3 as verification evidence and are
          never made public. The leaderboard aggregates the season&apos;s top contributors.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="card p-6">
            <h2 className="font-editorial text-xl">How points work</h2>
            <ul className="mt-3 space-y-1.5 text-[15px]">
              {ACTION_OPTIONS.map((a) => (
                <li key={a.value} className="flex items-center justify-between border-b border-cream py-1.5 last:border-0">
                  <span className="font-semibold capitalize">{a.label}</span>
                  <span className="font-bold text-forest">{a.points} pts</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-moss">
              Submissions start as pending. Points are awarded only after approval.
            </p>
          </div>
          <div className="card bg-deepforest p-6 text-ivory">
            <h2 className="font-editorial text-xl">Privacy by design</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ivory/85">
              <li>Sign-in is handled by Amazon Cognito; passwords never touch our code.</li>
              <li>Every protected request carries your session token — no frontend-only auth.</li>
              <li>Evidence photos live in a private bucket, shown by filename only.</li>
              <li>Leaderboard identities are masked display IDs from the backend.</li>
            </ul>
          </div>
        </div>
        <Link to="/" className="btn-primary mt-8">
          Back to SustainTheGlobe
        </Link>
      </main>
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

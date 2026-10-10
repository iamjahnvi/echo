import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { fetchHealth, getApiBaseUrl, getDevelopmentApiBaseUrl, listActions, getPoints, getMe, getLeaderboard, deleteUpload, submitAction, requestUploadUrl, putPhotoBytes, validatePhotoFile, newClientActionId, isSessionExpired } from './api';
import type { ActionItem, LeaderEntry } from './api';
import { AuthProvider, useAuth, isValidEmail } from './auth';

export function backendMode(): string {
  const v = (import.meta as never as { env: Record<string, string | undefined> }).env
    .VITE_BACKEND;
  if (v === undefined || v === '' || v === 'firebase') return 'firebase';
  return v;
}

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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">SustainTheGlobe</h1>
      <p>Backend mode: {mode}</p>
      <p>Backend status: {health}</p>
      {mode !== 'firebase' && apiBase !== '' ? (
        <AuthProvider>
          <AwsSection apiBase={apiBase} />
        </AuthProvider>
      ) : null}
      <nav>
        <Link to="/about">About</Link>
      </nav>
    </div>
  );
}

function AwsSection({ apiBase }: { apiBase: string }) {
  const auth = useAuth();
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  if (auth.status === 'loading') return <p>Checking session…</p>;
  if (auth.status !== 'authed') return <AuthScreen />;
  return (
    <div>
      <ProfileLine apiBase={apiBase} token={auth.accessToken} fallback={auth.email} onEmail={setProfileEmail} />
      <button onClick={auth.signOut}>Sign out</button>
      <ActionsPanel apiBase={apiBase} token={auth.accessToken} onSessionExpired={auth.sessionExpired} />
      <Leaderboard apiBase={apiBase} token={auth.accessToken} onSessionExpired={auth.sessionExpired} />
    </div>
  );
}

function ProfileLine({ apiBase, token, fallback, onEmail }: { apiBase: string; token: string; fallback: string; onEmail: (e: string) => void }) {
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
  return <p>Signed in as {email}</p>;
}

function Leaderboard({ apiBase, token, onSessionExpired }: { apiBase: string; token: string; onSessionExpired: () => void }) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [note, setNote] = useState('Loading leaderboard…');
  useEffect(() => {
    let cancelled = false;
    getLeaderboard(apiBase, token, 10)
      .then((b) => {
        if (cancelled) return;
        setLeaders(b.leaders);
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
        setNote('Leaderboard unavailable right now.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);
  return (
    <section>
      <h2 className="text-xl font-bold">Leaderboard</h2>
      <p>{note}</p>
      <ol>
        {leaders.map((l) => (
          <li key={l.displayId}>
            {l.displayId} — {l.totalPoints} pts ({l.actionCount} actions)
          </li>
        ))}
      </ol>
    </section>
  );
}

function AuthScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [mail, setMail] = useState('');
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
      <section>
        <h2 className="text-xl font-bold">Confirm your email</h2>
        <p>We sent a code to {auth.pendingEmail}. Enter it below.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => auth.confirm(code));
          }}
        >
          <label>
            Code
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Working…' : 'Confirm'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => auth.resend())}
          >
            Resend code
          </button>
        </form>
        <p>{info !== '' ? info : auth.error}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-bold">Sign in to log actions</h2>
      <div>
        <button type="button" onClick={() => { setTab('in'); auth.clearError(); }}>
          Sign in
        </button>
        <button type="button" onClick={() => { setTab('up'); auth.clearError(); }}>
          Sign up
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isValidEmail(mail)) {
            setInfo('Enter a valid email address.');
            return;
          }
          if (tab === 'in') run(() => auth.signIn(mail, pw));
          else run(() => auth.signUp(mail, pw));
        }}
      >
        <label>
          Email
          <input value={mail} onChange={(e) => setMail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Working…' : tab === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p>{info !== '' ? info : auth.error}</p>
    </section>
  );
}

function ActionsPanel({ apiBase, token, onSessionExpired }: { apiBase: string; token: string; onSessionExpired: () => void }) {
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
      const [list, pts] = await Promise.all([
        listActions(apiBase, token),
        getPoints(apiBase, token),
      ]);
      setActions(list.actions);
      setTotalPoints(pts.totalPoints);
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
      // userId is a display value only — the backend derives ownership from
      // the verified access token and ignores it.
      const r = await submitAction(apiBase, {
        userId: 'token-owner',
        clientActionId,
        actionType: actionType as 'recycle',
        note: note === '' ? undefined : note,
        photoName,
        photoSize,
        photoType,
        photoKey,
      }, token);
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
    <section>
      <h2 className="text-xl font-bold">Log an action, earn points</h2>
      <p>Points are awarded for each submitted action (recycle 10, transit 15, energy 20, cleanup 25, plant 30). Photos are stored privately; they are attached as evidence, not verification.</p>
      <p>Total points: {totalPoints === null ? '—' : totalPoints}</p>
      <form onSubmit={onSubmit}>
        <label>
          Action
          <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
            <option value="recycle">recycle</option>
            <option value="cleanup">cleanup</option>
            <option value="plant">plant</option>
            <option value="transit">transit</option>
            <option value="energy">energy</option>
          </select>
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </label>
        <label>
          Photo (optional, JPEG/PNG/WebP ≤ 5 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Working…' : 'Submit action'}
        </button>
      </form>
      <p>{status}</p>
      <ul>
        {actions.map((a) => (
          <li key={a.actionId}>
            {a.actionType} +{a.points}pts{a.photoName ? ` (${a.photoName})` : ''}
            {a.note ? ` — ${a.note}` : ''}
          </li>
        ))}
      </ul>
    </section>
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

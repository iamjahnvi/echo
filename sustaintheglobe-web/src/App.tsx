import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { create } from 'zustand';
import moment from 'moment';
import { fetchHealth, getApiBaseUrl, listActions, getPoints, submitAction, requestUploadUrl, putPhotoBytes, validatePhotoFile, newClientActionId } from './api';
import type { ActionItem } from './api';

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
      {mode !== 'firebase' && apiBase !== '' ? (
        <ActionsPanel apiBase={apiBase} />
      ) : null}
      <nav>
        <Link to="/about">About</Link>
      </nav>
    </div>
  );
}

function ActionsPanel({ apiBase }: { apiBase: string }) {
  const [userId, setUserId] = useState('demo-user');
  const [actionType, setActionType] = useState('recycle');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState('Record an environmental action below.');
  const [busy, setBusy] = useState(false);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);

  async function refresh(uid: string) {
    try {
      const [list, pts] = await Promise.all([
        listActions(apiBase, uid),
        getPoints(apiBase, uid),
      ]);
      setActions(list.actions);
      setTotalPoints(pts.totalPoints);
    } catch {
      // List/points refresh is best-effort; submit reports its own errors.
    }
  }

  useEffect(() => {
    refresh(userId.trim() === '' ? 'demo-user' : userId.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

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
    const uid = userId.trim() === '' ? 'demo-user' : userId.trim();
    setBusy(true);
    try {
      // One idempotency key for the whole attempt: safe to retry after any failure.
      const clientActionId = newClientActionId();
      let photoKey: string | undefined;
      let photoName: string | undefined;
      let photoSize: number | undefined;
      let photoType: string | undefined;
      if (photo) {
        setStatus('Requesting photo upload…');
        const ticket = await requestUploadUrl(
          apiBase,
          { userId: uid, clientActionId, photoType: photo.type, photoSize: photo.size },
        );
        setStatus('Uploading photo…');
        await putPhotoBytes(ticket.uploadUrl, photo, photo.type);
        photoKey = ticket.photoKey;
        photoName = photo.name;
        photoSize = photo.size;
        photoType = photo.type;
      }
      setStatus(photo ? 'Saving action…' : 'Saving action…');
      // NOTE: if this call fails after a successful PUT, the uploaded object
      // stays in private storage without an action record (orphaned). It is
      // invisible to the app and retried submits reuse a fresh key; lifecycle
      // cleanup is a P2 task (see PROJECT_STATUS.md).
      const r = await submitAction(apiBase, {
        userId: uid,
        clientActionId,
        actionType: actionType as 'recycle',
        note: note === '' ? undefined : note,
        photoName,
        photoSize,
        photoType,
        photoKey,
      });
      setStatus(`Recorded! +${r.pointsAwarded} pts for this submitted action.`);
      setNote('');
      setPhoto(null);
      await refresh(uid);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
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
          User ID
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
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

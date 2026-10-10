export function backendModeFromEnv(env: Record<string, string | undefined>): string {
  const v = env.VITE_BACKEND;
  if (v === undefined || v === '' || v === 'firebase') return 'firebase';
  return v;
}

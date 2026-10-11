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

/** API Gateway REST Cognito authorizers without OAuth scopes expect ID tokens. */
export function getApiIdToken(session: {
  getIdToken: () => { getJwtToken: () => string };
}): string {
  return session.getIdToken().getJwtToken();
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
  idToken: string;
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
  const [idToken, setIdToken] = useState('');
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
    setIdToken(token);
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
      getIdToken: () => { getJwtToken: () => string };
    } | null) => {
      if (err || !session || !session.isValid()) {
        setStatus('anon');
        return;
      }
      const token = getApiIdToken(session);
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
          applySession(mail.trim(), getApiIdToken(session));
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
    setIdToken('');
    setPendingEmail('');
    setError('');
    setStatus('anon');
  };

  const sessionExpired = () => {
    pool?.getCurrentUser()?.signOut();
    setIdToken('');
    setEmail('');
    setStatus('anon');
    setError('Session expired — please sign in again.');
  };

  const value: AuthState = {
    status,
    email,
    idToken,
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

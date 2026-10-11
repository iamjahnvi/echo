import { describe, it, expect } from 'vitest';
import { buildSignUpAttributes, getApiIdToken, getCognitoConfig, isValidAddress, isValidEmail, mapAuthError } from './auth';

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

describe('API token selection', () => {
  it('uses the Cognito ID token for the REST API user pool authorizer', () => {
    const token = getApiIdToken({
      getIdToken: () => ({ getJwtToken: () => 'verified-id-token' }),
    });
    expect(token).toBe('verified-id-token');
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

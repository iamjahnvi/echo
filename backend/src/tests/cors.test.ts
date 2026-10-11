import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CORS_HEADERS } from '../lib/cors.js';

const template = readFileSync(resolve(process.cwd(), 'template.yaml'), 'utf8');

test('API CORS permits the Vite origin, required methods and headers without authorizing OPTIONS', () => {
  assert.equal(CORS_HEADERS['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.equal(CORS_HEADERS['Access-Control-Allow-Methods'], 'GET,POST,DELETE,OPTIONS');
  assert.equal(CORS_HEADERS['Access-Control-Allow-Headers'], 'Content-Type,Authorization');
  assert.match(template, /AddDefaultAuthorizerToCorsPreflight:\s*false/);
  assert.match(template, /AllowOrigin:\s*"'http:\/\/localhost:5173'"/);
  assert.match(template, /AllowMethods:\s*"'GET,POST,DELETE,OPTIONS'"/);
  assert.match(template, /AllowHeaders:\s*"'Content-Type,Authorization'"/);
  assert.match(template, /DEFAULT_4XX:/);
  assert.match(template, /DEFAULT_5XX:/);
});

test('PhotosBucket CORS allows only the local browser PUT and Content-Type header', () => {
  assert.match(
    template,
    /CorsConfiguration:\s*\n\s*CorsRules:\s*\n\s*- AllowedOrigins:\s*\n\s*- http:\/\/localhost:5173\s*\n\s*AllowedMethods:\s*\n\s*- PUT\s*\n\s*AllowedHeaders:\s*\n\s*- Content-Type/,
  );
});

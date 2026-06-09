/**
 * did:jwk minting + private-key envelope for the portal.
 *
 * Touchless self-serve produces a fresh Ed25519 keypair for each
 * partner on Stripe checkout success.  The public side is encoded into
 * the partner's DID (which the portal registers with the broker's
 * allowlist).  The private side is wrapped under PORTAL_KEY_KEK and
 * stored in `partners.private_key_encrypted` so the partner can
 * download it ONCE via the dashboard.
 *
 * This module is server-only (node:crypto).  Route handlers wrap it.
 */
import {
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  randomBytes,
  type JsonWebKey,
} from 'node:crypto';
import type { EncryptedJwk } from '@/types';

export interface GeneratedDidJwk {
  did: string;
  publicKeyJwk: EdJwkPublic;
  privateKeyJwk: EdJwkPrivate;
}

export interface EdJwkPublic {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
}

export interface EdJwkPrivate extends EdJwkPublic {
  d: string;
}

/** Generate a fresh Ed25519 keypair + its corresponding did:jwk identifier. */
export function generateDidJwk(): GeneratedDidJwk {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubJwk = publicKey.export({ format: 'jwk' }) as JsonWebKey & EdJwkPublic;
  const privJwk = privateKey.export({ format: 'jwk' }) as JsonWebKey & EdJwkPrivate;
  // did:jwk spec: base64url(JSON(publicKeyJwk)) — no whitespace.
  const did = `did:jwk:${Buffer.from(JSON.stringify(pubJwk)).toString('base64url')}`;
  return { did, publicKeyJwk: pubJwk, privateKeyJwk: privJwk };
}

/**
 * AES-256-GCM wrap the private JWK under PORTAL_KEY_KEK.  The key is a
 * base64-encoded 32-byte value the operator sets in the env (generated
 * once via `openssl rand -base64 32`).
 */
export function encryptPrivateKey(privateKeyJwk: EdJwkPrivate): EncryptedJwk {
  const kek = decodeKek();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const plain = Buffer.from(JSON.stringify(privateKeyJwk));
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ct: enc.toString('base64url'),
  };
}

/** Inverse of `encryptPrivateKey`. */
export function decryptPrivateKey(envelope: EncryptedJwk): EdJwkPrivate {
  const kek = decodeKek();
  const iv = Buffer.from(envelope.iv, 'base64url');
  const tag = Buffer.from(envelope.tag, 'base64url');
  const ct = Buffer.from(envelope.ct, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as EdJwkPrivate;
}

function decodeKek(): Buffer {
  const raw = process.env.PORTAL_KEY_KEK;
  if (!raw) throw new Error('PORTAL_KEY_KEK is not set');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('PORTAL_KEY_KEK must decode to 32 bytes (base64 of 32 random bytes)');
  }
  return buf;
}

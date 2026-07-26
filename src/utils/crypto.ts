/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a mock cypher-looking SHA-256 style hash for visual style and cryptographic aesthetic
 */
export function generatePostHash(): string {
  const characters = 'abcdef0123456789';
  let result = 'SEC-';
  for (let i = 0; i < 24; i++) {
    if (i > 0 && i % 6 === 0) {
      result += '-';
    }
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result.toUpperCase();
}

/**
 * Retrieves or initializes a fully decentralized, untrackable, anonymous operative ID
 * kept purely on the local browser to represent their session.
 * This is never linked to an actual account and serves solely as a visual asset.
 */
export function getOperativeID(): string {
  const localKey = 'venom_anon_op_id';
  let existing = sessionStorage.getItem(localKey);
  if (!existing) {
    const prefixes = ['NEXUS', 'GHOST', 'PHANTOM', 'SPECTRE', 'COBALT', 'SHADOW', 'NEON', 'CIPHER', 'VECTOR', 'VOID'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
    existing = `${prefix}-${randomHex}`;
    sessionStorage.setItem(localKey, existing);
  }
  return existing;
}

/**
 * Generates a completely secure SHA-256 style encryption trace for any comment/reply
 */
export function generateCommentHash(): string {
  const characters = '0123456789ABCDEF';
  let result = 'SIG-';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

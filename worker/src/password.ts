import bcrypt from 'bcryptjs';

/**
 * Verifies a plaintext password against a legacy bcryptjs hash ($2a$, $2b$, $2y$).
 * Safe for both Node.js and Cloudflare Workers runtime.
 */
export async function verifyLegacyPassword(
  plainText: string,
  passwordHash: string
): Promise<boolean> {
  if (!plainText || !passwordHash) return false;
  if (typeof plainText !== 'string' || typeof passwordHash !== 'string') return false;

  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
    return false;
  }

  try {
    return await bcrypt.compare(plainText, passwordHash);
  } catch {
    return false;
  }
}

/**
 * Hashes a plaintext password using bcryptjs (cost factor 10).
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || plainText.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

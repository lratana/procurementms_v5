import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

async function verifyLegacyPassword(plainText, passwordHash) {
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

async function runTests() {
  console.log('====================================================');
  console.log(' Running Legacy Bcrypt Password Verification Tests');
  console.log('====================================================');

  // Known test hashes from sample data ($2b$ and $2a$)
  const adminHash = '$2b$10$0Z4OSjYkGjpC8HqcHI.EWetgBIzReYl3caw07xK2RH27A11Y6x95i';
  const editorHash = '$2b$10$NNx85mU4U7IdVIRIzro.tefnsjv3UQDYjONP3fyHTcVfsniLSV7N2';
  const viewerHash = '$2b$10$RhgwJtcm9jcmtGr5zyvYcead6dMRlG4zPWz/5JF4KDPFCCBhFZpQW';
  const legacy2aHash = adminHash.replace(/^\$2b\$/, '$2a$');
  const legacy2yHash = adminHash.replace(/^\$2b\$/, '$2y$');

  // 1. Valid passwords
  assert.equal(await verifyLegacyPassword('Admin@123', adminHash), true, 'Valid admin password ($2b$) should pass');
  assert.equal(await verifyLegacyPassword('Editor@123', editorHash), true, 'Valid editor password ($2b$) should pass');
  assert.equal(await verifyLegacyPassword('Viewer@123', viewerHash), true, 'Valid viewer password ($2b$) should pass');
  assert.equal(await verifyLegacyPassword('Admin@123', legacy2aHash), true, 'Valid admin password ($2a$ prefix) should pass');
  assert.equal(await verifyLegacyPassword('Admin@123', legacy2yHash), true, 'Valid admin password ($2y$ prefix) should pass');
  console.log('[PASS] 1. Valid passwords verified across $2a$, $2b$, and $2y$ prefixes.');

  // 2. Invalid passwords
  assert.equal(await verifyLegacyPassword('WrongPass@123', adminHash), false, 'Wrong password must return false');
  assert.equal(await verifyLegacyPassword('admin@123', adminHash), false, 'Case-different password must return false');
  assert.equal(await verifyLegacyPassword('Admin@123 ', adminHash), false, 'Trailing space password must return false');
  console.log('[PASS] 2. Invalid passwords rejected.');

  // 3. Malformed hashes
  assert.equal(await verifyLegacyPassword('Admin@123', 'not-a-bcrypt-hash'), false, 'Plain string hash must return false');
  assert.equal(await verifyLegacyPassword('Admin@123', '$2b$10$short'), false, 'Truncated bcrypt hash must return false');
  assert.equal(await verifyLegacyPassword('Admin@123', '$1$10$0Z4OSjYkGjpC8HqcHI.EWetgBIzReYl3caw07xK2RH27A11Y6x95i'), false, 'Unsupported $1$ prefix must return false');
  console.log('[PASS] 3. Malformed hashes rejected safely.');

  // 4. Empty / null / undefined inputs
  assert.equal(await verifyLegacyPassword('', adminHash), false, 'Empty password must return false');
  assert.equal(await verifyLegacyPassword('Admin@123', ''), false, 'Empty hash must return false');
  assert.equal(await verifyLegacyPassword('', ''), false, 'Both empty must return false');
  assert.equal(await verifyLegacyPassword(null, adminHash), false, 'Null password must return false');
  assert.equal(await verifyLegacyPassword('Admin@123', undefined), false, 'Undefined hash must return false');
  console.log('[PASS] 4. Empty, null, and undefined inputs rejected safely.');

  console.log('====================================================');
  console.log(' All password verification tests passed!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('[FAIL] Password test failed:', err);
  process.exit(1);
});

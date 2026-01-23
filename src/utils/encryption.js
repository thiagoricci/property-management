const crypto = require('crypto');

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Encrypt sensitive data (e.g., Twilio auth token)
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text (base64 encoded)
 */
function encrypt(text) {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from password and salt
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted
    const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);

    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted text (base64 encoded)
 * @returns {string} Decrypted text
 */
function decrypt(encryptedData) {
  try {
    // Decode base64
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, TAG_POSITION);
    const tag = combined.slice(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = combined.slice(ENCRYPTED_POSITION);

    // Derive key from password and salt
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Mask sensitive data for display (e.g., in UI)
 * @param {string} text - Text to mask
 * @param {number} visibleChars - Number of characters to show at start and end
 * @returns {string} Masked text
 */
function mask(text, visibleChars = 4) {
  if (!text || text.length <= visibleChars * 2) {
    return '****';
  }
  const start = text.substring(0, visibleChars);
  const end = text.substring(text.length - visibleChars);
  const middle = '*'.repeat(text.length - visibleChars * 2);
  return start + middle + end;
}

module.exports = {
  encrypt,
  decrypt,
  mask
};

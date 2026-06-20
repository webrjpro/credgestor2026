/**
 * JWT Configuration Constants and Helpers
 */

const MIN_JWT_SECRET_LENGTH = 32;

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (secret.length >= MIN_JWT_SECRET_LENGTH) {
    return secret;
  }
  throw new Error(`JWT_SECRET ausente ou menor que ${MIN_JWT_SECRET_LENGTH} caracteres`);
}

module.exports = {
  getJwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  MIN_JWT_SECRET_LENGTH,
};

/**
 * Utilitários compartilhados do backend CredGestor.
 * Centraliza funções comuns usadas por múltiplas rotas.
 */

/**
 * Gera ID único no mesmo formato do frontend.
 * Formato: timestamp decimal + 8 caracteres hex aleatórios.
 * @returns {string} ID único
 */
function generateId() {
  const ts = Date.now().toString();
  const hex = [...Array(8)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  return ts + hex;
}

/**
 * Resolve campo em camelCase OU snake_case do body de request.
 * @param {object} body - Request body
 * @param {string} camel - Nome camelCase
 * @param {string} snake - Nome snake_case
 * @param {*} fallback - Valor padrão se nenhum for encontrado
 * @returns {*} Valor resolvido
 */
function resolve(body, camel, snake, fallback) {
  if (body[camel] !== undefined) return body[camel];
  if (body[snake] !== undefined) return body[snake];
  return fallback;
}

module.exports = { generateId, resolve };

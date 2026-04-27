// ─── Server-Sent Events — gestionnaire de clients connectés ──────────────────
// Partagé entre api.js (endpoint /events) et server.js (change streams).

const sseClients = new Set();

/** Enregistre un nouveau client SSE. */
function addClient(res) {
  sseClients.add(res);
}

/** Retire un client SSE (déconnexion ou erreur). */
function removeClient(res) {
  sseClients.delete(res);
}

/**
 * Diffuse un événement SSE à tous les clients connectés.
 * @param {string} event  — nom de l'événement (ex: 'refresh', 'ping')
 * @param {object} data   — payload JSON
 */
function broadcast(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

/** Nombre de clients actuellement connectés. */
function clientCount() {
  return sseClients.size;
}

module.exports = { addClient, removeClient, broadcast, clientCount };

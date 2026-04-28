const { initScheduler, scheduleRdv } = require('../utils/rdvScheduler');
const { sendRecap }                  = require('../utils/recapManager');
const { initReducScheduler } = require('../utils/reducScheduler');
const { initSupScheduler } = require('../utils/supScheduler');
const { initByeScheduler } = require('../utils/byeScheduler');
const { restaurerSessions } = require('../commands/carte');
const { updateGuide } = require('../utils/guideManager');
const { updateSacDashboard } = require('../utils/sacManager');
const { updateDashboard: updateAttenteDashboard } = require('../utils/attenteManager');
const { getDB } = require('../utils/db');
const agentCache = require('../utils/agentCache');
const bienCache  = require('../utils/bienCache');
const { BIENS }  = require('../utils/annonceBuilder');

/**
 * Ouvre un change stream MongoDB avec reconnexion automatique en cas d'erreur.
 * @param {Function} getCollection  — () => db.collection('...')
 * @param {Array}    pipeline       — pipeline de filtrage
 * @param {object}   options        — options watch()
 * @param {Function} onChange       — handler appelé à chaque événement
 * @param {string}   label          — préfixe de log
 * @param {number}   [retryMs=5000] — délai avant reconnexion
 */
function watchWithReconnect(getCollection, pipeline, options, onChange, label, retryMs = 5000) {
  const open = () => {
    try {
      const stream = getCollection().watch(pipeline, options);
      stream.on('change', onChange);
      stream.on('error', err => {
        console.error(`[${label}] ⚠️ Erreur change stream : ${err.message} — reconnexion dans ${retryMs / 1000}s`);
        stream.close().catch(() => {});
        setTimeout(open, retryMs);
      });
    } catch (err) {
      console.error(`[${label}] Impossible d'ouvrir le change stream : ${err.message} — retry dans ${retryMs / 1000}s`);
      setTimeout(open, retryMs);
    }
  };
  open();
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`
╔═══════════════════════════════════════╗
║   🏠  DYNASTY 8 - BOT EN LIGNE  🏠   ║
║   Connecté en tant que ${client.user.tag.padEnd(15)}║
╚═══════════════════════════════════════╝
    `);
    const activites = [
      { name: 'Votre bien est en cours de recherche',       type: 3 }, // Watching
      { name: 'Regarde des villas hors budget',             type: 3 }, // Watching
      { name: 'Cherche un acheteur sérieux',                type: 2 }, // Listening
      { name: 'Compte les zéros sur les chèques',           type: 3 }, // Watching
      { name: 'En visite avec un client',                   type: 1 }, // Playing
      { name: 'Sélection d’opportunités en cours',          type: 3 }, // Watching
    ];

    let index = 0;
    client.user.setActivity(activites[0].name, { type: activites[0].type });
    setInterval(() => {
      index = (index + 1) % activites.length;
      client.user.setActivity(activites[index].name, { type: activites[index].type });
    }, 50_000); // change toutes les 15 secondes
    // ── Init cache des types de biens ─────────────────────────────────────────
    bienCache.init(getDB(), BIENS).catch(err =>
      console.error('[BienCache] Erreur init :', err.message),
    );

    // ── Change stream : sync cache biens depuis le panel ─────────────────────
    watchWithReconnect(
      () => getDB().collection('bien_types'),
      [], { fullDocument: 'updateLookup' },
      async () => {
        try {
          await bienCache.refresh(getDB());
          console.log('[BienCache] 🔄 Cache rechargé suite à une modification web');
        } catch (err) {
          console.error('[BienCache] Erreur refresh :', err.message);
        }
      },
      'BienCache',
    );
    console.log('[BienCache] Change stream actif — cache synchronisé automatiquement');

    restaurerSessions(client).catch(console.error);
    updateGuide(client).catch(console.error);
    initScheduler(client).catch(err     => console.error('[RDV]   Erreur init scheduler :', err.message));
    initReducScheduler(client).catch(err => console.error('[REDUC] Erreur init scheduler :', err.message));
    initSupScheduler(client).catch(err   => console.error('[SUP]   Erreur init scheduler :', err.message));
    initByeScheduler(client).catch(err   => console.error('[BYE]   Erreur init scheduler :', err.message));

    // ── Change stream : mise à jour auto du dashboard sacs ────────────────────
    watchWithReconnect(
      () => getDB().collection('sac_registry'),
      [], { fullDocument: 'updateLookup' },
      () => updateSacDashboard(client).catch(err =>
        console.error('[SAC] Erreur mise à jour dashboard :', err.message),
      ),
      'SAC',
    );
    console.log('[SAC] Change stream actif — dashboard se met à jour automatiquement');

    // ── Change stream : mise à jour auto du dashboard liste d'attente ─────────
    watchWithReconnect(
      () => getDB().collection('waiting_list'),
      [], { fullDocument: 'updateLookup' },
      () => updateAttenteDashboard(client).catch(err =>
        console.error('[ATTENTE] Erreur mise à jour dashboard :', err.message),
      ),
      'ATTENTE',
    );
    console.log('[ATTENTE] Change stream actif — dashboard se met à jour automatiquement');

    // ── Change stream : auto-planification des RDV créés depuis le panel ─────────
    watchWithReconnect(
      () => getDB().collection('rendez_vous'),
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'updateLookup' },
      change => {
        const rdv = change.fullDocument;
        if (rdv && rdv.statut === 'prévu') {
          scheduleRdv(client, rdv);
          console.log(`[RDV] 🆕 Nouveau RDV planifié depuis le panel : ${rdv.id}`);
        }
      },
      'RDV',
    );
    console.log('[RDV] Change stream actif — nouveaux RDV planifiés automatiquement');

    // ── Change stream : envoi des récaps hebdomadaires ────────────────────────
    // Récaps en attente au démarrage (bot était offline lors de la publication)
    try {
      const pendingRecaps = await getDB().collection('recap_hebdo')
        .find({ statut: 'a_publier' }).toArray();
      for (const recap of pendingRecaps) sendRecap(client, recap);
      if (pendingRecaps.length)
        console.log(`[RECAP] 🔄 ${pendingRecaps.length} récap(s) en attente traité(s) au démarrage`);
    } catch (err) {
      console.error('[RECAP] Erreur chargement récaps en attente :', err.message);
    }

    watchWithReconnect(
      () => getDB().collection('recap_hebdo'),
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'updateLookup' },
      change => {
        const recap = change.fullDocument;
        if (recap?.statut === 'a_publier') {
          sendRecap(client, recap);
          console.log(`[RECAP] 📤 Récap reçu depuis le panel : ${recap.id}`);
        }
      },
      'RECAP',
    );
    console.log('[RECAP] Change stream actif — récaps publiés automatiquement');

    // ── Change stream : sync du cache agents depuis le panel web ─────────────────
    watchWithReconnect(
      () => getDB().collection('agents'),
      [], { fullDocument: 'updateLookup' },
      async () => {
        try {
          await agentCache.refresh(getDB());
          console.log('[AgentCache] 🔄 Cache rechargé suite à une modification web');
        } catch (err) {
          console.error('[AgentCache] Erreur refresh après change stream :', err.message);
        }
      },
      'AgentCache',
    );
    console.log('[AgentCache] Change stream actif — cache synchronisé automatiquement');
  },
};

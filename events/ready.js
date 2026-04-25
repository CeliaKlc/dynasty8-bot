const { initScheduler, scheduleRdv } = require('../utils/rdvScheduler');
const { sendRecap }                  = require('../utils/recapManager');
const { initReducScheduler } = require('../utils/reducScheduler');
const { initSupScheduler } = require('../utils/supScheduler');
const { initByeScheduler } = require('../utils/byeScheduler');
const { restaurerSessions } = require('../commands/carte');
const { updateGuide } = require('../utils/guideManager');
const { updateSacDashboard } = require('../utils/sacManager');
const { getDB } = require('../utils/db');

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
    restaurerSessions(client).catch(console.error);
    updateGuide(client).catch(console.error);
    initScheduler(client);
    initReducScheduler(client);
    initSupScheduler(client);
    initByeScheduler(client);

    // ── Change stream : mise à jour auto du dashboard sacs ────────────────────
    // Déclenché dès qu'une modification arrive sur sac_registry (y compris depuis le panel web)
    try {
      const changeStream = getDB().collection('sac_registry').watch([], { fullDocument: 'updateLookup' });
      changeStream.on('change', () => {
        updateSacDashboard(client).catch(err =>
          console.error('[SAC] Erreur mise à jour dashboard :', err.message),
        );
      });
      console.log('[SAC] Change stream actif — dashboard se met à jour automatiquement');
    } catch (err) {
      console.error('[SAC] Impossible d\'activer le change stream :', err.message);
    }

    // ── Change stream : auto-planification des RDV créés depuis le panel ─────────
    try {
      const rdvStream = getDB().collection('rendez_vous').watch(
        [{ $match: { operationType: 'insert' } }],
        { fullDocument: 'updateLookup' },
      );
      rdvStream.on('change', change => {
        const rdv = change.fullDocument;
        if (rdv && rdv.statut === 'prévu') {
          scheduleRdv(client, rdv);
          console.log(`[RDV] 🆕 Nouveau RDV planifié depuis le panel : ${rdv.id}`);
        }
      });
      console.log('[RDV] Change stream actif — nouveaux RDV planifiés automatiquement');
    } catch (err) {
      console.error('[RDV] Impossible d\'activer le change stream RDV :', err.message);
    }

    // ── Change stream : envoi des récaps hebdomadaires ────────────────────────
    try {
      // Récaps en attente au démarrage (bot était offline lors de la publication)
      const pendingRecaps = await getDB().collection('recap_hebdo')
        .find({ statut: 'a_publier' }).toArray();
      for (const recap of pendingRecaps) sendRecap(client, recap);
      if (pendingRecaps.length)
        console.log(`[RECAP] 🔄 ${pendingRecaps.length} récap(s) en attente traité(s) au démarrage`);

      // Filtre uniquement sur operationType pour éviter les quirks du fullDocument dans les pipelines
      const recapStream = getDB().collection('recap_hebdo').watch(
        [{ $match: { operationType: 'insert' } }],
        { fullDocument: 'updateLookup' },
      );
      recapStream.on('change', change => {
        const recap = change.fullDocument;
        if (recap?.statut === 'a_publier') {
          sendRecap(client, recap);
          console.log(`[RECAP] 📤 Récap reçu depuis le panel : ${recap.id}`);
        }
      });
      recapStream.on('error', err =>
        console.error('[RECAP] Erreur change stream :', err.message),
      );
      console.log('[RECAP] Change stream actif — récaps publiés automatiquement');
    } catch (err) {
      console.error('[RECAP] Impossible d\'activer le change stream :', err.message);
      // Fallback : polling toutes les 10 secondes si le change stream n'est pas disponible
      console.warn('[RECAP] ⚠️  Fallback polling actif (10s)');
      setInterval(async () => {
        try {
          const pending = await getDB().collection('recap_hebdo')
            .find({ statut: 'a_publier' }).toArray();
          for (const recap of pending) sendRecap(client, recap);
        } catch (e) { /* silencieux */ }
      }, 10_000);
    }
  },
};

const { EmbedBuilder } = require('discord.js');
const { getDB } = require('./db');

const GUIDE_CHANNEL_ID  = '1333481740907446293';
const GUIDE_MESSAGE_KEY = 'guide_message';

// ─── Construction des embeds ──────────────────────────────────────────────────

function buildGuideEmbeds() {
  // ── Embed 1 : Annonces & LBC ────────────────────────────────────────────────
  const embedAnnonces = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📢 Annonces & LBC')
    .addFields(
      {
        name:  '`/annonce`',
        value: 'Publie une annonce immobilière et ouvre automatiquement un ticket client.\n'
             + '> Options : numéro · type de bien · transaction · quartier · image · agent · garages · salle à sac · terrasse · balcon…',
      },
      {
        name:  '`/editannonce`',
        value: 'Modifie une annonce déjà publiée en renseignant son ID de message.\n'
             + '> Options modifiables : agent · type · transaction · quartier · image · garages · extras…',
      },
      {
        name:  '`/recaplbc`',
        value: 'Crée le récapitulatif LBC d\'un bien (description formatée avec prix, surface, zone, etc.).\n'
             + '> Les prix sont automatiquement formatés avec séparateurs (ex : 1\'600\'000).',
      },
      {
        name:  '`/editrecaplbc`',
        value: 'Modifie un récapitulatif LBC existant à partir de l\'ID du message.',
      },
      {
        name:  '`/reduc`',
        value: 'Annonce une réduction de prix sur un bien dans le ticket actuel.\n'
             + '> Le message se supprime automatiquement après la durée choisie (6h · 12h · 24h · 48h · 72h · 7j).',
      },
    );

  // ── Embed 2 : Gestion des tickets ───────────────────────────────────────────
  const embedTickets = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🗂️ Gestion des tickets')
    .addFields(
      {
        name:  '`/rename`',
        value: 'Renomme le ticket actuel avec l\'agent, le statut, le numéro et une description.\n'
             + '> Statuts disponibles : ⌛ En attente · ✅ Vendu · ❓ Ne sais pas · ❌ Fin de contrat',
      },
      {
        name:  '`/adduser @membre`',
        value: 'Ajoute un membre dans le ticket actuel (accès en lecture et écriture).',
      },
      {
        name:  '`/bye @client`',
        value: 'Envoie le message de clôture du ticket et invite le client à laisser un avis.\n'
             + '> Le salon est renommé automatiquement avec ✅ et le ticket se ferme après 24h sans activité.',
      },
      {
        name:  '`/sup @client`',
        value: 'Avertit le client que le ticket sera **fermé automatiquement dans 24h** sans réponse de sa part.',
      },
    );

  // ── Embed 3 : Rendez-vous ───────────────────────────────────────────────────
  const embedRdv = new EmbedBuilder()
    .setColor(0x27AE60)
    .setTitle('📅 Rendez-vous')
    .addFields(
      {
        name:  '`/rdv créer @client date heure`',
        value: 'Planifie un rendez-vous avec un rappel automatique dans le ticket.\n'
             + '> Options : description · lieu · rappel (15 min / 30 min / 1h / à l\'heure pile)\n'
             + '> Date : `aujourd\'hui` · `demain` · `31/12/2026`  —  Heure : `18h30` ou `18:30`\n'
             + '> Le salon est automatiquement renommé avec ⏰.',
      },
      {
        name:  '`/rdv liste`',
        value: 'Affiche tous les rendez-vous à venir.\n'
             + '> Option `agent` pour filtrer et n\'afficher que les RDV d\'un agent spécifique.',
      },
      {
        name:  '`/rdv annuler`',
        value: 'Annule un rendez-vous planifié et supprime les rappels associés.',
      },
    );

  // ── Embed 4 : Clients ───────────────────────────────────────────────────────
  const embedClients = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('📋 Clients')
    .addFields(
      {
        name:  '`/attente`',
        value: 'Enregistre un client en liste d\'attente avec ses critères (type de bien · secteur · budget).\n'
             + '> Le dashboard liste d\'attente est mis à jour automatiquement.',
      },
    );

  // ── Embed 5 : Carte agent ───────────────────────────────────────────────────
  const embedCarte = new EmbedBuilder()
    .setColor(0x117D33)
    .setTitle('🪪 Carte d\'agent')
    .addFields(
      {
        name:  '`/carte`',
        value: 'Affiche ta carte d\'agent dans le salon actuel pour indiquer que tu es en service.\n'
             + '> Option `timer` : suppression automatique après 30 min / 1h / 2h / 3h / 4h / 6h / 8h\n'
             + '> Sans timer : un rappel est envoyé dans ton bunker après 3h pour confirmer ta présence.',
      },
    );

  return [embedAnnonces, embedTickets, embedRdv, embedClients, embedCarte];
}

// ─── Publication / mise à jour du guide ──────────────────────────────────────

async function updateGuide(client) {
  const db      = getDB();
  const channel = await client.channels.fetch(GUIDE_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error('[GUIDE] Salon introuvable :', GUIDE_CHANNEL_ID);
    return;
  }

  const embeds = buildGuideEmbeds();

  const config = await db.collection('bot_config').findOne({ key: GUIDE_MESSAGE_KEY });
  if (config?.messageId) {
    try {
      const msg = await channel.messages.fetch(config.messageId);
      await msg.edit({ embeds });
      return;
    } catch {
      // Message supprimé → on en crée un nouveau
    }
  }

  const msg = await channel.send({ embeds });
  await db.collection('bot_config').updateOne(
    { key: GUIDE_MESSAGE_KEY },
    { $set: { key: GUIDE_MESSAGE_KEY, channelId: GUIDE_CHANNEL_ID, messageId: msg.id } },
    { upsert: true },
  );

  console.log('[GUIDE] Message de guide publié :', msg.id);
}

module.exports = { updateGuide };

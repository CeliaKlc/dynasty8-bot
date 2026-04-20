const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDB } = require('./db');

const DASHBOARD_CHANNEL_ID = '1331351041916272682';

// ─── Catégories du dashboard ──────────────────────────────────────────────────
// key     = valeur du customId du bouton (attente_voir_<key>)
// label   = affiché dans l'embed et sur le bouton
// emoji   = affiché dans l'embed
// types[] = types MongoDB correspondants

const DASHBOARD_CATEGORIES = [
  // ── Villas & Maisons ──────────────────────────────────────────────────────
  { key: 'Villa',           label: 'Villa',                      emoji: '🏡', types: ['Villa'] },
  { key: 'Luxe',            label: 'Villa / Maison de Luxe',     emoji: '🏡', types: ['Villa de Luxe', 'Maison de Luxe'] },
  { key: 'Maison Simple',   label: 'Maison Simple',              emoji: '🏠', types: ['Maison Simple'] },
  // ── Appartements ──────────────────────────────────────────────────────────
  { key: 'Appartement',     label: 'Appartement Simple/Basique', emoji: '🏢', types: ['Appartement Simple', 'Appartement Basique'] },
  { key: 'Favelas',         label: 'Favelas',                    emoji: '🏚️', types: ['Appartement Favelas', 'Maison Favelas'] },
  { key: 'Studio de Luxe',  label: 'Studio de Luxe',             emoji: '🏢', types: ['Studio de Luxe'] },
  { key: 'Appt Moderne',    label: 'Appartement Moderne',        emoji: '🏢', types: ['Appartement Moderne'] },
  { key: 'Duplex',          label: 'Duplex',                     emoji: '🏘️', types: ['Duplex'] },
  { key: 'Appt Luxe',       label: 'Appart. de Luxe Modifiable', emoji: '🏢', types: ['Appartement de Luxe Modifiable'] },
  { key: 'Caravane',        label: 'Caravane',                   emoji: '🚐', types: ['Caravane'] },
  // ── Pro / Divers ──────────────────────────────────────────────────────────
  { key: 'Bureau',          label: 'Bureau / Agence',            emoji: '🏛️', types: ['Bureau', 'Agence'] },
  { key: 'Loft Garage',     label: 'Loft Garage',                emoji: '🏗️', types: ['Loft Garage'] },
  { key: 'Entrepot',        label: 'Hangar / Entrepôt',          emoji: '🏗️', types: ['Hangar', 'Entrepôt'] },
  // ── Garages ───────────────────────────────────────────────────────────────
  { key: 'Garage',          label: 'Garage',                     emoji: '🚗', types: ['Garage 2 places', 'Garage 6 places', 'Garage 10 places', 'Garage 26 places'] },
];

// TYPE_EMOJIS : pour chaque type spécifique, renvoie l'emoji de sa catégorie
const TYPE_EMOJIS = Object.fromEntries(
  DASHBOARD_CATEGORIES.flatMap(cat => cat.types.map(t => [t, cat.emoji]))
);

const STATUT_EMOJI = {
  active:   '🟢',
  contacté: '🟡',
  terminé:  '🔴',
};

// ─── Persistance de l'ID du message dashboard ────────────────────────────────

async function getDashboardMessageId() {
  const db = getDB();
  const doc = await db.collection('bot_config').findOne({ key: 'dashboard_attente_message_id' });
  return doc?.value ?? null;
}

async function setDashboardMessageId(messageId) {
  const db = getDB();
  await db.collection('bot_config').updateOne(
    { key: 'dashboard_attente_message_id' },
    { $set: { value: messageId } },
    { upsert: true },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Découpe un tableau en sous-tableaux de taille n
function chunk(arr, n) {
  const result = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

// ─── Construction de l'embed + boutons dashboard ─────────────────────────────

async function buildDashboard(db) {
  const embed = new EmbedBuilder()
    .setTitle('📋 Liste d\'attente — Dynasty 8')
    .setColor(0x2F3136)
    .setTimestamp()
    .setFooter({ text: 'Dernière mise à jour' });

  const allButtons = [];

  for (const cat of DASHBOARD_CATEGORIES) {
    const clients = await db.collection('waiting_list')
      .find({ 'biens.type': { $in: cat.types }, status: 'active' })
      .toArray();

    const count = clients.length;

    const value = count === 0
      ? '> *Aucun client en attente*'
      : `> **${count} client(s) en attente**`;

    embed.addFields({ name: `${cat.emoji} ${cat.label}`, value, inline: true });

    allButtons.push(
      new ButtonBuilder()
        .setCustomId(`attente_voir_${cat.key}`)
        .setLabel(`${cat.emoji} ${cat.label}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(count === 0),
    );
  }

  // Découpe les boutons en ActionRows de 5 max (limite Discord)
  const rows = chunk(allButtons, 5).map(btns =>
    new ActionRowBuilder().addComponents(btns)
  );

  return { embed, rows };
}

// ─── Mise à jour du dashboard ─────────────────────────────────────────────────

async function updateDashboard(discordClient) {
  try {
    const db      = getDB();
    const channel = await discordClient.channels.fetch(DASHBOARD_CHANNEL_ID);
    if (!channel) return console.error('[ATTENTE] Salon dashboard introuvable.');

    const { embed, rows } = await buildDashboard(db);
    const existingId      = await getDashboardMessageId();

    if (existingId) {
      try {
        const msg = await channel.messages.fetch(existingId);
        await msg.edit({ embeds: [embed], components: rows });
        return;
      } catch {
        // Message supprimé → on en recrée un
      }
    }

    const msg = await channel.send({ embeds: [embed], components: rows });
    await setDashboardMessageId(msg.id);
  } catch (err) {
    console.error('[ATTENTE] Erreur mise à jour dashboard :', err);
  }
}

// ─── Liste détaillée par catégorie (réponse éphémère bouton dashboard) ────────

async function buildListeDetaillee(db, catKey) {
  const cat = DASHBOARD_CATEGORIES.find(c => c.key === catKey);
  if (!cat) return null;

  const clients = await db.collection('waiting_list')
    .find({ 'biens.type': { $in: cat.types }, status: { $ne: 'terminé' } })
    .sort({ createdAt: 1 })
    .toArray();

  if (clients.length === 0) return null;

  const lines = clients.map((c, i) => {
    const date   = c.createdAt.toLocaleDateString('fr-FR');
    const budget = `max ${c.budget.max.toLocaleString('fr-FR')} $`;
    const statut = STATUT_EMOJI[c.status] ?? '⚪';
    const ticket = c.ticketId ? ` • 🎫 <#${c.ticketId}>` : '';
    const notes  = c.notes ? `\n> 📝 ${c.notes}` : '';

    // Biens de cette catégorie
    const biensRelevants = (c.biens ?? []).filter(b => cat.types.includes(b.type));

    // Si ce n'est pas la catégorie Garage, on ajoute les garages du client en complément
    const garageTypes = DASHBOARD_CATEGORIES.find(d => d.key === 'Garage')?.types ?? [];
    const garages     = cat.key !== 'Garage'
      ? (c.biens ?? []).filter(b => garageTypes.includes(b.type))
      : [];

    const biensStr = [...biensRelevants, ...garages]
      .map(b => `${TYPE_EMOJIS[b.type] ?? '🏠'} **${b.type}** — 📍 ${b.zone}`)
      .join('\n> ');

    return `**${i + 1}.** ${statut} <@${c.clientId}>${ticket}\n> ${biensStr}\n> 💰 ${budget} • 📅 ${date}${notes}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${cat.emoji} Liste d'attente — ${cat.label}`)
    .setColor(0x3498DB)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${clients.length} client(s) • Trié par ancienneté` })
    .setTimestamp();

  return embed;
}

module.exports = {
  updateDashboard,
  buildListeDetaillee,
  TYPE_EMOJIS,
  STATUT_EMOJI,
  DASHBOARD_CATEGORIES,
};

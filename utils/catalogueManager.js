// ─── Catalogue Dynasty 8 — Propriétés & Garages ──────────────────────────────
// Gère la publication et la mise à jour automatique des fiches catalogue
// dans les salons Discord, ainsi que les boutons clients (intérêt / liste d'attente).

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { getDB }      = require('./db');
const { formatPrix } = require('./formatters');
const { ObjectId }   = require('mongodb');

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIE_TICKETS_ID = '993616675670851659';

const ROLES_ACCES_TICKETS = [
  '917744433682849802',   // Employé
  '1375930527873368066',  // Direction
  '1045639426170167358',  // Gestionnaire-LBC
  '1373792350991683687',  // Responsable-LBC
];

// ─── Formatage des prix ───────────────────────────────────────────────────────

function fmt(n) {
  if (!n && n !== 0) return null;
  return `${formatPrix(String(Math.round(n)))}$`;
}

function buildPrixLabel(fiche) {
  if (fiche.prixMin && fiche.prixMax) {
    return `Entre **${fmt(fiche.prixMin)}** et **${fmt(fiche.prixMax)}**`;
  }
  if (fiche.prixMin) return `À partir de **${fmt(fiche.prixMin)}**`;
  return null;
}

// ─── Construction du payload Discord d'une fiche ─────────────────────────────
// L'image est postée comme pièce jointe (pleine largeur, sans encadré d'embed).
// Seuls le texte de statut et le bouton sont gérés ici — les prix ne s'affichent
// pas car ils figurent déjà sur les visuels Dynasty 8.

const STATUS_TEXT = {
  disponible:    '-# Disponible — Ce type de bien est actuellement en stock.',
  liste_attente: '-# Liste d\'attente — Ce type de bien est momentanément indisponible.\n> -# Inscrivez-vous pour être contacté en priorité dès qu\'un bien se libère.',
  indisponible:  '-# Indisponible — Ce type de bien n\'est pas proposé pour le moment.',
};

/**
 * Payload pour la mise à jour du statut uniquement (pas de fichier joint —
 * l'image attachée au message d'origine est conservée par Discord lors de l'édition).
 */
function buildFicheStatusPayload(fiche) {
  const content    = STATUS_TEXT[fiche.statut] ?? '';
  const components = [];
  const ficheId    = fiche._id.toString();

  if (fiche.statut === 'disponible') {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`catalogue_interesse_${ficheId}`)
          .setLabel('🏠 Je suis intéressé(e)')
          .setStyle(ButtonStyle.Success),
      ),
    );
  } else if (fiche.statut === 'liste_attente') {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`catalogue_attente_${ficheId}`)
          .setLabel('📋 Me mettre en liste d\'attente')
          .setStyle(ButtonStyle.Primary),
      ),
    );
  }

  return { content, components };
}

// ─── Publier / mettre à jour une fiche ───────────────────────────────────────

async function updateFiche(client, fiche) {
  const db = getDB();

  // Normaliser l'ID de catégorie
  const categorieId = fiche.categorieId instanceof ObjectId
    ? fiche.categorieId
    : new ObjectId(String(fiche.categorieId));

  const categorie = await db.collection('catalogue_categories').findOne({ _id: categorieId });
  if (!categorie?.channelId) return;

  const channel = await client.channels.fetch(categorie.channelId).catch(() => null);
  if (!channel) {
    console.warn(`[CATALOGUE] Salon introuvable : ${categorie.channelId}`);
    return;
  }

  const statusPayload = buildFicheStatusPayload(fiche);

  if (fiche.messageId) {
    try {
      const msg = await channel.messages.fetch(fiche.messageId);
      // Édition du statut uniquement — le message image reste intact au-dessus.
      await msg.edit(statusPayload);
      console.log(`[CATALOGUE] ✏️  Fiche mise à jour : ${fiche.nom}`);
      return;
    } catch {
      // Message de statut supprimé → repost des deux messages
    }
  }

  // Premier envoi (ou repost) :
  //   1. Message image seul  → pleine largeur, sans texte
  //   2. Message statut+bouton → juste en dessous de l'image
  await channel.send({ files: [fiche.imageUrl] });
  const statusMsg = await channel.send(statusPayload);

  await db.collection('catalogue_fiches').updateOne(
    { _id: fiche._id },
    { $set: { messageId: statusMsg.id } },
  );
  console.log(`[CATALOGUE] 📤 Fiche publiée : ${fiche.nom}`);
}

// ─── Publier / mettre à jour l'intro d'une catégorie ─────────────────────────

async function updateCategorie(client, categorie) {
  if (!categorie?.channelId || !categorie.intro) return;

  const db      = getDB();
  const channel = await client.channels.fetch(categorie.channelId).catch(() => null);
  if (!channel) {
    console.warn(`[CATALOGUE] Salon intro introuvable : ${categorie.channelId}`);
    return;
  }

  const payload = { content: categorie.intro };

  if (categorie.messageId) {
    try {
      const msg = await channel.messages.fetch(categorie.messageId);
      await msg.edit(payload);
      return;
    } catch {
      // Message supprimé → repost
    }
  }

  const msg = await channel.send(payload);
  await db.collection('catalogue_categories').updateOne(
    { _id: categorie._id },
    { $set: { messageId: msg.id } },
  );
}

// ─── Republier tout le catalogue (utile si les salons sont nettoyés) ─────────

async function publishCatalogue(client) {
  const db = getDB();
  const categories = await db.collection('catalogue_categories')
    .find({}).sort({ ordre: 1 }).toArray();

  for (const categorie of categories) {
    if (!categorie.channelId) continue;
    await updateCategorie(client, categorie);
    const fiches = await db.collection('catalogue_fiches')
      .find({ categorieId: categorie._id }).sort({ ordre: 1 }).toArray();
    for (const fiche of fiches) {
      await updateFiche(client, fiche);
    }
  }
  console.log('[CATALOGUE] ✅ Catalogue publié/mis à jour');
}

// ─── Handler boutons clients ──────────────────────────────────────────────────

async function handleCatalogueButton(interaction) {
  const { customId, member, guild, client } = interaction;
  const db = getDB();

  const isAttente = customId.startsWith('catalogue_attente_');
  const ficheId   = customId
    .replace('catalogue_interesse_', '')
    .replace('catalogue_attente_', '');

  let ficheObjId;
  try { ficheObjId = new ObjectId(ficheId); } catch {
    return interaction.reply({ content: '❌ Fiche invalide.', ephemeral: true });
  }

  const fiche = await db.collection('catalogue_fiches').findOne({ _id: ficheObjId });
  if (!fiche) {
    return interaction.reply({ content: '❌ Cette fiche n\'existe plus.', ephemeral: true });
  }

  const categorie = await db.collection('catalogue_categories')
    .findOne({ _id: fiche.categorieId });

  await interaction.deferReply({ ephemeral: true });

  // Nom du ticket (Discord : 1–100 chars, [a-z0-9-_])
  const safeName = fiche.nom
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 28);
  const nomTicket = `⌛┃${safeName}`;

  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny:  [PermissionFlagsBits.ViewChannel] },
    {
      id:    member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id:    client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
    },
    ...ROLES_ACCES_TICKETS.map(roleId => ({
      id:    roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
    })),
  ];

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name:   nomTicket,
      type:   ChannelType.GuildText,
      parent: CATEGORIE_TICKETS_ID,
      permissionOverwrites,
    });
  } catch (err) {
    console.error('[CATALOGUE] ❌ Erreur création ticket :', err.message);
    return interaction.editReply({ content: '❌ Impossible de créer le ticket. Contacte un agent directement.' });
  }

  const prixLabel = buildPrixLabel(fiche);

  const embed = new EmbedBuilder()
    .setColor(isAttente ? 0xE67E22 : 0x2ECC71)
    .setTitle(isAttente ? '📋 Inscription liste d\'attente' : '🏠 Demande d\'information')
    .setDescription(
      `${member} est ${isAttente ? 'inscrit(e) en liste d\'attente pour' : 'intéressé(e) par'} : **${fiche.nom}**` +
      (categorie ? ` *(${categorie.label})*` : '') +
      (prixLabel ? `\n💰 ${prixLabel}` : '') +
      `\n\nUn agent va prendre en charge votre demande dans les plus brefs délais. 🏡`,
    )
    .setThumbnail(fiche.imageUrl)
    .setTimestamp();

  await ticketChannel.send({ content: `${member}`, embeds: [embed] });

  await interaction.editReply({
    content: `✅ Votre demande a bien été reçue ! Retrouvez votre ticket ici : ${ticketChannel}`,
  });
}

module.exports = { publishCatalogue, updateFiche, updateCategorie, handleCatalogueButton };

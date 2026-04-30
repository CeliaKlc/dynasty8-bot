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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getDB }      = require('./db');
const { formatPrix } = require('./formatters');
const { ObjectId }   = require('mongodb');

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIE_TICKETS_ID        = '915918793870557184';  // Tickets "Je suis intéressé(e)"
const CATEGORIE_TICKETS_ATTENTE_ID = '1455359090090840287'; // Tickets "Liste d'attente"


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
  disponible:    '*Disponible — Ce type de bien est actuellement en stock.*',
  liste_attente: '*Liste d\'attente — Ce type de bien est momentanément indisponible.\nInscrivez-vous pour être contacté en priorité dès qu\'un bien se libère.*',
  indisponible:  '*Indisponible — Ce type de bien n\'est pas proposé pour le moment.*',
};

/**
 * Payload texte + bouton pour l'envoi ou la mise à jour d'une fiche.
 * Lors de l'édition, Discord conserve automatiquement la pièce jointe d'origine.
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

      // Comparer contenu et bouton : si rien n'a changé, ne pas éditer
      // (évite le "(modifié)" parasite au redémarrage du bot)
      const sameContent  = msg.content === (statusPayload.content ?? '');
      const currentBtnId = msg.components?.[0]?.components?.[0]?.customId ?? null;
      const newBtnId     = statusPayload.components?.[0]?.components?.[0]?.data?.custom_id ?? null;
      if (sameContent && currentBtnId === newBtnId) {
        return; // Rien n'a changé, on skip l'édition
      }

      // Édition du texte/bouton uniquement — la pièce jointe image est conservée par Discord.
      await msg.edit(statusPayload);
      console.log(`[CATALOGUE] ✏️  Fiche mise à jour : ${fiche.nom}`);
      return;
    } catch {
      // Message supprimé → repost
    }
  }

  // Premier envoi (ou repost) : un seul message — texte en haut, image en dessous.
  const msg = await channel.send({ ...statusPayload, files: [fiche.imageUrl] });

  await db.collection('catalogue_fiches').updateOne(
    { _id: fiche._id },
    { $set: { messageId: msg.id } },
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

// ─── Détection des fiches "professionnelles" (Hangar / Entrepôt) ─────────────

function isProFiche(fiche) {
  const nom = fiche.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return nom.includes('hangar') || nom.includes('entrepot');
}

// ─── Handler boutons clients ──────────────────────────────────────────────────

// ─── Utilitaire partagé : création du salon ticket ────────────────────────────

function buildPermissionOverwrites(guild, client, member) {
  return [
    { id: guild.roles.everyone.id, deny:  [PermissionFlagsBits.ViewChannel] },
    { id: member.id,               allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: client.user.id,          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ...ROLES_ACCES_TICKETS.map(roleId => ({
      id:    roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
    })),
  ];
}

function buildNomTicket(nom) {
  const safe = nom
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 28);
  return `⌛┃${safe}`;
}

const fermerRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('ticket_fermer')
    .setLabel('🔒 Fermer le ticket')
    .setStyle(ButtonStyle.Danger),
);

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
  if (!fiche) return interaction.reply({ content: '❌ Cette fiche n\'existe plus.', ephemeral: true });

  const categorie = await db.collection('catalogue_categories').findOne({ _id: fiche.categorieId });

  // ── "Je suis intéressé(e)" → ouvrir le formulaire modal ──────────────────
  if (!isAttente) {
    const titre = fiche.nom.length > 45 ? fiche.nom.slice(0, 42) + '...' : fiche.nom;
    const isPro = isProFiche(fiche);
    const modal = new ModalBuilder()
      .setCustomId(`catalogue_interesse_modal_${ficheId}`)
      .setTitle(titre);

    if (isPro) {
      // Hangar / Entrepôt : formulaire professionnel (5 champs)
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('entreprise')
            .setLabel('Entreprise')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Nom de votre entreprise'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('grade')
            .setLabel('Grade de la personne')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex : PDG, Directeur, Associé...'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('quartier')
            .setLabel('Quartier souhaité')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex : Zone industrielle, Port...'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('budget')
            .setLabel('Budget')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex : 1 000 000 $'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('disponibilites')
            .setLabel('Vos disponibilités')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Le terme "maintenant" ne constitue pas une disponibilité'),
        ),
      );
    } else {
      // Standard : quartier, budget, disponibilités, commentaire
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('quartier')
            .setLabel('Quartier souhaité')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex : Vinewood, Rockford Hills...'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('budget')
            .setLabel('Budget')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex : 500 000 $'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('disponibilites')
            .setLabel('Vos disponibilités')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Le terme "maintenant" ne constitue pas une disponibilité'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('commentaire')
            .setLabel('Commentaire')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Optionnel — précisions, critères...'),
        ),
      );
    }
    return interaction.showModal(modal);
  }

  // ── "Liste d'attente" → ouvrir le formulaire modal ───────────────────────
  const titreAttente = fiche.nom.length > 45 ? fiche.nom.slice(0, 42) + '...' : fiche.nom;
  const modalAttente = new ModalBuilder()
    .setCustomId(`catalogue_attente_modal_${ficheId}`)
    .setTitle(titreAttente)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('secteur')
          .setLabel('Secteur(s) souhaité(s)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex : Vinewood, Rockford Hills...'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('budget')
          .setLabel('Budget maximum')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex : 500 000 $'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('identite')
          .setLabel('Identité (prénom, nom)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex : Sacha Rollay'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('telephone')
          .setLabel('Téléphone')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex : 502562'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('Notes / précisions')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Optionnel — critères spécifiques, préférences...'),
      ),
    );
  return interaction.showModal(modalAttente);
}

// ─── Handler soumission du formulaire "Je suis intéressé(e)" ─────────────────

async function handleCatalogueModal(interaction) {
  const ficheId = interaction.customId.replace('catalogue_interesse_modal_', '');
  const { member, guild, client } = interaction;
  const db = getDB();

  let ficheObjId;
  try { ficheObjId = new ObjectId(ficheId); } catch {
    return interaction.reply({ content: '❌ Fiche invalide.', ephemeral: true });
  }

  const fiche = await db.collection('catalogue_fiches').findOne({ _id: ficheObjId });
  if (!fiche) return interaction.reply({ content: '❌ Cette fiche n\'existe plus.', ephemeral: true });

  const categorie = await db.collection('catalogue_categories').findOne({ _id: fiche.categorieId });

  await interaction.deferReply({ ephemeral: true });

  // Anti-doublon
  const existingTicket = await db.collection('catalogue_tickets').findOne({ userId: member.id, ficheId: ficheObjId });
  if (existingTicket) {
    const existingChannel = await guild.channels.fetch(existingTicket.channelId).catch(() => null);
    if (existingChannel) return interaction.editReply({ content: `❌ Vous avez déjà un ticket ouvert pour ce bien : ${existingChannel}` });
    await db.collection('catalogue_tickets').deleteOne({ _id: existingTicket._id });
  }

  // Récupérer les réponses selon le type de fiche
  const isPro         = isProFiche(fiche);
  const quartier      = interaction.fields.getTextInputValue('quartier');
  const budget        = interaction.fields.getTextInputValue('budget');
  const disponibilites = interaction.fields.getTextInputValue('disponibilites');
  const entreprise    = isPro ? interaction.fields.getTextInputValue('entreprise') : null;
  const grade         = isPro ? interaction.fields.getTextInputValue('grade')      : null;
  const commentaire   = isPro ? null : (interaction.fields.getTextInputValue('commentaire') || null);

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name:   buildNomTicket(fiche.nom),
      type:   ChannelType.GuildText,
      parent: CATEGORIE_TICKETS_ID,
      permissionOverwrites: buildPermissionOverwrites(guild, client, member),
    });
  } catch (err) {
    console.error('[CATALOGUE] ❌ Erreur création ticket intéressé :', err.message);
    return interaction.editReply({ content: '❌ Impossible de créer le ticket. Contacte un agent directement.' });
  }

  const embedFields = [
    { name: '🏠 Type de propriété',  value: `**${fiche.nom}**${categorie ? ` — ${categorie.label}` : ''}` },
    ...(isPro ? [
      { name: '🏢 Entreprise',           value: entreprise, inline: true },
      { name: '🎖️ Grade de la personne', value: grade,      inline: true },
    ] : []),
    { name: '📍 Quartier souhaité',  value: quartier },
    { name: '💰 Budget',             value: budget, inline: true },
    { name: '🕐 Vos disponibilités', value: disponibilites },
    ...(commentaire ? [{ name: '💬 Commentaire', value: commentaire }] : []),
  ];

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('🏠 Demande d\'information — ' + fiche.nom)
    .setDescription(
      `Bonjour ${member} ! Voici votre demande pour **${fiche.nom}**` +
      (categorie ? ` *(${categorie.label})*` : '') +
      `.\n\nUn agent va prendre en charge votre demande dans les plus brefs délais. 🏡`,
    )
    .addFields(embedFields)
    .setThumbnail(fiche.imageUrl)
    .setFooter({ text: 'Un agent prendra en charge votre demande rapidement.' })
    .setTimestamp();

  await ticketChannel.send({ content: `${member}`, embeds: [embed], components: [fermerRow] });

  await db.collection('catalogue_tickets').insertOne({
    userId: member.id, ficheId: ficheObjId, channelId: ticketChannel.id, createdAt: new Date(),
  });

  await interaction.editReply({ content: `✅ Votre demande a bien été reçue ! Retrouvez votre ticket ici : ${ticketChannel}` });
}

// ─── Handler soumission du formulaire "Liste d'attente" ──────────────────────

async function handleCatalogueAttenteModal(interaction) {
  const ficheId = interaction.customId.replace('catalogue_attente_modal_', '');
  const { member, guild, client } = interaction;
  const db = getDB();

  let ficheObjId;
  try { ficheObjId = new ObjectId(ficheId); } catch {
    return interaction.reply({ content: '❌ Fiche invalide.', ephemeral: true });
  }

  const fiche = await db.collection('catalogue_fiches').findOne({ _id: ficheObjId });
  if (!fiche) return interaction.reply({ content: '❌ Cette fiche n\'existe plus.', ephemeral: true });

  const categorie = await db.collection('catalogue_categories').findOne({ _id: fiche.categorieId });

  await interaction.deferReply({ ephemeral: true });

  // Anti-doublon
  const existingTicket = await db.collection('catalogue_tickets').findOne({ userId: member.id, ficheId: ficheObjId });
  if (existingTicket) {
    const existingChannel = await guild.channels.fetch(existingTicket.channelId).catch(() => null);
    if (existingChannel) return interaction.editReply({ content: `❌ Vous avez déjà un ticket ouvert pour ce bien : ${existingChannel}` });
    await db.collection('catalogue_tickets').deleteOne({ _id: existingTicket._id });
  }

  // Récupérer les réponses du formulaire
  const secteur   = interaction.fields.getTextInputValue('secteur');
  const budget    = interaction.fields.getTextInputValue('budget');
  const identite  = interaction.fields.getTextInputValue('identite')  || null;
  const telephone = interaction.fields.getTextInputValue('telephone') || null;
  const notes     = interaction.fields.getTextInputValue('notes')     || null;

  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name:   buildNomTicket(fiche.nom),
      type:   ChannelType.GuildText,
      parent: CATEGORIE_TICKETS_ATTENTE_ID,
      permissionOverwrites: buildPermissionOverwrites(guild, client, member),
    });
  } catch (err) {
    console.error('[CATALOGUE] ❌ Erreur création ticket attente :', err.message);
    return interaction.editReply({ content: '❌ Impossible de créer le ticket. Contacte un agent directement.' });
  }

  const prixLabel = buildPrixLabel(fiche);
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('📋 Liste d\'attente — ' + fiche.nom)
    .setDescription(
      `Bonjour ${member} ! Voici votre inscription en liste d'attente pour **${fiche.nom}**` +
      (categorie ? ` *(${categorie.label})*` : '') +
      `.\n\nUn agent complétera votre fiche et vous contactera dès qu'un bien se libère. 🏡`,
    )
    .addFields(
      { name: '🏠 Bien recherché',        value: `**${fiche.nom}**${categorie ? ` — ${categorie.label}` : ''}${prixLabel ? `\n💰 ${prixLabel}` : ''}` },
      { name: '📍 Secteur(s) souhaité(s)', value: secteur },
      { name: '💰 Budget maximum',         value: budget, inline: true },
      ...(identite  ? [{ name: '👤 Identité',    value: identite,  inline: true }] : []),
      ...(telephone ? [{ name: '📞 Téléphone RP', value: telephone, inline: true }] : []),
      ...(notes     ? [{ name: '📝 Notes',        value: notes }]                   : []),
    )
    .setThumbnail(fiche.imageUrl)
    .setFooter({ text: 'Un agent prendra en charge votre demande rapidement.' })
    .setTimestamp();

  await ticketChannel.send({ content: `${member}`, embeds: [embed], components: [fermerRow] });

  await db.collection('catalogue_tickets').insertOne({
    userId: member.id, ficheId: ficheObjId, channelId: ticketChannel.id, createdAt: new Date(),
  });

  await interaction.editReply({ content: `✅ Votre inscription a bien été enregistrée ! Retrouvez votre ticket ici : ${ticketChannel}` });
}

module.exports = { publishCatalogue, updateFiche, updateCategorie, handleCatalogueButton, handleCatalogueModal, handleCatalogueAttenteModal };

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ─── Couleurs Dynasty 8 ───────────────────────────────────────────────────────
const GOLD = 0xC9A84C;
const DARK = 0x1A1A2E;
const RED  = 0xE74C3C;
const GREEN = 0x2ECC71;

// ─── Fichier de données clients ───────────────────────────────────────────────
const DATA_PATH = path.join(__dirname, '..', 'data', 'clients.json');

function loadClients() {
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '{}');
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}
function saveClients(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// ─── Commande : afficher le panel de tickets ──────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('panel-tickets')
  .setDescription('📋 Affiche le panel de tickets Dynasty 8')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('🏠  DYNASTY 8 — AGENCE IMMOBILIÈRE')
    .setDescription(
      '**Bienvenue chez Dynasty 8, votre agence de confiance sur Baylife !**\n\n' +
      'Sélectionnez ci-dessous le type de votre demande pour ouvrir un ticket.\n' +
      'Une agente vous répondra dans les plus brefs délais.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🏡  **Achat** — Vous souhaitez acquérir un bien\n' +
      '🔑  **Location** — Vous cherchez un logement à louer\n' +
      '💰  **Vente** — Vous voulez vendre votre bien\n' +
      '📅  **Rendez-vous** — Prendre RDV avec une agente\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .setThumbnail('https://i.imgur.com/xxxxxxx.png') // Remplace par le logo Dynasty 8
    .setFooter({ text: 'Dynasty 8 • Baylife RP', iconURL: interaction.guild.iconURL() })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_achat')
      .setLabel('Achat')
      .setEmoji('🏡')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_location')
      .setLabel('Location')
      .setEmoji('🔑')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_vente')
      .setLabel('Vente')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_rdv')
      .setLabel('Rendez-vous')
      .setEmoji('📅')
      .setStyle(ButtonStyle.Danger),
  );

  const channel = interaction.channel;
  await channel.send({ embeds: [embed], components: [row] });
  await interaction.editReply({ content: '✅ Panel de tickets publié !' });
}

// ─── Gestion des boutons de tickets ──────────────────────────────────────────
const LABELS = {
  ticket_achat:    { label: 'Achat',        emoji: '🏡', color: 0x3498DB },
  ticket_location: { label: 'Location',     emoji: '🔑', color: GREEN },
  ticket_vente:    { label: 'Vente',        emoji: '💰', color: GOLD },
  ticket_rdv:      { label: 'Rendez-vous',  emoji: '📅', color: 0x9B59B6 },
};

async function handleTicketButton(interaction, customId) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const member = interaction.member;
  const type = LABELS[customId];

  // Vérifier si le client a déjà un ticket ouvert
  const existingChannel = guild.channels.cache.find(
    c => c.name === `ticket-${member.user.username.toLowerCase().replace(/\s/g, '-')}` &&
         c.topic?.includes(customId)
  );
  if (existingChannel) {
    return interaction.editReply({
      content: `❌ Tu as déjà un ticket ouvert : ${existingChannel}`,
    });
  }

  // Créer le salon privé
  const ticketChannel = await guild.channels.create({
    name: `${type.emoji}-${member.user.username.toLowerCase().replace(/\s/g, '-')}`,
    type: ChannelType.GuildText,
    parent: process.env.CATEGORIE_TICKETS_ID,
    topic: `${customId} | Demande de ${member.user.tag} | Ouvert le ${new Date().toLocaleDateString('fr-FR')}`,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: process.env.ROLE_AGENTE_ID,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
      },
    ],
  });

  // Embed dans le ticket
  const embed = new EmbedBuilder()
    .setColor(type.color)
    .setTitle(`${type.emoji}  Demande de ${type.label}`)
    .setDescription(
      `Bonjour ${member} ! 👋\n\n` +
      `Bienvenue chez **Dynasty 8**. Une agente va prendre en charge ta demande de **${type.label.toLowerCase()}** très prochainement.\n\n` +
      `En attendant, **décris ta demande en détail** :\n` +
      `> • Quel type de bien t'intéresse ?\n` +
      `> • Quartier / zone souhaité(e) ?\n` +
      `> • Ton budget ?\n` +
      `> • Toute autre précision utile 🙂\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: '👤 Client', value: `${member}`, inline: true },
      { name: '📋 Type', value: `${type.emoji} ${type.label}`, inline: true },
      { name: '📅 Ouvert le', value: new Date().toLocaleDateString('fr-FR'), inline: true },
    )
    .setFooter({ text: 'Dynasty 8 • Baylife RP' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('Prendre en charge')
      .setEmoji('✋')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Fermer le ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );

  const roleAgente = process.env.ROLE_AGENTE_ID ? `<@&${process.env.ROLE_AGENTE_ID}>` : '';
  await ticketChannel.send({
    content: `${member} ${roleAgente}`,
    embeds: [embed],
    components: [row],
  });

  // Enregistrer le client dans la base de données
  const clients = loadClients();
  if (!clients[member.id]) {
    clients[member.id] = {
      id: member.id,
      tag: member.user.tag,
      username: member.user.username,
      dossiers: [],
    };
  }
  clients[member.id].dossiers.push({
    id: ticketChannel.id,
    type: type.label,
    statut: 'Ouvert',
    date: new Date().toISOString(),
    agente: null,
  });
  saveClients(clients);

  await interaction.editReply({
    content: `✅ Ton ticket a été créé : ${ticketChannel}`,
  });

  // Log
  if (process.env.CHANNEL_LOGS_ID) {
    const logChannel = guild.channels.cache.get(process.env.CHANNEL_LOGS_ID);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor(type.color)
        .setTitle('📋 Nouveau ticket ouvert')
        .addFields(
          { name: 'Client', value: member.user.tag, inline: true },
          { name: 'Type', value: `${type.emoji} ${type.label}`, inline: true },
          { name: 'Salon', value: `${ticketChannel}`, inline: true },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }
  }
}

// ─── Prise en charge du ticket ────────────────────────────────────────────────
async function handleTicketClaim(interaction) {
  await interaction.deferReply();

  const channel = interaction.channel;
  const agente = interaction.member;

  // Mettre à jour la base de données
  const clients = loadClients();
  for (const clientId in clients) {
    const dossier = clients[clientId].dossiers.find(d => d.id === channel.id && d.statut === 'Ouvert');
    if (dossier) {
      dossier.statut = 'En cours';
      dossier.agente = agente.user.tag;
      break;
    }
  }
  saveClients(clients);

  const embed = new EmbedBuilder()
    .setColor(GREEN)
    .setDescription(`✋ **${agente.user.username}** prend en charge ce ticket !`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ─── Fermeture du ticket ──────────────────────────────────────────────────────
async function handleTicketClose(interaction) {
  await interaction.deferReply();

  const channel = interaction.channel;

  // Vérifier permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !interaction.member.roles.cache.has(process.env.ROLE_AGENTE_ID)) {
    return interaction.editReply({ content: '❌ Tu n\'as pas la permission de fermer ce ticket.' });
  }

  // Mettre à jour la BDD
  const clients = loadClients();
  for (const clientId in clients) {
    const dossier = clients[clientId].dossiers.find(d => d.id === channel.id);
    if (dossier) {
      dossier.statut = 'Fermé';
      dossier.dateFermeture = new Date().toISOString();
      break;
    }
  }
  saveClients(clients);

  const embed = new EmbedBuilder()
    .setColor(RED)
    .setTitle('🔒 Ticket fermé')
    .setDescription(`Ce ticket a été fermé par **${interaction.user.username}**.\nLe salon sera supprimé dans **5 secondes**.`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

module.exports = { data, execute, handleTicketButton, handleTicketClose, handleTicketClaim };

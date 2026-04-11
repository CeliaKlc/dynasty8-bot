const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const { getDB } = require('../utils/db');
const { updateDashboard, TYPE_EMOJIS, STATUT_EMOJI } = require('../utils/attenteManager');

const TYPES = [
  'Appartement Simple', 'Appartement Basique', 'Maison Simple', 'Caravane',
  'Appartement Favelas', 'Maison Favelas', 'Studio de Luxe', 'Appartement Moderne',
  'Duplex', 'Appartement de Luxe Modifiable', 'Villa', 'Maison de Luxe',
  'Villa de Luxe', 'Bureau', 'Agence', 'Hangar', 'Entrepôt',
  'Garage 2 places', 'Garage 6 places', 'Garage 10 places', 'Garage 26 places', 'Loft Garage',
];

const ZONES = ['Nord', 'Sud', 'Roxwood', 'Las Venturas', 'Mirror Park', 'Chumash', 'Canaux de Vespucci', 'Del Perro'];

// Pending en mémoire (TTL 10 min) — utilisé pour add ET update
// { mode: 'add'|'update', clientId, ticketId, budgetMax, notes, agentId, selectedTypes[], bienZones{} }
const pendingBienSelect = new Map();

// ─── UI helpers ───────────────────────────────────────────────────────────────

function buildComponents(pending) {
  const rows      = [];
  const confirmId = pending.mode === 'update' ? 'attente_upd_confirm' : 'attente_add_confirm';

  if (pending.selectedTypes.length === 0) {
    // Phase 1 — sélection des types
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('attente_sel_types')
        .setPlaceholder('Type(s) de bien recherché(s)... (max 4)')
        .setMinValues(1)
        .setMaxValues(Math.min(4, TYPES.length))
        .addOptions(TYPES.map(t => ({
          label: t,
          value: t,
          ...(TYPE_EMOJIS[t] ? { emoji: TYPE_EMOJIS[t] } : {}),
        }))),
    ));
  } else {
    // Phase 2 — un select de secteur par type
    for (const type of pending.selectedTypes) {
      rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`attente_sel_zone_${type}`)
          .setPlaceholder(`${TYPE_EMOJIS[type] ?? '🏠'} ${type} — Secteur...`)
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(ZONES.map(z => ({
            label:   z,
            value:   z,
            default: pending.bienZones[type] === z,
          }))),
      ));
    }
  }

  const allReady = pending.selectedTypes.length > 0
    && pending.selectedTypes.every(t => pending.bienZones[t] != null);

  const lastRow = [
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel('✅ Confirmer')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!allReady),
  ];

  // En Phase 2, ajouter un bouton pour revenir à la sélection des types
  if (pending.selectedTypes.length > 0) {
    lastRow.push(
      new ButtonBuilder()
        .setCustomId('attente_reset_types')
        .setLabel('↩️ Changer les types')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  rows.push(new ActionRowBuilder().addComponents(lastRow));
  return rows;
}

function buildSummaryContent(pending) {
  const titre = pending.mode === 'update'
    ? `✏️ **Modification de <@${pending.clientId}>**`
    : `📋 **Ajout de <@${pending.clientId}>** en liste d'attente`;

  const lines = [
    titre,
    `> 🎫 Ticket : <#${pending.ticketId}>`,
    `> 💰 Budget max : **${pending.budgetMax.toLocaleString('fr-FR')} $**`,
    ...(pending.notes ? [`> 📝 Notes : ${pending.notes}`] : []),
    '',
  ];

  if (pending.selectedTypes.length === 0) {
    lines.push('Sélectionne le ou les type(s) de bien recherché(s) :');
  } else {
    lines.push('**Biens recherchés :**');
    for (const type of pending.selectedTypes) {
      const zone  = pending.bienZones[type];
      const emoji = TYPE_EMOJIS[type] ?? '🏠';
      lines.push(`> ${emoji} **${type}** — 📍 ${zone ?? '*Secteur à sélectionner*'}`);
    }
    lines.push('');
    const allReady = pending.selectedTypes.every(t => pending.bienZones[t] != null);
    lines.push(allReady
      ? '✅ Prêt à confirmer !'
      : '⚠️ Sélectionne un secteur pour chaque type de bien.');
  }

  return lines.join('\n');
}

// ─── Command ──────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('attente')
    .setDescription('Gérer la liste d\'attente clients')

    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Ajouter un client en liste d\'attente')
      .addUserOption(opt => opt.setName('client').setDescription('Mentionner le client (@)').setRequired(true))
      .addChannelOption(opt => opt.setName('ticket').setDescription('Salon ticket du client (#)').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addIntegerOption(opt => opt.setName('budget_max').setDescription('Budget maximum ($)').setRequired(true).setMinValue(0))
      .addStringOption(opt => opt.setName('notes').setDescription('Notes supplémentaires (optionnel)').setRequired(false)),
    )

    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Supprimer un client de la liste d\'attente')
      .addUserOption(opt => opt.setName('client').setDescription('Mentionner le client (@)').setRequired(true)),
    )

    .addSubcommand(sub => sub
      .setName('update')
      .setDescription('Modifier la fiche d\'un client (budget, notes, biens)')
      .addUserOption(opt => opt.setName('client').setDescription('Mentionner le client (@)').setRequired(true))
      .addIntegerOption(opt => opt.setName('nouveau_budget_max').setDescription('Nouveau budget maximum ($)').setRequired(false).setMinValue(0))
      .addStringOption(opt => opt.setName('nouvelles_notes').setDescription('Nouvelles notes (remplace les existantes)').setRequired(false)),
    )

    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Lister les clients en attente')
      .addStringOption(opt => opt.setName('type').setDescription('Filtrer par type de bien').setRequired(false).addChoices(...TYPES.map(t => ({ name: t, value: t }))))
      .addStringOption(opt => opt.setName('zone').setDescription('Filtrer par secteur').setRequired(false).addChoices(...ZONES.map(z => ({ name: z, value: z })))),
    ),

  async execute(interaction) {
    const db  = getDB();
    const sub = interaction.options.getSubcommand();

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const clientUser = interaction.options.getUser('client');
      const ticket     = interaction.options.getChannel('ticket');
      const budgetMax  = interaction.options.getInteger('budget_max');
      const notes      = interaction.options.getString('notes') ?? null;

      const existing = await db.collection('waiting_list').findOne({
        clientId: clientUser.id, status: { $ne: 'terminé' },
      });
      if (existing) {
        return interaction.reply({
          content:   `❌ <@${clientUser.id}> est déjà en liste d'attente (statut : **${existing.status}**).`,
          ephemeral: true,
        });
      }

      const pending = {
        mode: 'add',
        clientId: clientUser.id, ticketId: ticket.id,
        budgetMax, notes, agentId: interaction.user.id,
        selectedTypes: [], bienZones: {},
      };
      pendingBienSelect.set(interaction.user.id, pending);
      setTimeout(() => pendingBienSelect.delete(interaction.user.id), 10 * 60 * 1000);

      return interaction.reply({ content: buildSummaryContent(pending), components: buildComponents(pending), ephemeral: true });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const clientUser = interaction.options.getUser('client');
      const result = await db.collection('waiting_list').deleteOne({ clientId: clientUser.id });
      if (result.deletedCount === 0) {
        return interaction.reply({ content: `❌ <@${clientUser.id}> n'est pas en liste d'attente.`, ephemeral: true });
      }
      await updateDashboard(interaction.client);
      return interaction.reply({ content: `✅ <@${clientUser.id}> a été retiré(e) de la liste d'attente.`, ephemeral: true });
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (sub === 'update') {
      const clientUser     = interaction.options.getUser('client');
      const newBudgetMax   = interaction.options.getInteger('nouveau_budget_max');
      const nouvellesNotes = interaction.options.getString('nouvelles_notes');

      const doc = await db.collection('waiting_list').findOne({ clientId: clientUser.id });
      if (!doc) {
        return interaction.reply({ content: `❌ <@${clientUser.id}> n'est pas en liste d'attente.`, ephemeral: true });
      }

      // Pré-remplir avec les biens existants
      const selectedTypes = (doc.biens ?? []).map(b => b.type);
      const bienZones     = Object.fromEntries((doc.biens ?? []).map(b => [b.type, b.zone]));

      const pending = {
        mode: 'update',
        clientId:      clientUser.id,
        ticketId:      doc.ticketId,
        budgetMax:     newBudgetMax   ?? doc.budget.max,
        notes:         nouvellesNotes ?? doc.notes,
        agentId:       interaction.user.id,
        selectedTypes,
        bienZones,
      };
      pendingBienSelect.set(interaction.user.id, pending);
      setTimeout(() => pendingBienSelect.delete(interaction.user.id), 10 * 60 * 1000);

      return interaction.reply({ content: buildSummaryContent(pending), components: buildComponents(pending), ephemeral: true });
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const typeFilter = interaction.options.getString('type');
      const zoneFilter = interaction.options.getString('zone');

      const query = { status: { $ne: 'terminé' } };
      if (typeFilter && zoneFilter) query.biens = { $elemMatch: { type: typeFilter, zone: zoneFilter } };
      else if (typeFilter)          query['biens.type'] = typeFilter;
      else if (zoneFilter)          query['biens.zone'] = zoneFilter;

      const clients = await db.collection('waiting_list').find(query).sort({ createdAt: 1 }).toArray();

      if (clients.length === 0) {
        return interaction.reply({ content: '📋 Aucun client en liste d\'attente pour ces critères.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Liste d'attente${typeFilter ? ` — ${typeFilter}` : ''}${zoneFilter ? ` — ${zoneFilter}` : ''}`)
        .setColor(0x3498DB)
        .setTimestamp()
        .setFooter({ text: `${clients.length} client(s) • Trié par ancienneté` });

      const lines = clients.map((c, i) => {
        const date        = c.createdAt.toLocaleDateString('fr-FR');
        const budget      = `max ${c.budget.max.toLocaleString('fr-FR')} $`;
        const statut      = STATUT_EMOJI[c.status] ?? '⚪';
        const biensFiltres = (c.biens ?? []).filter(b =>
          (!typeFilter || b.type === typeFilter) && (!zoneFilter || b.zone === zoneFilter)
        );
        const biensAffich = biensFiltres.length > 0 ? biensFiltres : (c.biens ?? []);
        const biensStr    = biensAffich.map(b => `${TYPE_EMOJIS[b.type] ?? '🏠'} ${b.type} (${b.zone})`).join(', ');
        const notes       = c.notes ? `\n> 📝 ${c.notes}` : '';
        return `**${i + 1}.** ${statut} <@${c.clientId}> • <#${c.ticketId}>\n> ${biensStr} • 💰 ${budget} • 📅 ${date}${notes}`;
      });

      embed.setDescription(lines.join('\n\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  // ─── Handler bouton "Changer les types" — retour Phase 1 ─────────────────

  async handleAttenteResetTypes(interaction) {
    const pending = pendingBienSelect.get(interaction.user.id);
    if (!pending) {
      return interaction.update({ content: '❌ Session expirée. Relance la commande.', components: [] });
    }
    pending.selectedTypes = [];
    pending.bienZones     = {};
    return interaction.update({ content: buildSummaryContent(pending), components: buildComponents(pending) });
  },

  // ─── Handler select menus (partagé add + update) ──────────────────────────

  async handleAttenteSelect(interaction) {
    const pending = pendingBienSelect.get(interaction.user.id);
    if (!pending) {
      return interaction.update({ content: '❌ Session expirée. Relance la commande.', components: [] });
    }

    if (interaction.customId === 'attente_sel_types') {
      const newZones = {};
      for (const type of interaction.values) {
        newZones[type] = pending.bienZones[type] ?? null;
      }
      pending.selectedTypes = interaction.values;
      pending.bienZones     = newZones;
    } else if (interaction.customId.startsWith('attente_sel_zone_')) {
      const type = interaction.customId.replace('attente_sel_zone_', '');
      pending.bienZones[type] = interaction.values[0];
    }

    return interaction.update({ content: buildSummaryContent(pending), components: buildComponents(pending) });
  },

  // ─── Handler bouton confirmer — ajout ─────────────────────────────────────

  async handleAttenteConfirm(interaction) {
    const pending = pendingBienSelect.get(interaction.user.id);
    if (!pending || pending.mode !== 'add') {
      return interaction.update({ content: '❌ Session expirée. Relance `/attente add`.', components: [] });
    }

    const allReady = pending.selectedTypes.length > 0
      && pending.selectedTypes.every(t => pending.bienZones[t] != null);
    if (!allReady) {
      return interaction.update({ content: '❌ Sélectionne un secteur pour chaque type.', components: buildComponents(pending) });
    }

    pendingBienSelect.delete(interaction.user.id);

    const biens = pending.selectedTypes.map(type => ({ type, zone: pending.bienZones[type] }));
    const db    = getDB();

    await db.collection('waiting_list').insertOne({
      clientId:  pending.clientId,
      ticketId:  pending.ticketId,
      agentId:   pending.agentId,
      biens,
      budget:    { max: pending.budgetMax },
      notes:     pending.notes,
      status:    'active',
      createdAt: new Date(),
    });

    await updateDashboard(interaction.client);

    // Récap dans le ticket
    try {
      const ch = await interaction.client.channels.fetch(pending.ticketId);
      if (ch) {
        await ch.send({ embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('📋 Ajouté en liste d\'attente')
            .setDescription(`<@${pending.clientId}> a bien été noté(e) en liste d'attente.`)
            .addFields(
              { name: '🏠 Bien(s) recherché(s)', value: biens.map(b => `> ${TYPE_EMOJIS[b.type] ?? '🏠'} **${b.type}** — 📍 ${b.zone}`).join('\n') },
              { name: '💰 Budget maximum', value: `${pending.budgetMax.toLocaleString('fr-FR')} $`, inline: true },
              ...(pending.notes ? [{ name: '📝 Notes', value: pending.notes }] : []),
            )
            .setFooter({ text: `Ajouté par ${interaction.user.username}` })
            .setTimestamp(),
        ] });
      }
    } catch (err) {
      console.error('[ATTENTE] Impossible d\'envoyer le récap dans le ticket :', err);
    }

    const biensStr = biens.map(b => `> ${TYPE_EMOJIS[b.type] ?? '🏠'} **${b.type}** — 📍 ${b.zone}`).join('\n');
    return interaction.update({
      content: [`✅ <@${pending.clientId}> ajouté(e) en liste d'attente !`, `> 🎫 <#${pending.ticketId}>`, biensStr, `> 💰 max ${pending.budgetMax.toLocaleString('fr-FR')} $`, ...(pending.notes ? [`> 📝 ${pending.notes}`] : [])].join('\n'),
      components: [],
    });
  },

  // ─── Handler bouton confirmer — mise à jour ───────────────────────────────

  async handleAttenteUpdateConfirm(interaction) {
    const pending = pendingBienSelect.get(interaction.user.id);
    if (!pending || pending.mode !== 'update') {
      return interaction.update({ content: '❌ Session expirée. Relance `/attente update`.', components: [] });
    }

    const allReady = pending.selectedTypes.length > 0
      && pending.selectedTypes.every(t => pending.bienZones[t] != null);
    if (!allReady) {
      return interaction.update({ content: '❌ Sélectionne un secteur pour chaque type.', components: buildComponents(pending) });
    }

    pendingBienSelect.delete(interaction.user.id);

    const biens = pending.selectedTypes.map(type => ({ type, zone: pending.bienZones[type] }));
    const db    = getDB();

    await db.collection('waiting_list').updateOne(
      { clientId: pending.clientId },
      { $set: { biens, 'budget.max': pending.budgetMax, notes: pending.notes } },
    );

    await updateDashboard(interaction.client);

    const biensStr = biens.map(b => `> ${TYPE_EMOJIS[b.type] ?? '🏠'} **${b.type}** — 📍 ${b.zone}`).join('\n');
    return interaction.update({
      content: [`✅ Fiche de <@${pending.clientId}> mise à jour !`, biensStr, `> 💰 max ${pending.budgetMax.toLocaleString('fr-FR')} $`, ...(pending.notes ? [`> 📝 ${pending.notes}`] : [])].join('\n'),
      components: [],
    });
  },
};

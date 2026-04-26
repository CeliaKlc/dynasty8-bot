const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const { getDB } = require('../utils/db');
const { updateDashboard, TYPE_EMOJIS, STATUT_EMOJI } = require('../utils/attenteManager');
const { logAction } = require('../utils/actionLogger');

const TYPES = [
  'Appartement Simple', 'Appartement Basique', 'Maison Simple', 'Caravane',
  'Appartement Favelas', 'Maison Favelas', 'Studio de Luxe', 'Appartement Moderne',
  'Duplex', 'Appartement de Luxe Modifiable', 'Villa', 'Maison de Luxe',
  'Villa de Luxe', 'Bureau', 'Agence', 'Hangar', 'Entrepôt',
  'Garage 2 places', 'Garage 6 places', 'Garage 10 places', 'Garage 26 places', 'Loft Garage',
];

// Pending en mémoire (TTL 10 min)
// { mode, clientId, ticketId, budgetMax, notes, agentId, selectedTypes[], bienZones{} }
const pendingBienSelect = new Map();

// ─── Sélecteur de types (Phase unique) ───────────────────────────────────────

function buildTypeSelector(pending) {
  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('attente_sel_types')
      .setPlaceholder('Type(s) de bien recherché(s)... (max 5)')
      .setMinValues(1)
      .setMaxValues(Math.min(5, TYPES.length))
      .addOptions(TYPES.map(t => ({
        label:   t,
        value:   t,
        ...(TYPE_EMOJIS[t] ? { emoji: TYPE_EMOJIS[t] } : {}),
        default: pending.selectedTypes.includes(t),
      }))),
  );
  return [selectRow];
}

// ─── Modal de saisie des secteurs ─────────────────────────────────────────────

function buildZonesModal(pending) {
  const modal = new ModalBuilder()
    .setCustomId('attente_modal_zones')
    .setTitle('Secteurs recherchés');

  for (const type of pending.selectedTypes) {
    const input = new TextInputBuilder()
      .setCustomId(`zone_${type}`)
      .setLabel(type)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Vinewood, Rockford Hills, Nord...')
      .setRequired(true)
      .setMaxLength(100);

    // Pré-remplir si zone déjà définie (mode update)
    const existingZone = pending.bienZones[type];
    if (existingZone) input.setValue(existingZone);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
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
      .addStringOption(opt => opt.setName('prenom').setDescription('Prénom du client').setRequired(false))
      .addStringOption(opt => opt.setName('nom').setDescription('Nom de famille du client').setRequired(false))
      .addStringOption(opt => opt.setName('telephone').setDescription('Numéro de téléphone RP').setRequired(false))
      .addStringOption(opt => opt.setName('notes').setDescription('Notes supplémentaires (optionnel)').setRequired(false)),
    )

    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Supprimer un client de la liste d\'attente')
      .addUserOption(opt => opt.setName('client').setDescription('Mentionner le client (@)').setRequired(true)),
    )

    .addSubcommand(sub => sub
      .setName('update')
      .setDescription('Modifier la fiche d\'un client (budget, notes, biens, identité)')
      .addUserOption(opt => opt.setName('client').setDescription('Mentionner le client (@)').setRequired(true))
      .addIntegerOption(opt => opt.setName('nouveau_budget_max').setDescription('Nouveau budget maximum ($)').setRequired(false).setMinValue(0))
      .addStringOption(opt => opt.setName('prenom').setDescription('Prénom (remplace l\'existant)').setRequired(false))
      .addStringOption(opt => opt.setName('nom').setDescription('Nom de famille (remplace l\'existant)').setRequired(false))
      .addStringOption(opt => opt.setName('telephone').setDescription('Téléphone RP (remplace l\'existant)').setRequired(false))
      .addStringOption(opt => opt.setName('nouvelles_notes').setDescription('Nouvelles notes (remplace les existantes)').setRequired(false)),
    )

    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Lister les clients en attente')
      .addStringOption(opt => opt.setName('type').setDescription('Filtrer par type de bien').setRequired(false).addChoices(...TYPES.map(t => ({ name: t, value: t }))))
      .addStringOption(opt => opt.setName('zone').setDescription('Filtrer par secteur').setRequired(false)),
    ),

  async execute(interaction) {
    const db  = getDB();
    const sub = interaction.options.getSubcommand();

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const clientUser = interaction.options.getUser('client');
      const ticket     = interaction.options.getChannel('ticket');
      const budgetMax  = interaction.options.getInteger('budget_max');
      const prenom     = interaction.options.getString('prenom')?.trim()    || null;
      const nom        = interaction.options.getString('nom')?.trim()       || null;
      const telephone  = interaction.options.getString('telephone')?.trim() || null;
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

      // Récupérer le nom d'affichage Discord du client (pseudo serveur > nom global > username)
      const member     = await interaction.guild.members.fetch(clientUser.id).catch(() => null);
      const clientName = member?.displayName ?? clientUser.globalName ?? clientUser.username;

      const pending = {
        mode: 'add', clientId: clientUser.id, clientName,
        prenom, nom, telephone,
        ticketId: ticket.id,
        budgetMax, notes, agentId: interaction.user.id,
        selectedTypes: [], bienZones: {},
      };
      pendingBienSelect.set(interaction.user.id, pending);
      setTimeout(() => pendingBienSelect.delete(interaction.user.id), 10 * 60 * 1000);

      return interaction.reply({
        content:    `📋 **Ajout de <@${clientUser.id}>** — Sélectionne le ou les type(s) de bien :`,
        components: buildTypeSelector(pending),
        ephemeral:  true,
      });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const clientUser = interaction.options.getUser('client');
      const doc = await db.collection('waiting_list').findOne({ clientId: clientUser.id });
      const result = await db.collection('waiting_list').deleteOne({ clientId: clientUser.id });
      if (result.deletedCount === 0) {
        return interaction.reply({ content: `❌ <@${clientUser.id}> n'est pas en liste d'attente.`, ephemeral: true });
      }
      await logAction({
        type:      'attente_remove',
        actorId:   interaction.user.id,
        actorName: interaction.member?.displayName ?? interaction.user.username,
        details: {
          clientId:   clientUser.id,
          clientName: doc?.clientName ?? null,
          prenom:     doc?.prenom    ?? null,
          nom:        doc?.nom       ?? null,
        },
      });
      await updateDashboard(interaction.client);
      return interaction.reply({ content: `✅ <@${clientUser.id}> a été retiré(e) de la liste d'attente.`, ephemeral: true });
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (sub === 'update') {
      const clientUser     = interaction.options.getUser('client');
      const newBudgetMax   = interaction.options.getInteger('nouveau_budget_max');
      const newPrenom      = interaction.options.getString('prenom')?.trim()    ?? null;
      const newNom         = interaction.options.getString('nom')?.trim()       ?? null;
      const newTelephone   = interaction.options.getString('telephone')?.trim() ?? null;
      const nouvellesNotes = interaction.options.getString('nouvelles_notes');

      const doc = await db.collection('waiting_list').findOne({ clientId: clientUser.id });
      if (!doc) {
        return interaction.reply({ content: `❌ <@${clientUser.id}> n'est pas en liste d'attente.`, ephemeral: true });
      }

      const member     = await interaction.guild.members.fetch(clientUser.id).catch(() => null);
      const clientName = member?.displayName ?? clientUser.globalName ?? clientUser.username;

      const pending = {
        mode:          'update',
        clientId:      clientUser.id,
        clientName,
        // Garde l'existant si non renseigné
        prenom:        newPrenom    ?? doc.prenom    ?? null,
        nom:           newNom       ?? doc.nom       ?? null,
        telephone:     newTelephone ?? doc.telephone ?? null,
        ticketId:      doc.ticketId,
        budgetMax:     newBudgetMax   ?? doc.budget.max,
        notes:         nouvellesNotes ?? doc.notes,
        agentId:       interaction.user.id,
        selectedTypes: (doc.biens ?? []).map(b => b.type),
        bienZones:     Object.fromEntries((doc.biens ?? []).map(b => [b.type, b.zone])),
      };
      pendingBienSelect.set(interaction.user.id, pending);
      setTimeout(() => pendingBienSelect.delete(interaction.user.id), 10 * 60 * 1000);

      return interaction.reply({
        content:    `✏️ **Modification de <@${clientUser.id}>** — Modifie ou confirme les types de bien :`,
        components: buildTypeSelector(pending),
        ephemeral:  true,
      });
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const typeFilter = interaction.options.getString('type');
      const zoneFilter = interaction.options.getString('zone');

      const query = { status: { $ne: 'terminé' } };
      if (typeFilter && zoneFilter) query.biens = { $elemMatch: { type: typeFilter, zone: zoneFilter } };
      else if (typeFilter)          query['biens.type'] = typeFilter;
      else if (zoneFilter)          query['biens.zone'] = { $regex: zoneFilter, $options: 'i' };

      const clients = await db.collection('waiting_list').find(query).sort({ createdAt: 1 }).limit(100).toArray();

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
          (!typeFilter || b.type === typeFilter) && (!zoneFilter || b.zone.toLowerCase().includes(zoneFilter.toLowerCase()))
        );
        const biensAffich = biensFiltres.length > 0 ? biensFiltres : (c.biens ?? []);
        const biensStr    = biensAffich.map(b => `${TYPE_EMOJIS[b.type] ?? '🏠'} ${b.type} (${b.zone})`).join(', ');
        const identite    = [c.prenom, c.nom].filter(Boolean).join(' ');
        const identiteStr = identite ? ` — 👤 **${identite}**` : '';
        const telStr      = c.telephone ? ` — 📞 ${c.telephone}` : '';
        const notes       = c.notes ? `\n> 📝 ${c.notes}` : '';
        return `**${i + 1}.** ${statut} <@${c.clientId}>${identiteStr}${telStr} • <#${c.ticketId}>\n> ${biensStr} • 💰 ${budget} • 📅 ${date}${notes}`;
      });

      embed.setDescription(lines.join('\n\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  // ─── Handler select types → affiche un bouton pour ouvrir le modal ─────────

  async handleAttenteSelect(interaction) {
    const pending = pendingBienSelect.get(interaction.user.id);
    if (!pending) {
      return interaction.update({ content: '❌ Session expirée. Relance la commande.', components: [] });
    }

    if (interaction.customId === 'attente_sel_types') {
      // Conserver les zones existantes pour les types re-sélectionnés
      const newZones = {};
      for (const type of interaction.values) {
        newZones[type] = pending.bienZones[type] ?? '';
      }
      pending.selectedTypes = interaction.values;
      pending.bienZones     = newZones;

      const typesStr = interaction.values.map(t => `> ${TYPE_EMOJIS[t] ?? '🏠'} **${t}**`).join('\n');
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('attente_saisir_zones')
          .setLabel('✏️ Saisir les secteurs')
          .setStyle(ButtonStyle.Primary),
      );

      return interaction.update({
        content: `📋 Type(s) sélectionné(s) :\n${typesStr}\n\nClique sur le bouton pour saisir les secteurs.`,
        components: [btnRow],
      });
    }
  },

  // ─── Handler bouton → ouvre le modal de saisie des secteurs ──────────────

  async handleAttenteSaisirZones(interaction) {
    const pending = pendingBienSelect.get(interaction.user.id);
    if (!pending) {
      return interaction.update({ content: '❌ Session expirée. Relance la commande.', components: [] });
    }
    return interaction.showModal(buildZonesModal(pending));
  },

  // ─── Handler modal zones → enregistrement en DB ───────────────────────────

  async handleAttenteZonesModal(interaction) {
    const pending = pendingBienSelect.get(interaction.user.id);
    if (!pending) {
      return interaction.reply({ content: '❌ Session expirée. Relance la commande.', ephemeral: true });
    }

    pendingBienSelect.delete(interaction.user.id);

    const biens = pending.selectedTypes.map(type => ({
      type,
      zone: interaction.fields.getTextInputValue(`zone_${type}`).trim(),
    }));

    const db = getDB();

    // Libellé identité pour les messages Discord
    const identiteLabel = [pending.prenom, pending.nom].filter(Boolean).join(' ')
      || pending.clientName;

    if (pending.mode === 'add') {
      await db.collection('waiting_list').insertOne({
        clientId:   pending.clientId,
        clientName: pending.clientName,
        prenom:     pending.prenom,
        nom:        pending.nom,
        telephone:  pending.telephone,
        ticketId:   pending.ticketId,
        agentId:    pending.agentId,
        biens,
        budget:    { max: pending.budgetMax },
        notes:     pending.notes,
        status:    'active',
        createdAt: new Date(),
      });

      // Récap dans le ticket du client
      try {
        const ch = await interaction.client.channels.fetch(pending.ticketId);
        if (ch) {
          const identiteFields = [];
          if (pending.prenom || pending.nom)
            identiteFields.push({ name: '👤 Identité', value: identiteLabel, inline: true });
          if (pending.telephone)
            identiteFields.push({ name: '📞 Téléphone', value: pending.telephone, inline: true });

          await ch.send({ embeds: [
            new EmbedBuilder()
              .setColor(0x2ECC71)
              .setTitle('📋 Ajouté en liste d\'attente')
              .setDescription(`<@${pending.clientId}> a bien été noté(e) en liste d'attente.`)
              .addFields(
                ...identiteFields,
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
    } else {
      await db.collection('waiting_list').updateOne(
        { clientId: pending.clientId },
        {
          $set: {
            biens,
            clientName: pending.clientName,
            prenom:     pending.prenom,
            nom:        pending.nom,
            telephone:  pending.telephone,
            'budget.max': pending.budgetMax,
            notes:      pending.notes,
          },
        },
      );
    }

    await logAction({
      type:      pending.mode === 'add' ? 'attente_add' : 'attente_update',
      actorId:   interaction.user.id,
      actorName: interaction.user.username,
      details: {
        clientId:   pending.clientId,
        clientName: pending.clientName,
        prenom:     pending.prenom   ?? null,
        nom:        pending.nom      ?? null,
        telephone:  pending.telephone ?? null,
        biens:      biens.map(b => `${b.type} (${b.zone})`),
        budgetMax:  pending.budgetMax,
      },
    });

    await updateDashboard(interaction.client);

    const biensStr = biens.map(b => `> ${TYPE_EMOJIS[b.type] ?? '🏠'} **${b.type}** — 📍 ${b.zone}`).join('\n');
    const verb     = pending.mode === 'add' ? 'ajouté(e) en liste d\'attente' : 'mis(e) à jour';

    const identiteLines = [];
    if (pending.prenom || pending.nom)
      identiteLines.push(`> 👤 ${[pending.prenom, pending.nom].filter(Boolean).join(' ')}`);
    if (pending.telephone)
      identiteLines.push(`> 📞 ${pending.telephone}`);

    return interaction.reply({
      content: [
        `✅ <@${pending.clientId}> ${verb} !`,
        `> 🎫 Ticket : <#${pending.ticketId}>`,
        ...identiteLines,
        biensStr,
        `> 💰 Budget max : ${pending.budgetMax.toLocaleString('fr-FR')} $`,
        ...(pending.notes ? [`> 📝 ${pending.notes}`] : []),
      ].join('\n'),
      ephemeral: true,
    });
  },
};

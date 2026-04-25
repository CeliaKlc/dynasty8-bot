const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getDB } = require('../utils/db');
const { updateSacDashboard } = require('../utils/sacManager');
const agentCache = require('../utils/agentCache');

// Index Discord ID → nom RP (calculé à la volée pour refléter le cache)
const AGENT_NAMES = () => Object.fromEntries(agentCache.getAll().filter(a => a.id).map(a => [a.id, a.name]));

// ─── Liste des sacs disponibles ───────────────────────────────────────────────

const SAC_OPTIONS = [
  { label: 'Sac V1 — Agent',          value: 'Sac V1'    },
  { label: 'Sac V2 — Agent Confirmé', value: 'Sac V2'    },
  { label: 'Sac à dos — Agent LBC',   value: 'Sac à dos' },
  { label: 'Sac V3 — Direction',      value: 'Sac V3'    },
];

// Sélections en attente entre la commande et le select menu (TTL 5 min)
const pendingSelects = new Map(); // userId → { agentId, agentName }

// ─── Commande ─────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sac')
    .setDescription('Gérer le registre des sacs')

    .addSubcommand(sub => sub
      .setName('donner')
      .setDescription('Attribuer un ou plusieurs sacs à un agent')
      .addUserOption(opt => opt
        .setName('agent')
        .setDescription('L\'agent concerné')
        .setRequired(true)),
    )

    .addSubcommand(sub => sub
      .setName('retirer')
      .setDescription('Retirer un ou plusieurs sacs d\'un agent')
      .addUserOption(opt => opt
        .setName('agent')
        .setDescription('L\'agent concerné')
        .setRequired(true)),
    )

    .addSubcommand(sub => sub
      .setName('depart')
      .setDescription('Marquer un agent comme parti (masqué du tableau, conservé dans l\'historique)')
      .addStringOption(opt => {
        opt.setName('agent').setDescription('L\'agent concerné').setRequired(true);
        agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
        return opt;
      }),
    )

    .addSubcommand(sub => sub
      .setName('retour')
      .setDescription('Réactiver un agent parti (retour dans l\'entreprise)')
      .addStringOption(opt => {
        opt.setName('agent').setDescription('L\'agent concerné').setRequired(true);
        agentCache.getAll().filter(a => a.id).forEach(a => opt.addChoices({ name: `${a.emoji} ${a.name}`, value: a.id }));
        return opt;
      }),
    ),

  async execute(interaction) {
    const db  = getDB();
    const sub = interaction.options.getSubcommand();
    const col = db.collection('sac_registry');

    // donner / retirer → User option (agent présent sur le serveur)
    // depart / retour  → String option (choix fixes = Discord IDs de l'AGENTS array)
    const agentUser = (sub === 'donner' || sub === 'retirer')
      ? interaction.options.getUser('agent') : null;
    const agentMember = (sub === 'donner' || sub === 'retirer')
      ? interaction.options.getMember('agent') : null;
    const agentId   = agentUser?.id ?? interaction.options.getString('agent');
    const agentName = AGENT_NAMES()[agentId]
      ?? agentMember?.displayName
      ?? agentUser?.username
      ?? agentId;

    // ── DONNER ────────────────────────────────────────────────────────────────
    if (sub === 'donner') {
      pendingSelects.set(interaction.user.id, { agentId, agentName });
      setTimeout(() => pendingSelects.delete(interaction.user.id), 5 * 60 * 1000);

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('sac_donner_select')
          .setPlaceholder('Sélectionne le ou les sac(s) à attribuer…')
          .setMinValues(1)
          .setMaxValues(SAC_OPTIONS.length)
          .addOptions(SAC_OPTIONS.map(o => ({ label: o.label, value: o.value, emoji: '🎒' }))),
      );

      return interaction.reply({
        content:    `🎒 Attribution à **${agentName}** — Sélectionne le ou les sac(s) :`,
        components: [row],
        ephemeral:  true,
      });
    }

    // ── RETIRER ───────────────────────────────────────────────────────────────
    if (sub === 'retirer') {
      const doc = await col.findOne({ agentId });

      if (!doc || doc.sacs.length === 0) {
        return interaction.reply({
          content:   `❌ **${agentName}** ne possède aucun sac.`,
          ephemeral: true,
        });
      }

      pendingSelects.set(interaction.user.id, { agentId, agentName });
      setTimeout(() => pendingSelects.delete(interaction.user.id), 5 * 60 * 1000);

      // Proposer uniquement les sacs que l'agent possède déjà
      const options = doc.sacs.map(s => {
        const opt = SAC_OPTIONS.find(o => o.value === s);
        return { label: opt?.label ?? s, value: s, emoji: '🎒' };
      });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('sac_retirer_select')
          .setPlaceholder('Sélectionne le ou les sac(s) à retirer…')
          .setMinValues(1)
          .setMaxValues(options.length)
          .addOptions(options),
      );

      return interaction.reply({
        content:    `🎒 Retrait de **${agentName}** — Sélectionne le ou les sac(s) :`,
        components: [row],
        ephemeral:  true,
      });
    }

    // ── DEPART ────────────────────────────────────────────────────────────────
    if (sub === 'depart') {
      const doc = await col.findOne({ agentId });

      if (doc?.statut === 'parti') {
        return interaction.reply({
          content:   `❌ **${agentName}** est déjà marqué(e) comme parti(e).`,
          ephemeral: true,
        });
      }

      if (!doc) {
        await col.insertOne({
          agentId, agentName,
          sacs: [], statut: 'parti',
          departAt: new Date(), updatedAt: new Date(),
        });
      } else {
        await col.updateOne(
          { agentId },
          { $set: { statut: 'parti', departAt: new Date(), agentName, updatedAt: new Date() } },
        );
      }

      await updateSacDashboard(interaction.client);
      return interaction.reply({
        content:   `👋 **${agentName}** a quitté l'entreprise. Son registre est conservé dans l'historique.`,
        ephemeral: true,
      });
    }

    // ── RETOUR ────────────────────────────────────────────────────────────────
    if (sub === 'retour') {
      const doc = await col.findOne({ agentId });

      if (!doc) {
        return interaction.reply({
          content:   `❌ **${agentName}** n'est pas dans le registre des départs.`,
          ephemeral: true,
        });
      }
      if (doc.statut === 'actif') {
        return interaction.reply({
          content:   `❌ **${agentName}** est déjà actif(ve).`,
          ephemeral: true,
        });
      }

      await col.updateOne(
        { agentId },
        { $set: { statut: 'actif', departAt: null, agentName, updatedAt: new Date() } },
      );

      await updateSacDashboard(interaction.client);
      return interaction.reply({
        content:   `✅ **${agentName}** est de retour dans l'entreprise.`,
        ephemeral: true,
      });
    }
  },

  // ─── Handler select donner ────────────────────────────────────────────────

  async handleSacDonnerSelect(interaction) {
    const pending = pendingSelects.get(interaction.user.id);
    if (!pending) {
      return interaction.update({ content: '❌ Session expirée. Relance la commande.', components: [] });
    }
    pendingSelects.delete(interaction.user.id);

    const { agentId, agentName } = pending;
    const selectedSacs = interaction.values;
    const col = getDB().collection('sac_registry');

    const doc      = await col.findOne({ agentId });
    const existing = doc?.sacs ?? [];
    const toAdd     = selectedSacs.filter(s => !existing.includes(s));
    const duplicate = selectedSacs.filter(s =>  existing.includes(s));

    if (toAdd.length > 0) {
      if (!doc) {
        await col.insertOne({
          agentId, agentName,
          sacs: toAdd, statut: 'actif',
          departAt: null, updatedAt: new Date(),
        });
      } else {
        await col.updateOne(
          { agentId },
          { $push: { sacs: { $each: toAdd } }, $set: { agentName, statut: 'actif', updatedAt: new Date() } },
        );
      }
      await updateSacDashboard(interaction.client);
    }

    const lines = [];
    if (toAdd.length > 0)     lines.push(`✅ Attribué à **${agentName}** : ${toAdd.join(', ')}`);
    if (duplicate.length > 0) lines.push(`⚠️ Déjà possédé : ${duplicate.join(', ')}`);

    return interaction.update({ content: lines.join('\n'), components: [] });
  },

  // ─── Handler select retirer ───────────────────────────────────────────────

  async handleSacRetirerSelect(interaction) {
    const pending = pendingSelects.get(interaction.user.id);
    if (!pending) {
      return interaction.update({ content: '❌ Session expirée. Relance la commande.', components: [] });
    }
    pendingSelects.delete(interaction.user.id);

    const { agentId, agentName } = pending;
    const selectedSacs = interaction.values;

    await getDB().collection('sac_registry').updateOne(
      { agentId },
      { $pullAll: { sacs: selectedSacs }, $set: { agentName, updatedAt: new Date() } },
    );

    await updateSacDashboard(interaction.client);
    return interaction.update({
      content:    `✅ Retiré de **${agentName}** : ${selectedSacs.join(', ')}`,
      components: [],
    });
  },

  // ─── Handler bouton Historique ────────────────────────────────────────────

  async handleSacHistorique(interaction) {
    const db     = getDB();
    const partis = await db.collection('sac_registry')
      .find({ statut: 'parti' })
      .sort({ departAt: -1 })
      .toArray();

    if (partis.length === 0) {
      return interaction.reply({ content: '📋 Aucun agent dans l\'historique.', ephemeral: true });
    }

    const lines = partis.map(a => {
      const dateDepart = a.departAt
        ? new Date(a.departAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'date inconnue';
      const sacsList = a.sacs.length > 0
        ? a.sacs.map(s => `> • ${s}`).join('\n')
        : '> *(aucun sac)*';
      return `🔴 **${a.agentName}** *(parti le ${dateDepart})*\n${sacsList}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('📋 Historique — Agents partis')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${partis.length} agent(s) dans l'historique` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

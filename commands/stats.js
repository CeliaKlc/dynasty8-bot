// ─── /stats — Statistiques de vente du mois en cours ─────────────────────────

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDB }      = require('../utils/db');
const { formatPrix } = require('../utils/formatters');
const agentCache     = require('../utils/agentCache');

const fmt = n => n != null ? `${formatPrix(String(Math.round(n)))}$` : '—';

const ROLE_DIRECTION_ID = '1375930527873368066';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Statistiques de vente — mois en cours et global'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.roles.cache.has(ROLE_DIRECTION_ID)) {
      return interaction.editReply({ content: '❌ Cette commande est réservée à la Direction.' });
    }

    const db = getDB();

    // Bornes du mois en cours
    const now         = new Date();
    const debutMois   = new Date(now.getFullYear(), now.getMonth(), 1);
    const finMois     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const filtreMois  = { statut: 'vendu', prixFinal: { $gt: 0 }, dateVente: { $gte: debutMois, $lte: finMois } };
    const filtreTotal = { statut: 'vendu', prixFinal: { $gt: 0 } };

    const [
      ventesMois,
      ventesTotal,
      caMoisAgg,
      caTotalAgg,
      parAgentMois,
      parTypeMois,
    ] = await Promise.all([
      db.collection('ventes_lbc').countDocuments(filtreMois),
      db.collection('ventes_lbc').countDocuments(filtreTotal),

      db.collection('ventes_lbc').aggregate([
        { $match: filtreMois },
        { $group: { _id: null, total: { $sum: '$prixFinal' }, moy: { $avg: '$prixFinal' } } },
      ]).toArray(),

      db.collection('ventes_lbc').aggregate([
        { $match: filtreTotal },
        { $group: { _id: null, total: { $sum: '$prixFinal' }, moy: { $avg: '$prixFinal' } } },
      ]).toArray(),

      // Agent le plus actif ce mois
      db.collection('ventes_lbc').aggregate([
        { $match: filtreMois },
        { $group: { _id: '$agentId', count: { $sum: 1 }, ca: { $sum: '$prixFinal' } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]).toArray(),

      // Type le plus vendu ce mois (solo uniquement)
      db.collection('ventes_lbc').aggregate([
        { $match: { ...filtreMois, type2: null, type3: null } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
      ]).toArray(),
    ]);

    const caMois   = caMoisAgg[0]  ?? { total: 0, moy: null };
    const caTotal  = caTotalAgg[0] ?? { total: 0, moy: null };

    // Résolution du meilleur agent
    let topAgentStr = '—';
    if (parAgentMois.length) {
      const top   = parAgentMois[0];
      const agent = agentCache.getAll().find(a => a.id === top._id);
      const name  = agent ? `${agent.emoji ? agent.emoji + ' ' : ''}${agent.name}` : `<@${top._id}>`;
      topAgentStr = `${name} — **${top.count}** vente${top.count > 1 ? 's' : ''} (${fmt(top.ca)})`;
    }

    // Top 3 types
    const topTypesStr = parTypeMois.length
      ? parTypeMois.map((t, i) => `${['🥇','🥈','🥉'][i]} ${t._id} — ${t.count} vente${t.count > 1 ? 's' : ''}`).join('\n')
      : '—';

    const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

    const embed = new EmbedBuilder()
      .setColor(0xC9A84C)
      .setTitle(`📊 Statistiques — ${moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1)}`)
      .addFields(
        {
          name:   `📅 Ce mois (${moisLabel})`,
          value:  [
            `**Ventes :** ${ventesMois}`,
            `**CA :** ${fmt(caMois.total)}`,
            `**Prix moyen :** ${fmt(caMois.moy)}`,
          ].join('\n'),
          inline: true,
        },
        {
          name:   '📈 Tous les temps',
          value:  [
            `**Ventes :** ${ventesTotal}`,
            `**CA total :** ${fmt(caTotal.total)}`,
            `**Prix moyen :** ${fmt(caTotal.moy)}`,
          ].join('\n'),
          inline: true,
        },
        { name: '​', value: '​', inline: false },
        {
          name:   '🏆 Meilleur agent ce mois',
          value:  topAgentStr,
          inline: false,
        },
        {
          name:   '🏠 Types les plus vendus ce mois',
          value:  topTypesStr,
          inline: false,
        },
      )
      .setFooter({ text: 'Basé sur les ventes confirmées (statut vendu) · Solo uniquement pour le classement des types' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── /reprisebien — Estimation du prix de reprise d'un bien ──────────────────

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { calculerReprise, SEUIL_FIABILITE }  = require('../utils/repriseManager');
const { formatPrix }                         = require('../utils/formatters');
const { BIENS }                              = require('../utils/annonceBuilder');

const TYPES_CHOICES = Object.keys(BIENS).map(t => ({ name: t, value: t }));

// Formate un nombre en prix lisible : 175750 → "175'750"
const fmt = n => formatPrix(String(Math.round(n)));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reprisebien')
    .setDescription('🏠 Estimer le prix de reprise d\'un bien avant achat')
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Type de bien à reprendre')
      .setRequired(true)
      .addChoices(...TYPES_CHOICES)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const type  = interaction.options.getString('type');
    const stats = await calculerReprise(type);

    // ── Aucune donnée du tout ─────────────────────────────────────────────────
    if (!stats) {
      return interaction.editReply({
        content:
          `❌ Aucune vente enregistrée pour **${type}**.\n` +
          `Impossible de calculer un prix de reprise sans historique de ventes.`,
      });
    }

    // ── Seulement des ventes en lot, aucune vente solo ────────────────────────
    if (stats.count === 0) {
      const n = stats.bundlesExclus;
      return interaction.editReply({
        content:
          `⚠️ Aucune vente **individuelle** de **${type}** enregistrée.\n` +
          `${n} vente${n > 1 ? 's' : ''} en lot incluant ce bien exist${n > 1 ? 'ent' : 'e'}, ` +
          `mais le prix couvre plusieurs biens à la fois — impossible d'isoler la valeur individuelle.`,
      });
    }

    // ── Construction de l'embed ───────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setTitle(`🏠 Reprise de bien — ${type}`)
      .setColor(stats.fiable ? 0x2ECC71 : 0xF39C12)
      .addFields(
        {
          name:   '📊 Base de calcul',
          value:  `${stats.count} vente${stats.count > 1 ? 's' : ''} analysée${stats.count > 1 ? 's' : ''}`,
          inline: true,
        },
        {
          name:   '💰 Prix médian de revente',
          value:  `**${fmt(stats.mediane)}$**`,
          inline: true,
        },
        {
          name:   '📉 Min  /  📈 Max observés',
          value:  `${fmt(stats.min)}$  →  ${fmt(stats.max)}$`,
          inline: true,
        },
        {
          name:  '✅ Prix de reprise maximum conseillé',
          value: [
            `🛡️ **Prudent** *(marge 20%)* → ≤ **${fmt(stats.reprises.prudent)}$**`,
            `⚖️ **Standard** *(marge 15%)* → ≤ **${fmt(stats.reprises.standard)}$**`,
            `🚀 **Optimiste** *(marge 10%)* → ≤ **${fmt(stats.reprises.optimiste)}$**`,
          ].join('\n'),
        },
      );

    // Note sur les lots exclus
    if (stats.bundlesExclus > 0) {
      const n = stats.bundlesExclus;
      embed.addFields({
        name:  'ℹ️ Ventes en lot exclues',
        value: `${n} vente${n > 1 ? 's' : ''} incluant **${type}** avec d'autres biens ${n > 1 ? 'ont été exclues' : 'a été exclue'} du calcul — le prix d'un lot ne reflète pas la valeur individuelle du bien.`,
        inline: false,
      });
    }

    if (!stats.fiable) {
      embed.setFooter({
        text: `⚠️ Données limitées (${stats.count} vente${stats.count > 1 ? 's' : ''} — seuil de fiabilité : ${SEUIL_FIABILITE}). Résultat indicatif.`,
      });
    } else {
      embed.setFooter({
        text: `Basé sur les ${stats.count} dernières ventes individuelles confirmées pour ce type de bien.`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

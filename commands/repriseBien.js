// ─── /reprisebien — Estimation du prix de reprise d'un bien ──────────────────

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  calculerReprise,
  calculerRepriseParZone,
  ZONES,
  SEUIL_FIABILITE,
} = require('../utils/repriseManager');
const { formatPrix } = require('../utils/formatters');
const { BIENS }      = require('../utils/annonceBuilder');

const TYPES_CHOICES = Object.keys(BIENS).map(t => ({ name: t, value: t }));

// Formate un nombre en prix lisible : 175750 → "175'750"
const fmt = n => formatPrix(String(Math.round(n)));

// Icônes de zone
const ZONE_ICONS = {
  'Nord':           '🔵',
  'Sud':            '🟡',
  'Quartier Prisé': '🟣',
  'Roxwood':        '🔴',
  'Las Venturas':   '🟠',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reprisebien')
    .setDescription('🏠 Estimer le prix de reprise d\'un bien avant achat')
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Type de bien à reprendre')
      .setRequired(true)
      .addChoices(...TYPES_CHOICES))
    .addStringOption(opt => opt
      .setName('zone')
      .setDescription('Zone du bien (optionnel — sans zone : tableau toutes zones)')
      .setRequired(false)
      .addChoices(...ZONES.map(z => ({ name: z, value: z })))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const type = interaction.options.getString('type');
    const zone = interaction.options.getString('zone') ?? null;

    // ── Vue zone spécifique ───────────────────────────────────────────────────
    if (zone) {
      const stats = await calculerReprise(type, zone);

      if (!stats) {
        return interaction.editReply({
          content:
            `❌ Aucune vente enregistrée pour **${type}** en zone **${zone}**.\n` +
            `Impossible de calculer un prix de reprise sans historique de ventes sur cette zone.\n\n` +
            `💡 Lance \`/reprisebien type:${type}\` sans zone pour voir le tableau complet.`,
        });
      }

      if (stats.count === 0) {
        const n = stats.bundlesExclus;
        return interaction.editReply({
          content:
            `⚠️ Aucune vente **individuelle** de **${type}** en zone **${zone}**.\n` +
            `${n} vente${n > 1 ? 's' : ''} en lot incluant ce bien exist${n > 1 ? 'ent' : 'e'} sur cette zone, ` +
            `mais le prix couvre plusieurs biens à la fois — impossible d'isoler la valeur individuelle.`,
        });
      }

      const icon  = ZONE_ICONS[zone] ?? '📍';
      const embed = new EmbedBuilder()
        .setTitle(`🏠 Reprise de bien — ${type}`)
        .setColor(stats.fiable ? 0x2ECC71 : 0xF39C12)
        .addFields(
          {
            name:   `${icon} Zone`,
            value:  `**${zone}**`,
            inline: true,
          },
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

      if (stats.bundlesExclus > 0) {
        const n = stats.bundlesExclus;
        embed.addFields({
          name:  'ℹ️ Ventes en lot exclues',
          value: `${n} vente${n > 1 ? 's' : ''} en lot sur cette zone ${n > 1 ? 'ont été exclues' : 'a été exclue'} du calcul.`,
          inline: false,
        });
      }

      embed.setFooter({
        text: stats.fiable
          ? `Basé sur les ${stats.count} dernières ventes individuelles en zone ${zone}.`
          : `⚠️ Données limitées (${stats.count} vente${stats.count > 1 ? 's' : ''} — seuil de fiabilité : ${SEUIL_FIABILITE}). Résultat indicatif.`,
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── Vue globale : tableau par zone ────────────────────────────────────────
    const parZone = await calculerRepriseParZone(type);
    const global  = parZone['_global'];

    // Vérifier qu'il y a au moins une zone avec des données
    const aucuneDonnee = ZONES.every(z => !parZone[z] || parZone[z].count === 0)
      && (!global || global.count === 0);

    if (aucuneDonnee) {
      return interaction.editReply({
        content:
          `❌ Aucune vente enregistrée pour **${type}** sur aucune zone.\n` +
          `Impossible de calculer un prix de reprise sans historique.`,
      });
    }

    // Construire le tableau par zone
    const lignesZones = ZONES.map(z => {
      const s    = parZone[z];
      const icon = ZONE_ICONS[z] ?? '📍';

      if (!s || s.count === 0) {
        return `${icon} **${z}** — *aucune vente enregistrée*`;
      }

      const fiabWarning = s.fiable ? '' : ' ⚠️';
      return [
        `${icon} **${z}**${fiabWarning} · ${s.count} vente${s.count > 1 ? 's' : ''} · médian **${fmt(s.mediane)}$**`,
        `→ 🛡️ ${fmt(s.reprises.prudent)}$  ⚖️ ${fmt(s.reprises.standard)}$  🚀 ${fmt(s.reprises.optimiste)}$`,
      ].join('\n');
    });

    // Résumé global (toutes zones confondues)
    let globalField = null;
    if (global && global.count > 0) {
      globalField = {
        name:  '📦 Toutes zones confondues',
        value: [
          `${global.count} vente${global.count > 1 ? 's' : ''} · médian **${fmt(global.mediane)}$**`,
          `🛡️ ${fmt(global.reprises.prudent)}$  ⚖️ ${fmt(global.reprises.standard)}$  🚀 ${fmt(global.reprises.optimiste)}$`,
        ].join('\n'),
        inline: false,
      };
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏠 Reprise de bien — ${type}`)
      .setColor(0x3498DB)
      .setDescription(
        `**Fourchettes de reprise par zone**\n` +
        `*(🛡️ Prudent 20%  ⚖️ Standard 15%  🚀 Optimiste 10%)*`,
      )
      .addFields({
        name:  '🗺️ Par zone',
        value: lignesZones.join('\n\n'),
      });

    if (globalField) embed.addFields(globalField);

    embed.setFooter({
      text:
        `⚠️ = moins de ${SEUIL_FIABILITE} ventes (résultat indicatif) · ` +
        `Lots exclus · Pour une zone précise : /reprisebien type:[...] zone:[...]`,
    });

    return interaction.editReply({ embeds: [embed] });
  },
};

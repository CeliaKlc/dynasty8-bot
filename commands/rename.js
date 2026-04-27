const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const agentCache = require('../utils/agentCache');

// ─── Index agents par slug (depuis le cache) ──────────────────────────────────
const lbcAgents    = () => agentCache.getAll().filter(a => a.slug && a.agre.includes('Gestionnaire LeBonCoin'));
const AGENTS       = () => Object.fromEntries(lbcAgents().map(a => [a.slug, a]));

// ─── Statuts ──────────────────────────────────────────────────────────────────
const STATUTS = {
  'attente':        { emoji: '⌛', label: 'En attente' },
  'vendu':          { emoji: '✅', label: 'Vendu' },
  'ne-sais-pas':    { emoji: '❓', label: 'Ne sais pas' },
  'fin-de-contrat': { emoji: '❌', label: 'Fin de contrat' },
};

const { toMathSansBold } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('✏️ Renommer le ticket avec agent, statut, numéro et description')
    .addStringOption(opt => opt
      .setName('agent')
      .setDescription('L\'agent responsable du dossier — tapez pour rechercher')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(opt => opt
      .setName('statut')
      .setDescription('Statut du dossier')
      .setRequired(true)
      .addChoices(
        { name: '⌛ En attente',     value: 'attente'        },
        { name: '✅ Vendu',          value: 'vendu'          },
        { name: '❓ Ne sais pas',    value: 'ne-sais-pas'    },
        { name: '❌ Fin de contrat', value: 'fin-de-contrat' },
      ))
    .addStringOption(opt => opt
      .setName('numero')
      .setDescription('Numéro de l\'annonce (ex: 1336)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Description du dossier (ex: Sacha-Rollay, Vente-Appartement...)')
      .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const agentKey    = interaction.options.getString('agent');
    const statutKey   = interaction.options.getString('statut');
    const numero      = interaction.options.getString('numero');
    const description = interaction.options.getString('description');

    const agent  = AGENTS()[agentKey];
    const statut = STATUTS[statutKey];

    // Format final : 🦊⌛𝟭𝟯𝟯𝟲_𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻
    const newName = description
      ? `${agent.emoji}${statut.emoji}${toMathSansBold(numero)}_${toMathSansBold(description)}`
      : `${agent.emoji}${statut.emoji}${toMathSansBold(numero)}`;

    try {
      await interaction.channel.setName(newName, `Renommé par ${interaction.user.tag}`);
    } catch (err) {
      console.error('[RENAME] Erreur :', err.message);

      if (err.status === 429 || err.code === 20028 || err.message?.toLowerCase().includes('rate limit')) {
        return interaction.editReply({
          content: '⏳ **Limite Discord atteinte** — un salon ne peut être renommé que **2 fois par 10 minutes**. Réessaie dans quelques minutes.',
        });
      }

      return interaction.editReply({
        content: '❌ Impossible de renommer le salon. Vérifie que le bot a la permission **Gérer les salons**.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xC9A84C)
      .setTitle('✏️ Ticket renommé')
      .addFields(
        { name: '👤 Agent',       value: `${agent.emoji} ${agent.name}`,   inline: true },
        { name: '📋 Statut',      value: `${statut.emoji} ${statut.label}`, inline: true },
        { name: '🔢 Numéro',      value: numero,                            inline: true },
        { name: '📝 Description', value: description ?? '—',               inline: true },
        { name: '🏷️ Résultat',   value: `\`${newName}\``,                  inline: false },
      )
      .setFooter({ text: 'Dynasty 8 • Gestion des dossiers' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};

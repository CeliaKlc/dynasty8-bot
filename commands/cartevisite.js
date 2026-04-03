const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Configuration des agents ────────────────────────────────────────────────
// Ajouter les autres agents ici au fur et à mesure
const AGENTS = {
  sacha: {
    nom: 'Sacha Rollay',
    emoji: '🦊',
    grade: 'Patronne',
    telephone: '50.93.60',
    aggregations: ['Las Venturas', 'Gestionnaire LBC'],
    photo: 'https://i.goopics.net/ostegf.png',
  },
};

// ─── Couleur Dynasty 8 ───────────────────────────────────────────────────────
const DYNASTY8_COLOR = 0xF5A623;

// ─── Construction de l'embed carte de visite ─────────────────────────────────
function buildCarteEmbed(agent) {
  const embed = new EmbedBuilder()
    .setTitle('🏢 CARTE DE VISITE')
    .setColor(DYNASTY8_COLOR)
    .addFields(
      { name: '👤 Agent', value: `${agent.emoji} **${agent.nom}**`, inline: true },
      { name: '💼 Grade', value: agent.grade, inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: '📞 Téléphone', value: `\`${agent.telephone}\``, inline: true },
    )
    .setFooter({ text: 'Dynasty 8 Real Estate' })
    .setTimestamp();

  if (agent.aggregations && agent.aggregations.length > 0) {
    embed.addFields({
      name: '🎖️ Agrégations',
      value: agent.aggregations.map(a => `• ${a}`).join('\n'),
      inline: false,
    });
  }

  if (agent.photo) {
    embed.setThumbnail(agent.photo);
  }

  return embed;
}

// ─── Génération des commandes (une par agent) ─────────────────────────────────
const commands = Object.entries(AGENTS).map(([key, agent]) => ({
  data: new SlashCommandBuilder()
    .setName(key)
    .setDescription(`Carte de visite de ${agent.nom}`),
  async execute(interaction) {
    await interaction.reply({ embeds: [buildCarteEmbed(agent)] });
  },
}));

module.exports = { commands };

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
const BLANK = '\u2800'; // caractère braille invisible — Discord ne supprime pas les lignes vides avec lui

// ─── Construction de l'embed carte de visite ─────────────────────────────────
function buildCarteEmbed(agent) {
  const lines = [
    BLANK,
    `${agent.emoji}  **${agent.nom}**`,
    BLANK,
    `**💼  G R A D E**`,
    `${agent.grade}`,
    BLANK,
    `**📞  T É L É P H O N E**`,
    `${agent.telephone}`,
  ];

  if (agent.aggregations && agent.aggregations.length > 0) {
    lines.push(BLANK);
    lines.push(`**🎖️  A G R É G A T I O N S**`);
    lines.push(agent.aggregations.join('  ·  '));
  }

  lines.push(BLANK);

  const embed = new EmbedBuilder()
    .setTitle('✦   C A R T E   D E   V I S I T E   ✦')
    .setColor(DYNASTY8_COLOR)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Dynasty 8 Real Estate' });

  if (agent.photo) {
    embed.setImage(agent.photo);
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

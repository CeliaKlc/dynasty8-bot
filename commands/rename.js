const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const STATUTS = {
  attente:          { emoji: '⌛', label: 'En attente' },
  vendu:            { emoji: '✅', label: 'Vendu' },
  'ne-sais-pas':    { emoji: '❓', label: 'Ne sais pas' },
  'fin-de-contrat': { emoji: '❌', label: 'Fin de contrat' },
};

// Convertit le texte en Mathematical Sans-Serif Bold (Unicode)
function toMathSansBold(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + (code - 65)); // A-Z
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97)); // a-z
    if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7EC + (code - 48)); // 0-9
    return char; // espaces, tirets, etc. conservés tels quels
  }).join('');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('✏️ Renommer le salon avec un statut et une police stylisée')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => opt
      .setName('statut')
      .setDescription('Statut du dossier')
      .setRequired(true)
      .addChoices(
        { name: '⌛ En attente',      value: 'attente' },
        { name: '✅ Vendu',           value: 'vendu' },
        { name: '❓ Ne sais pas',     value: 'ne-sais-pas' },
        { name: '❌ Fin de contrat',  value: 'fin-de-contrat' },
      )
    )
    .addStringOption(opt => opt
      .setName('nom')
      .setDescription('Nouveau nom du salon (optionnel — conserve le nom actuel si vide)')
      .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const statutKey = interaction.options.getString('statut');
    const nomOption = interaction.options.getString('nom');
    const statut = STATUTS[statutKey];
    const channel = interaction.channel;

    // Utilise le nom fourni ou le nom actuel du salon (sans ancien emoji en début)
    const baseName = (nomOption || channel.name).replace(/^[\p{Emoji}\s・]+/u, '').trim();
    const newName = `${statut.emoji}・${toMathSansBold(baseName)}`;

    try {
      await channel.setName(newName, `Statut mis à jour : ${statut.label} par ${interaction.user.tag}`);
    } catch (err) {
      console.error('[RENAME] Erreur lors du renommage :', err.message);
      return interaction.editReply({
        content: '❌ Impossible de renommer le salon. Vérifie que le bot a la permission **Gérer les salons**.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xC9A84C)
      .setTitle('✏️ Salon renommé')
      .addFields(
        { name: 'Statut',    value: `${statut.emoji} ${statut.label}`, inline: true },
        { name: 'Agent',     value: `<@${interaction.user.id}>`,       inline: true },
        { name: 'Nouveau nom', value: `\`${newName}\``,                inline: false },
      )
      .setFooter({ text: 'Dynasty 8 • Gestion des dossiers' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};

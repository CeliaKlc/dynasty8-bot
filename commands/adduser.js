const { SlashCommandBuilder, PermissionFlagsBits, OverwriteType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adduser')
    .setDescription('Ajouter un membre dans le ticket actuel')
    .addUserOption(opt => opt
      .setName('membre')
      .setDescription('Membre à ajouter au ticket')
      .setRequired(true)),

  async execute(interaction) {
    const membre = interaction.options.getMember('membre');

    if (!membre) {
      return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    }

    try {
      await interaction.channel.permissionOverwrites.edit(membre.id, {
        ViewChannel:        true,
        SendMessages:       true,
        ReadMessageHistory: true,
      });

      return interaction.reply({ content: `✅ ${membre} a été ajouté au ticket.` });
    } catch (err) {
      console.error('❌ Erreur adduser :', err);
      return interaction.reply({ content: '❌ Impossible d\'ajouter ce membre. Vérifie les permissions du bot.', ephemeral: true });
    }
  },
};

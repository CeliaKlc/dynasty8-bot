const ROLE_EMPLOYE_ID = '917744433682849802';

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Vérification du rôle employé
    if (!interaction.member.roles.cache.has(ROLE_EMPLOYE_ID)) {
      return interaction.reply({
        content: '❌ Tu dois avoir le rôle **Employé** pour utiliser cette commande.',
        ephemeral: true,
      });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`❌ Erreur commande ${interaction.commandName}:`, error);
      const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};

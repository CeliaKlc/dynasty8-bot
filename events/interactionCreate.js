const { handleTicketButton, handleTicketClose, handleTicketClaim } = require('../commands/tickets');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // === COMMANDES SLASH ===
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
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
      return;
    }

    // === BOUTONS ===
    if (interaction.isButton()) {
      const { customId } = interaction;

      // Boutons d'ouverture de ticket
      if (['ticket_achat', 'ticket_location', 'ticket_vente', 'ticket_rdv'].includes(customId)) {
        await handleTicketButton(interaction, customId);
        return;
      }

      // Fermeture de ticket
      if (customId === 'ticket_close') {
        await handleTicketClose(interaction);
        return;
      }

      // Prise en charge d'un ticket
      if (customId === 'ticket_claim') {
        await handleTicketClaim(interaction);
        return;
      }
    }
  },
};

const { handleAnnonceButton, handleAnnonceModal } = require('../commands/annonce');

const ROLES_AUTORISES = [
  '917744433682849802', // Employé
  '1375930527873368066', // Direction
];

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // === BOUTONS ===
    if (interaction.isButton()) {
      // Boutons d'annonce — accessibles à tous
      if (interaction.customId.startsWith('annonce_acheter_') || interaction.customId.startsWith('annonce_visiter_')) {
        try {
          await handleAnnonceButton(interaction);
        } catch (err) {
          console.error('❌ Erreur bouton annonce :', err);
          const msg = { content: '❌ Une erreur est survenue.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
        return;
      }

      // Bouton clôture de ticket — accessible à tous, demande confirmation
      if (interaction.customId === 'ticket_cloturer') {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        try {
          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_cloturer_confirmer')
              .setLabel('✅ Clôturer définitivement')
              .setStyle(ButtonStyle.Danger),
          );
          await interaction.reply({
            content: `🔒 ${interaction.member} souhaite clôturer ce ticket.\n\nUn agent peut confirmer la clôture définitive ci-dessous.`,
            components: [confirmRow],
          });
        } catch (err) {
          console.error('❌ Erreur demande clôture ticket :', err);
        }
        return;
      }

      // Bouton confirmation clôture définitive — agents uniquement
      if (interaction.customId === 'ticket_cloturer_confirmer') {
        const aAcces = ROLES_AUTORISES.some(id => interaction.member.roles.cache.has(id));
        if (!aAcces) {
          return interaction.reply({ content: '❌ Seuls les agents peuvent clôturer définitivement un ticket.', ephemeral: true });
        }
        try {
          await interaction.reply({ content: '🔒 Ticket clôturé. Le salon va être supprimé...' });
          setTimeout(() => interaction.channel.delete().catch(console.error), 3000);
        } catch (err) {
          console.error('❌ Erreur clôture définitive ticket :', err);
        }
        return;
      }

      return;
    }

    // === MODALS ===
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('annonce_modal_')) {
        try {
          await handleAnnonceModal(interaction);
        } catch (err) {
          console.error('❌ Erreur modal annonce :', err);
          const msg = { content: '❌ Une erreur est survenue lors de la création du ticket.', ephemeral: true };
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
          else await interaction.reply(msg).catch(() => {});
        }
      }
      return;
    }

    // === COMMANDES SLASH ===
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Vérification des rôles autorisés
    const aAcces = ROLES_AUTORISES.some(id => interaction.member.roles.cache.has(id));
    if (!aAcces) {
      return interaction.reply({
        content: '❌ Tu dois avoir le rôle **Employé** ou **Direction** pour utiliser cette commande.',
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

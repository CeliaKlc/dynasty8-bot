const { handleAnnonceButton } = require('../commands/annonce');

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

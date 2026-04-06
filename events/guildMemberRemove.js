const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CATEGORIE_TICKETS_ID = '993616675670851659';

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    // Chercher tous les salons tickets de la catégorie où ce membre a des permissions
    const ticketChannels = member.guild.channels.cache.filter(ch =>
      ch.parentId === CATEGORIE_TICKETS_ID &&
      ch.isTextBased() &&
      ch.permissionOverwrites.cache.has(member.id)
    );

    for (const [, channel] of ticketChannels) {
      try {
        // Supprimer les permissions du membre (déjà parti, nettoyage)
        await channel.permissionOverwrites.delete(member.id).catch(() => {});

        const embedFerme = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setDescription(`🚪 Ce ticket a été **fermé automatiquement** car le client a quitté le serveur.`);

        const embedControls = new EmbedBuilder()
          .setColor(0x95A5A6)
          .setTitle('``Support team ticket controls``');

        const controlRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_supprimer')
            .setLabel('⛔Supprimer')
            .setStyle(ButtonStyle.Secondary),
        );

        await channel.send({ embeds: [embedFerme, embedControls], components: [controlRow] });
        await channel.setName('closed').catch(() => {});

        console.log(`[TICKET] 🔒 Ticket ${channel.name} fermé automatiquement — membre ${member.user.tag} a quitté.`);
      } catch (err) {
        console.error(`[TICKET] ❌ Erreur fermeture automatique (départ membre) :`, err.message);
      }
    }
  },
};

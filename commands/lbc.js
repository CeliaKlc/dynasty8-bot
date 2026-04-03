const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Messages LBC en attente de confirmation (messageId → channelId)
const lbcPendingMessages = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lbc')
    .setDescription('📋 Envoyer les conditions LBC Dynasty 8 dans le ticket')
    .addUserOption(opt => opt
      .setName('client')
      .setDescription('Mentionner le client concerné')
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const client = interaction.options.getUser('client');

    const embedPrincipal = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🏔️ Vendre votre bien avec Le-Bon-Coin')
      .setDescription(
        `La plateforme **LBC du Dynasty 8** vous permet de vendre votre bien immobilier en toute simplicité, avec un accompagnement professionnel de A à Z.\n` +
        `\n` +
        `🧳 **Ce que nous prenons en charge**\n` +
        `• Mise en avant optimale de votre bien\n` +
        `• Création et gestion de l'annonce\n` +
        `• Photos professionnelles et communication complète\n` +
        `• Recherche d'acheteurs, visites, négociation et organisation des rendez-vous\n` +
        `• Suivi jusqu'à la vente et remise des clés\n` +
        `• Vidéo personnalisée pour certains biens selon leur valeur\n` +
        `\n` +
        `📋 **Contrat d'exclusivité**\n` +
        `• Signature d'un **contrat d'exclusivité obligatoire**\n` +
        `• Durée minimale : **1 mois**, sans date de fin\n` +
        `• La **commission revient au Dynasty 8**, même si vous trouvez vous-même un acheteur pendant la période d'exclusivité\n` +
        `\n` +
        `💰 **Frais & commission**\n` +
        `• **Frais de dossier à régler immédiatement** :\n` +
        `  ∘ 3 500$ (Sud)\n` +
        `  ∘ 5 000$ (Nord)\n` +
        `• **Commission de vente : 10%** *sauf partenaire particulier*\n` +
        `• Frais de changement de propriétaire offerts\n` +
        `\n` +
        `Dynasty 8 est ravi de vous accompagner dans la vente de votre bien immobilier. 🏔️`
      );

    const embedConfirmation = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('Confirmation')
      .setDescription(
        `Si vous êtes d'accord avec toutes ces conditions, nous vous laissons mettre une coche ✅ sinon à clôturer le ticket ${client}.`
      );

    const msg = await interaction.channel.send({ embeds: [embedPrincipal, embedConfirmation] });
    await msg.react('✅');

    // Enregistrer le message pour l'event messageReactionAdd
    lbcPendingMessages.set(msg.id, interaction.channel.id);

    await interaction.editReply({ content: '✅ Conditions LBC envoyées !' });
  },

  lbcPendingMessages,
};

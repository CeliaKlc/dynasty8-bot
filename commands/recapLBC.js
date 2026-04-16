const { SlashCommandBuilder } = require('discord.js');
const { avecDollar, formatPrix } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recaplbc')
    .setDescription('📋 Créer un récap de vente LBC')

    // ── Obligatoires ──────────────────────────────────────────────────────────
    .addStringOption(opt => opt
      .setName('annonce')
      .setDescription('Numéro de l\'annonce LBC (ex: 1337)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('prix_depart')
      .setDescription('Prix de départ (ex: 210\'000)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('negociation')
      .setDescription('Prix de négociation (ex: 200\'000), si pas mettre N/A')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('commission')
      .setDescription('Commission (ex: 10)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Type du bien (ex: Garage 6 places)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('adresse')
      .setDescription('Adresse du bien (ex: Rockford Hills - Olympic Freeway 3)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('etage')
      .setDescription('Étage du bien (ex: 3) si pas mettre N/A')
      .setRequired(true))
    .addBooleanOption(opt => opt
      .setName('frais_dossier')
      .setDescription('Frais de dossier effectués ?')
      .setRequired(true))
    .addBooleanOption(opt => opt
      .setName('double_cles')
      .setDescription('Double clés effectué ?')
      .setRequired(true))
    .addAttachmentOption(opt => opt
      .setName('gps')
      .setDescription('Capture GPS du bien')
      .setRequired(true))
    .addAttachmentOption(opt => opt
      .setName('carte_identite')
      .setDescription('Carte d\'identité du client')
      .setRequired(true))

    // ── Optionnels ────────────────────────────────────────────────────────────
    .addStringOption(opt => opt
      .setName('type_2')
      .setDescription('Type du 2ème bien (ex: Garage 2 places)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('adresse_2')
      .setDescription('Adresse du 2ème bien (ex: Rockford Hills - Olympic Freeway 1)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('etage_2')
      .setDescription('Étage du 2ème bien (ex: 5)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('type_3')
      .setDescription('Type du 3ème bien (ex: Garage 2 places)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('adresse_3')
      .setDescription('Adresse du 2ème bien (ex: Rockford Hills - Olympic Freeway 1)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('etage_3')
      .setDescription('Étage du 2ème bien (ex: 5)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('description')
      .setDescription('Possède une salle à sac, garage possible, etc')
      .setRequired(false)),
    

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const annonce      = interaction.options.getString('annonce');
    const prixDepart   = interaction.options.getString('prix_depart');
    const negociation  = interaction.options.getString('negociation');
    const commission   = interaction.options.getString('commission');
    const type         = interaction.options.getString('type');
    const adresse      = interaction.options.getString('adresse');
    const etage        = interaction.options.getString('etage');
    const fraisDossier = interaction.options.getBoolean('frais_dossier');
    const doubleCles   = interaction.options.getBoolean('double_cles');
    const gps          = interaction.options.getAttachment('gps');
    const carteId      = interaction.options.getAttachment('carte_identite');

    const type2        = interaction.options.getString('type_2');
    const adresse2     = interaction.options.getString('adresse_2');
    const etage2       = interaction.options.getString('etage_2');
    const type3        = interaction.options.getString('type_3');
    const adresse3     = interaction.options.getString('adresse_3');
    const etage3       = interaction.options.getString('etage_3');
    const description  = interaction.options.getString('description');

    // ── Construction du message ───────────────────────────────────────────────
    const lignes = [
      `======= **Annonce LBC : ${annonce}** ========`,
      ``,
      `**Prix de départ :** ${avecDollar(formatPrix(prixDepart))}`,
    ];

    if (negociation) lignes.push(`**Négociation :** ${avecDollar(formatPrix(negociation))}`);

    lignes.push(`**Commission :** ${commission}%`);

    lignes.push(``);

    // ── Bien 1 ────────────────────────────────────────────────────────────────
    lignes.push(`**Type :** ${type}`);
    lignes.push(`**Adresse :** ${adresse}`);
    if (etage) lignes.push(`**Étage :** ${etage}`);

    // ── Bien 2 (optionnel) ────────────────────────────────────────────────────
    if (type2) {
      lignes.push(``);
      lignes.push(`+`);
      lignes.push(``);
      lignes.push(`**Type :** ${type2}`);
      if (adresse2) lignes.push(`**Adresse :** ${adresse2}`);
      if (etage2)   lignes.push(`**Étage :** ${etage2}`);
    }

    // ── Bien 3 (optionnel) ────────────────────────────────────────────────────
    if (type3) {
      lignes.push(``);
      lignes.push(`+`);
      lignes.push(``);
      lignes.push(`**Type :** ${type3}`);
      if (adresse3) lignes.push(`**Adresse :** ${adresse3}`);
      if (etage3)   lignes.push(`**Étage :** ${etage3}`);
    }

    // ── Description (optionnel) ────────────────────────────────────────────────────
    lignes.push(``);
    if (description) {
      lignes.push(`**Description**`);
      lignes.push(`${description}`);
    }

    lignes.push(``);
    lignes.push(`**Frais de dossier :** ${fraisDossier ? '✅' : '❌'}`);
    lignes.push(`**Double clés effectué :** ${doubleCles ? '✅' : '❌'}`);

    const contenu = lignes.join('\n');

    await interaction.channel.send({ content: contenu, files: [gps.url, carteId.url] });
    await interaction.editReply({ content: '✅ Récap LBC publié !' });
  },
};

const { SlashCommandBuilder } = require('discord.js');
const { avecDollar, formatPrix } = require('../utils/formatters');
const { getDB }     = require('../utils/db');
const { logAction } = require('../utils/actionLogger');
const { ZONES }     = require('../utils/repriseManager');

// Convertit "210'000", "210000", "210.000$", "210 000$" en number, null si N/A ou invalide
const parsePrice = str => {
  if (!str || /^n\/a$/i.test(str.trim())) return null;
  const n = parseInt(String(str).replace(/[$'\s,.]/g, ''), 10);
  return isNaN(n) ? null : n;
};

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
      .setName('zone')
      .setDescription('Zone du bien')
      .setRequired(true)
      .addChoices(...ZONES.map(z => ({ name: z, value: z }))))
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Type du bien — tapez pour rechercher')
      .setRequired(true)
      .setAutocomplete(true))
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
      .setDescription('Type du 2ème bien — tapez pour rechercher')
      .setRequired(false)
      .setAutocomplete(true))
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
      .setDescription('Type du 3ème bien — tapez pour rechercher')
      .setRequired(false)
      .setAutocomplete(true))
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

    const annonce      = interaction.options.getString('annonce').trim();
    const prixDepart   = interaction.options.getString('prix_depart');
    const negociation  = interaction.options.getString('negociation');
    const commission   = interaction.options.getString('commission');
    const zone         = interaction.options.getString('zone');
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
    lignes.push(`**Zone :** ${zone}`);

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

    // Sauvegarder le lien numero → ticket (pour que /bye retrouve le salon d'annonce)
    try {
      await getDB().collection('annonce_links').updateOne(
        { numero: annonce },
        { $set: { ticketChannelId: interaction.channel.id, updatedAt: new Date() } },
        { upsert: true },
      );
    } catch (e) { console.error('[RECLBC] Erreur sauvegarde lien :', e.message); }

    // Enregistrer la vente (upsert — idempotent)
    // Si un recap en cours existe déjà pour ce numéro, on le met à jour au lieu
    // de créer un doublon. Cela couvre le cas : message supprimé + /recaplbc refait.
    let recapMisAJour = false;
    let dbEchec       = false;
    try {
      const result = await getDB().collection('ventes_lbc').updateOne(
        { annonce, statut: 'en_cours' },
        {
          $set: {
            ticketChannelId: interaction.channel.id,
            zone,
            // Bien principal
            type,    adresse,    etage:    etage    || null,
            // Bien 2 (optionnel)
            type2:    type2    || null,
            adresse2: adresse2 || null,
            etage2:   etage2   || null,
            // Bien 3 (optionnel)
            type3:    type3    || null,
            adresse3: adresse3 || null,
            etage3:   etage3   || null,
            // Prix
            prixDepart:      parsePrice(prixDepart),
            prixNegociation: parsePrice(negociation), // seuil de négo, pas le prix final
            commission:      parsePrice(commission),
            // Méta
            agentId:   interaction.user.id,
            dateRecap: new Date(),
          },
          $setOnInsert: {
            // 'statut: en_cours' est déjà inclus via le filtre
            prixFinal: null, // renseigné par /bye
            dateVente: null,
          },
        },
        { upsert: true },
      );
      recapMisAJour = result.upsertedCount === 0; // 0 = entrée existante mise à jour
    } catch (e) {
      console.error('[RECLBC] Erreur sauvegarde vente_lbc :', e.message);
      dbEchec = true;
    }

    // Log action
    await logAction({
      type:      'recap_lbc',
      actorId:   interaction.user.id,
      actorName: interaction.member?.displayName ?? interaction.user.username,
      details: {
        annonce,
        type,
        adresse,
        prixDepart: parsePrice(prixDepart),
      },
    });

    // ── Avertissements ────────────────────────────────────────────────────────
    const prixDepartNum = parsePrice(prixDepart);
    const prixNegoNum   = parsePrice(negociation);
    let replyContent = '✅ Récap LBC publié !';

    if (dbEchec) {
      replyContent =
        `✅ Récap LBC publié dans le ticket.\n\n` +
        `🚨 **Erreur critique** : la sauvegarde en base de données a échoué — ce récap **n'apparaîtra pas sur le panel** et ne sera **pas comptabilisé dans les stats**.\n` +
        `Pour réparer : fais \`/editrecaplbc\` sur ce message (sans rien changer) — ça recréera l'entrée automatiquement.`;
    } else if (recapMisAJour) {
      replyContent += `\n\n🔄 **Note** : un récap existait déjà pour l'annonce **n°${annonce}** — l'entrée a été **mise à jour** (aucun doublon créé). Si c'était une erreur, les anciennes données ont été remplacées par celles-ci.`;
    }
    if (!dbEchec && prixDepartNum && prixNegoNum && prixNegoNum > prixDepartNum) {
      replyContent += `\n\n⚠️ **Attention** : le prix de négociation (**${formatPrix(negociation)}$**) est supérieur au prix de départ (**${formatPrix(prixDepart)}$**). Vérifie les montants.`;
    }

    await interaction.editReply({ content: replyContent });
  },
};

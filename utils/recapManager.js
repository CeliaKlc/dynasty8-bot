// ─── Récap Hebdomadaire — Envoi Discord ──────────────────────────────────────
// Utilise exactement le même format que /recapsemaine

const { getDB }     = require('./db');
const { buildRecap, GRADE_ROLE_IDS, GRADES_CHOICES } = require('../commands/recapSemaine');
const { logAction } = require('./actionLogger');

async function sendRecap(client, recap) {
  try {
    const channel = await client.channels.fetch(recap.canalId).catch(() => null);
    if (!channel?.isTextBased()) {
      console.error(`[RECAP] Salon introuvable ou non-textuel : ${recap.canalId}`);
      await getDB().collection('recap_hebdo').updateOne(
        { id: recap.id },
        { $set: { statut: 'erreur', errorMsg: 'Salon Discord introuvable' } },
      );
      return;
    }

    const content = buildRecap({
      informations:  recap.informations  ?? '',
      departs:       recap.departs       ?? '',
      felicitations: recap.felicitations ?? '',
      chiffres:      recap.chiffres      ?? '',
      top3:          recap.top3          ?? '',
      data: {
        channelId:     recap.canalId,
        cdp:           recap.cdp           ?? null,
        vendeur:       recap.vendeur       ?? null,
        loueur:        recap.loueur        ?? null,
        // Tableau d'arrivées (web) ou arrivée unique (slash command)
        arrivees: recap.arrivees ?? (recap.arrivee
          ? [{ agent: recap.arrivee, grade: recap.arrivee_grade ?? null }]
          : []),
        // Tableau de rôles supplémentaires (web) ou rôle unique (slash command)
        roles_sup:     recap.roles_sup ?? (recap.role_sup ? [recap.role_sup] : []),
        fel_1_agent:   recap.fel_1_agent   ?? null,
        fel_1_grade:   recap.fel_1_grade   ?? null,
        fel_2_agent:   recap.fel_2_agent   ?? null,
        fel_2_grade:   recap.fel_2_grade   ?? null,
        fel_3_agent:   recap.fel_3_agent   ?? null,
        fel_3_grade:   recap.fel_3_grade   ?? null,
      },
    });

    const msg = await channel.send({ content, allowedMentions: { parse: ['roles', 'users'] } });

    await getDB().collection('recap_hebdo').updateOne(
      { id: recap.id },
      { $set: { statut: 'envoyé', publishedAt: new Date(), messageId: msg.id } },
    );
    await logAction({
      type:      'recap_semaine',
      actorId:   recap.createdBy ?? 'web',
      actorName: recap.createdBy ?? 'Panel web',
      details:   { canalId: recap.canalId, recapId: recap.id },
    });
    console.log(`[RECAP] ✅ Récap envoyé : ${recap.id}`);
  } catch (err) {
    console.error(`[RECAP] ❌ Erreur envoi ${recap.id} :`, err.message);
    await getDB().collection('recap_hebdo').updateOne(
      { id: recap.id },
      { $set: { statut: 'erreur', errorMsg: err.message } },
    ).catch(() => {});
  }
}

async function editRecap(client, recap) {
  try {
    if (!recap.messageId || !recap.canalId) {
      console.error(`[RECAP] Impossible d'éditer ${recap.id} : messageId ou canalId manquant`);
      return;
    }
    const channel = await client.channels.fetch(recap.canalId).catch(() => null);
    if (!channel?.isTextBased()) {
      console.error(`[RECAP] Salon introuvable : ${recap.canalId}`);
      return;
    }
    const msg = await channel.messages.fetch(recap.messageId).catch(() => null);
    if (!msg) {
      console.error(`[RECAP] Message introuvable (${recap.messageId}) dans le salon ${recap.canalId}`);
      return;
    }
    const content = buildRecap({
      informations:  recap.informations  ?? '',
      departs:       recap.departs       ?? '',
      felicitations: recap.felicitations ?? '',
      chiffres:      recap.chiffres      ?? '',
      top3:          recap.top3          ?? '',
      data: {
        channelId:   recap.canalId,
        cdp:         recap.cdp           ?? null,
        vendeur:     recap.vendeur       ?? null,
        loueur:      recap.loueur        ?? null,
        arrivees:    recap.arrivees ?? (recap.arrivee
          ? [{ agent: recap.arrivee, grade: recap.arrivee_grade ?? null }]
          : []),
        roles_sup:   recap.roles_sup ?? (recap.role_sup ? [recap.role_sup] : []),
        fel_1_agent: recap.fel_1_agent   ?? null,
        fel_1_grade: recap.fel_1_grade   ?? null,
        fel_2_agent: recap.fel_2_agent   ?? null,
        fel_2_grade: recap.fel_2_grade   ?? null,
        fel_3_agent: recap.fel_3_agent   ?? null,
        fel_3_grade: recap.fel_3_grade   ?? null,
      },
    });
    await msg.edit({ content, allowedMentions: { parse: ['roles', 'users'] } });
    console.log(`[RECAP] ✅ Récap édité : ${recap.id}`);
  } catch (err) {
    console.error(`[RECAP] ❌ Erreur édition ${recap.id} :`, err.message);
  }
}

module.exports = { sendRecap, editRecap, GRADE_ROLE_IDS, GRADES_CHOICES };

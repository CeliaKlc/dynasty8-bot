// ─── Récap Hebdomadaire — Envoi Discord ──────────────────────────────────────
// Utilise exactement le même format que /recapsemaine

const { getDB }     = require('./db');
const { buildRecap, GRADE_ROLE_IDS, GRADES_CHOICES } = require('../commands/recapSemaine');

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

    await channel.send({ content, allowedMentions: { parse: ['roles', 'users'] } });

    await getDB().collection('recap_hebdo').updateOne(
      { id: recap.id },
      { $set: { statut: 'envoyé', publishedAt: new Date() } },
    );
    console.log(`[RECAP] ✅ Récap envoyé : ${recap.id}`);
  } catch (err) {
    console.error(`[RECAP] ❌ Erreur envoi ${recap.id} :`, err.message);
    await getDB().collection('recap_hebdo').updateOne(
      { id: recap.id },
      { $set: { statut: 'erreur', errorMsg: err.message } },
    ).catch(() => {});
  }
}

module.exports = { sendRecap, GRADE_ROLE_IDS, GRADES_CHOICES };

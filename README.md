# 🏠 Dynasty 8 — Bot Discord
### Agence Immobilière fictive | Serveur Baylife RP

Bot Discord dédié à l'agence immobilière **Dynasty 8** sur le serveur GTA RP **Baylife RP**.
Il centralise la gestion des annonces LBC, des récapitulatifs de vente, des tickets clients et des rendez-vous agents.

---

## 📋 Vue d'ensemble des commandes

| Commande | Description |
|---|---|
| `/annonce` | Publier une annonce immobilière avec boutons Acheter / Visiter |
| `/editannonce` | Modifier les options d'une annonce déjà publiée |
| `/recaplbc` | Créer un récapitulatif de vente LBC |
| `/editrecaplbc` | Modifier un récap LBC déjà envoyé |
| `/rename` | Renommer un salon ticket (agent + statut + numéro) |
| `/rdv créer` | Planifier un rendez-vous avec rappels automatiques |
| `/rdv liste` | Voir tous les rendez-vous à venir |
| `/rdv annuler` | Annuler un rendez-vous planifié |

> Toutes les commandes sont réservées aux membres ayant le rôle **Employé** ou **Direction**.

---

## 🏠 `/annonce`

Publie une annonce immobilière formatée dans le salon courant, avec un ping automatique du rôle `@Notification-LBC`.

Le message généré est structuré en 4 sections : **STOCKAGE**, **INTÉRIEUR**, **LES +**, et optionnellement **DÉTAILS**. Le stockage et les caractéristiques intérieures sont remplis automatiquement selon le type de bien sélectionné.

### Options

| Option | Type | Requis | Description |
|---|---|---|---|
| `numero` | texte | ✅ | Numéro de référence de l'annonce (ex : `1337`) |
| `type` | choix | ✅ | Type de bien — 22 choix (Appartement Simple, Villa, Entrepôt, Garage 6 places…) |
| `transaction` | choix | ✅ | `Vente` ou `Location` |
| `quartier` | texte | ✅ | Quartier ou adresse du bien |
| `image` | fichier | ✅ | Photo du bien |
| `garage_1` | choix | ❌ | 1er garage (2 / 6 / 10 / 10 luxe / 26 places / Loft) |
| `garage_2` | choix | ❌ | 2ème garage (mêmes choix) |
| `garage_luxe` | nombre | ❌ | Nombre de garages 10 places de luxe — **Villa de Luxe / Maison de Luxe uniquement** (1 à 4) |
| `salle_a_sac` | choix | ❌ | Salle à sac simple, +1 extension ou +2 extensions |
| `jardin` | booléen | ❌ | Jardin inclus |
| `piscine` | booléen | ❌ | Piscine incluse |
| `terrasse` | booléen | ❌ | Terrasse incluse |
| `etageres` | nombre | ❌ | Nombre d'étagères — **Entrepôt uniquement** (1 à 25, 1 étagère = 600 unités) |
| `description` | texte | ❌ | Informations supplémentaires libres |

> **Règles métier :**
> - `garage_luxe` → uniquement pour les types **Villa de Luxe** et **Maison de Luxe**
> - `garage 26 places` → uniquement pour le type **Agence**
> - `etageres` → uniquement pour le type **Entrepôt**

### Système de tickets

Chaque annonce publiée comporte deux boutons visibles par tous :

- **🏠 Acheter ce bien** / **👁️ Visiter le bien**

Quand un utilisateur clique sur un bouton, un **formulaire Discord** s'ouvre avec 3 champs :
1. Nom Prénom
2. Numéro de téléphone
3. Disponibilités *(le terme "maintenant" ne constitue pas une disponibilité)*

À la soumission, un **salon ticket privé** est créé automatiquement avec :
- Les informations du client visibles dans un embed
- L'accès restreint au client + aux agents (Employé / Direction)

**Cycle de vie du ticket :**

| Action | Qui | Résultat |
|---|---|---|
| 🔒 Fermer le ticket | Client ou Agent | Confirmation éphémère (Fermer / Annuler) |
| Confirmer la fermeture | Client ou Agent | Client éjecté du salon, embed de clôture envoyé |
| 🔓 Ré-ouvrir le ticket | Agents uniquement | Accès du client rétabli |
| ⛔ Supprimer | Agents uniquement | Salon supprimé après 3 secondes |

---

## ✏️ `/editannonce`

Modifie les options d'une annonce déjà publiée, sans toucher au type, au quartier ou à l'image d'origine.

Les valeurs non fournies sont **conservées automatiquement** depuis l'annonce existante.
Les garages et la salle à sac proposent une option **"❌ Supprimer"** pour retirer l'élément.

```
/editannonce message_id:123456789 garage_1:6 piscine:true
```

| Option | Type | Description |
|---|---|---|
| `message_id` | texte | ID du message à modifier *(clic droit → Copier l'identifiant)* |
| `garage_1` | choix | Modifier ou supprimer le 1er garage |
| `garage_2` | choix | Modifier ou supprimer le 2ème garage |
| `garage_luxe` | nombre | Modifier le nombre de garages de luxe |
| `salle_a_sac` | choix | Modifier ou supprimer la salle à sac |
| `jardin` | booléen | Activer / désactiver |
| `piscine` | booléen | Activer / désactiver |
| `terrasse` | booléen | Activer / désactiver |
| `etageres` | nombre | Modifier le nombre d'étagères |
| `description` | texte | Modifier la description |

---

## 📋 `/recaplbc`

Génère un récapitulatif de vente formaté dans le salon courant, avec les pièces jointes (GPS + carte d'identité).

Supporte jusqu'à **3 biens** dans un seul récap. Si un 2ème ou 3ème bien est renseigné, un `+` est automatiquement inséré entre eux.

### Options

| Option | Type | Requis | Description |
|---|---|---|---|
| `annonce` | texte | ✅ | Numéro d'annonce LBC |
| `prix_depart` | texte | ✅ | Prix de départ (ex : `210'000$`) |
| `commission` | texte | ✅ | Commission (ex : `10%`) |
| `type` | texte | ✅ | Type du 1er bien |
| `adresse` | texte | ✅ | Adresse du 1er bien |
| `frais_dossier` | booléen | ✅ | Frais de dossier effectués |
| `double_cles` | booléen | ✅ | Double clés effectué |
| `gps` | fichier | ✅ | Capture GPS |
| `carte_identite` | fichier | ✅ | Carte d'identité du client |
| `negociation` | texte | ❌ | Prix négocié |
| `etage` | texte | ❌ | Étage du 1er bien |
| `type_2` | texte | ❌ | Type du 2ème bien |
| `adresse_2` | texte | ❌ | Adresse du 2ème bien |
| `etage_2` | texte | ❌ | Étage du 2ème bien |
| `type_3` | texte | ❌ | Type du 3ème bien |
| `adresse_3` | texte | ❌ | Adresse du 3ème bien |
| `etage_3` | texte | ❌ | Étage du 3ème bien |
| `description` | texte | ❌ | Informations complémentaires (salle à sac, garage, etc.) |

---

## ✏️ `/editrecaplbc`

Modifie un récap LBC déjà envoyé. Seuls les champs fournis sont mis à jour, les autres sont conservés. Les pièces jointes (GPS, carte d'identité) sont préservées automatiquement.

```
/editrecaplbc message_id:123456789 prix_depart:220'000$ negociation:210'000$
```

Accepte les mêmes champs que `/recaplbc`, tous optionnels, plus le `message_id` obligatoire.

---

## 🏷️ `/rename`

Renomme le salon ticket courant avec un format standardisé : `EMOJI_AGENT + EMOJI_STATUT + NUMÉRO + _DESCRIPTION`.

Exemple : `🦊✅𝟭𝟯𝟯𝟲_𝗦𝗮𝗰𝗵𝗮-𝗥𝗼𝗹𝗹𝗮𝘆`

### Options

| Option | Type | Requis | Description |
|---|---|---|---|
| `agent` | choix | ✅ | Agent responsable — sélection dans la liste |
| `statut` | choix | ✅ | `⌛ En attente` / `✅ Vendu` / `❓ Ne sais pas` / `❌ Fin de contrat` |
| `numero` | texte | ✅ | Numéro de l'annonce |
| `description` | texte | ❌ | Description libre (ex : `Sacha-Rollay`, `Vente-Appartement`) |

### Agents disponibles

| Nom | Emoji |
|---|---|
| Sacha Rollay | 🦊 |
| Ely Rollay | 🦦 |
| Marco Romanov | 🐻 |
| John Russet | 🦍 |
| Hain Ergy | 🐲 |
| Joy Lutz | 🐍 |
| Maksim Anatolyevich | 🦁 |
| John Macafey | 🐳 |

> Pour ajouter un agent : ouvre `commands/rename.js` et ajoute une entrée dans `AGENTS` + un choix dans `addChoices()`.

---

## 📅 `/rdv`

Gère les rendez-vous agents/clients avec rappels automatiques.

### `/rdv créer`

| Option | Type | Requis | Description |
|---|---|---|---|
| `client` | mention | ✅ | Le client concerné |
| `date` | texte | ✅ | `aujourd'hui`, `demain`, ou `JJ/MM/AAAA` |
| `heure` | texte | ✅ | Format `18h30` ou `18:30` |
| `description` | texte | ❌ | Objet du rendez-vous |
| `rappel` | choix | ❌ | 15 min / 30 min (défaut) / 1h / À l'heure pile uniquement |

→ Crée un embed de confirmation avec ping des deux parties, puis envoie un rappel avant l'heure et un rappel à l'heure pile.

### `/rdv liste`

Affiche tous les rendez-vous à venir, triés par date.

### `/rdv annuler`

Annule un rendez-vous via son identifiant (visible dans l'embed de confirmation).

---

## 🚀 Installation

### Étape 1 — Créer le bot sur Discord

1. Va sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → nom : `Dynasty 8`
3. Onglet **Bot** → **Reset Token** → copie le token
4. Active dans **Privileged Gateway Intents** :
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. **OAuth2 → URL Generator** → coche `bot` + `applications.commands`, permissions `Administrator` → invite le bot

---

### Étape 2 — Base de données MongoDB Atlas

Les rendez-vous sont stockés sur MongoDB pour persister entre les redémarrages.

1. Crée un compte sur [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Crée un cluster gratuit **M0**
3. **Database Access** → ajoute un utilisateur avec mot de passe
4. **Network Access** → `Allow Access from Anywhere` (`0.0.0.0/0`)
5. **Connect → Drivers** → copie l'URI :
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
   ```

---

### Étape 3 — Héberger sur Railway

1. Connecte-toi sur [railway.app](https://railway.app) avec GitHub
2. **New Project → Deploy from GitHub repo** → sélectionne ce dépôt
3. Onglet **Variables** → ajoute :

| Variable | Valeur |
|---|---|
| `TOKEN` | Token du bot Discord |
| `CLIENT_ID` | Application ID (Developer Portal) |
| `GUILD_ID` | ID du serveur Discord |
| `CHANNEL_LOGS_ID` | ID du salon de logs *(optionnel)* |
| `MONGODB_URI` | URI MongoDB Atlas complète |
| `TZ` | `Europe/Paris` |

> ⚠️ `TZ=Europe/Paris` est obligatoire pour que les rappels de RDV se déclenchent à la bonne heure.

Railway redéploie automatiquement à chaque push sur la branche principale.

---

### Étape 4 — Configurer les IDs dans le code

Certaines valeurs sont hardcodées directement dans les fichiers de commandes.

**`commands/annonce.js`**
```js
const CATEGORIE_TICKETS_ID      = 'ID_DE_LA_CATEGORIE_TICKETS';
const ROLE_NOTIFICATIONS_LBC_ID = 'ID_DU_ROLE_NOTIFICATIONS_LBC';
const ROLES_AUTORISES = [
  'ID_ROLE_EMPLOYE',
  'ID_ROLE_DIRECTION',
];
```

**`commands/rename.js`** — pour ajouter un agent :
```js
const AGENTS = {
  'sacha-rollay': { emoji: '🦊', nom: 'Sacha Rollay' },
  // ajouter ici...
};
```
Et dans `addChoices()` :
```js
{ name: 'Prénom Nom 🐾', value: 'prenom-nom' },
```

---

## ❓ Problèmes fréquents

**Le bot ne répond pas aux commandes slash ?**
→ Attends 1-2 minutes après le démarrage. Les commandes slash prennent du temps à s'enregistrer auprès de Discord.

**`@Notification-LBC` ne ping pas dans les annonces ?**
→ Vérifie que `ROLE_NOTIFICATIONS_LBC_ID` dans `commands/annonce.js` correspond à l'ID exact du rôle sur ton serveur (clic droit sur le rôle → Copier l'identifiant, mode développeur requis).

**Les rappels de RDV ne se déclenchent pas à la bonne heure ?**
→ Vérifie que la variable `TZ=Europe/Paris` est bien définie dans Railway.

**MongoDB ne se connecte pas ?**
→ Vérifie que l'URI dans `MONGODB_URI` contient bien le bon user/password et que l'IP `0.0.0.0/0` est autorisée dans Atlas Network Access.

**`/editannonce` ou `/editrecaplbc` ne trouve pas le message ?**
→ Utilise la commande dans **le même salon** que le message à modifier. Active le mode développeur (Paramètres → Avancés) pour pouvoir copier les IDs de messages.

**`/rename` — le salon ne se renomme pas ?**
→ Discord limite les renommages à **2 fois par 10 minutes** par salon. Réessaie quelques minutes plus tard.

---

*Dynasty 8 — Baylife RP*

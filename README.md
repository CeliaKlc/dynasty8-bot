# 🏠 Dynasty 8 — Bot Discord
### Agence Immobilière fictive | Serveur Baylife RP

Bot Discord dédié à l'agence immobilière **Dynasty 8** sur le serveur GTA RP **Baylife RP**.
Il centralise la gestion des annonces LBC, des récapitulatifs de vente, des tickets clients, des rendez-vous agents et des cartes de visite.

---

## 📋 Vue d'ensemble des commandes

| Commande | Description | Accès |
|---|---|---|
| `/annonce` | Publier une annonce immobilière avec tickets automatiques | Employé / Direction |
| `/editannonce` | Modifier une annonce déjà publiée | Employé / Direction |
| `/recaplbc` | Créer un récapitulatif de vente LBC | Employé / Direction |
| `/editrecaplbc` | Modifier un récap LBC déjà envoyé | Employé / Direction |
| `/rename` | Renommer un salon ticket | Employé / Direction |
| `/renameannonce` | Renommer un salon annonce | Employé / Direction |
| `/reduc` | Publier une offre de réduction temporaire | Employé / Direction |
| `/rdv créer` | Planifier un rendez-vous avec rappels automatiques | Employé / Direction |
| `/rdv liste` | Voir les rendez-vous à venir (filtre par agent possible) | Employé / Direction |
| `/rdv annuler` | Annuler un rendez-vous planifié | Employé / Direction |
| `/prepatchnote` | Publier un pré-patchnote dans le salon dédié | Direction uniquement |
| `/attente add` | Ajouter un client en liste d'attente | Employé / Direction |
| `/attente update` | Modifier la fiche d'un client | Employé / Direction |
| `/attente remove` | Retirer un client de la liste | Employé / Direction |
| `/attente list` | Lister les clients en attente | Employé / Direction |
| `/bien` | Enregistrer un bien disponible et trouver les clients correspondants | Employé / Direction |
| `/carte` | Afficher sa carte d'agent Dynasty 8 en service | Employé / Direction |
| `/adduser` | Ajouter un membre dans le ticket actuel | Employé / Direction |
| `/embed` | Envoyer un message embed personnalisé dans un ou plusieurs salons | Administrateur |

---

## 🏠 `/annonce`

Publie une annonce immobilière formatée dans le salon courant, avec un ping automatique du rôle `@Notification-LBC`.

Le message généré est structuré en 4 sections : **STOCKAGE**, **INTÉRIEUR**, **LES +**, et optionnellement **DÉTAILS**. Le stockage et les caractéristiques intérieures sont remplis automatiquement selon le type de bien sélectionné.

Les garages identiques sont automatiquement regroupés (ex : deux Garages 2 places → `2 × Garages 2 places`) dans le titre, dans les LES+ et dans le stockage.

### Options

| Option | Type | Requis | Description |
|---|---|---|---|
| `numero` | texte | ✅ | Numéro de référence de l'annonce (ex : `1337`) |
| `type` | choix | ✅ | Type de bien — 24 choix (Appartement Simple, Villa, Duplex, Entrepôt…) |
| `transaction` | choix | ✅ | `Vente` ou `Location` |
| `quartier` | texte | ✅ | Quartier ou adresse du bien |
| `image` | fichier | ✅ | Photo du bien |
| `agent` | choix | ✅ | Agent en charge de cette annonce |
| `garage_1` | choix | ❌ | 1er garage (2 / 6 / 10 / 26 places / Loft) |
| `garage_2` | choix | ❌ | 2ème garage (mêmes choix) |
| `garage_luxe` | nombre | ❌ | Garages 10 places de luxe — **Villa/Maison de Luxe uniquement** (1 à 4) |
| `salle_a_sac` | choix | ❌ | Salle à sac simple, +1 extension ou +2 extensions |
| `jardin` | booléen | ❌ | Jardin inclus |
| `piscine` | booléen | ❌ | Piscine incluse |
| `terrasse` | nombre | ❌ | Nombre de terrasses (min 1) |
| `balcon` | nombre | ❌ | Nombre de balcons (min 1) |
| `etageres` | nombre | ❌ | Étagères — **Entrepôt uniquement** (1 à 25, 1 étagère = 600 unités) |
| `description` | texte | ❌ | Informations supplémentaires libres |

### Système de tickets

Chaque annonce publiée comporte deux boutons :

- **🏠 Acheter ce bien** / **👁️ Visiter le bien**

Quand un utilisateur clique, un **formulaire** s'ouvre (Nom Prénom, Téléphone, Disponibilités). À la soumission, un **salon ticket privé** est créé automatiquement :
- Nommé avec l'emoji de l'agent + `⌛` + numéro (ex : `🦊⌛𝟭𝟯𝟰𝟳_𝗔𝗰𝗵𝗲𝘁𝗲𝗿`)
- L'embed de bienvenue s'affiche avec les infos du client
- L'agent assigné est **pingé** avec un message d'assignation accordé à son genre

**Cycle de vie du ticket :**

| Action | Qui | Résultat |
|---|---|---|
| 🔒 Fermer le ticket | Client ou Agent | Confirmation éphémère (Fermer / Annuler) |
| Confirmer la fermeture | Client ou Agent | Client éjecté, embed de clôture envoyé |
| 🔓 Ré-ouvrir le ticket | Agents uniquement | Accès du client rétabli |
| ⛔ Supprimer | Agents uniquement | Salon supprimé après 3 secondes |

---

## ✏️ `/editannonce`

Modifie les options d'une annonce déjà publiée. Les valeurs non fournies sont **conservées automatiquement**. Utiliser la valeur `❌ Supprimer` sur une option optionnelle (garage, salle à sac) la retire de l'annonce.

```
/editannonce message_id:123456789 type:Villa quartier:Vinewood garage_1:6
```

| Option | Type | Description |
|---|---|---|
| `message_id` | texte | ID du message à modifier *(clic droit → Copier l'identifiant)* |
| `agent` | choix | Changer l'agent en charge |
| `type` | choix | Changer le type de bien (met à jour l'intérieur et le stockage automatiquement) |
| `image` | texte (URL) | Remplacer l'image de l'annonce |
| `quartier` | texte | Modifier le quartier / emplacement |
| `garage_1` | choix | Modifier ou supprimer le 1er garage |
| `garage_2` | choix | Modifier ou supprimer le 2ème garage |
| `garage_luxe` | nombre | Modifier le nombre de garages de luxe |
| `salle_a_sac` | choix | Modifier ou supprimer la salle à sac |
| `jardin` | booléen | Activer / désactiver |
| `piscine` | booléen | Activer / désactiver |
| `terrasse` | nombre | Nombre de terrasses (0 pour supprimer) |
| `balcon` | nombre | Nombre de balcons (0 pour supprimer) |
| `etageres` | nombre | Modifier le nombre d'étagères |
| `description` | texte | Modifier la description |

---

## 📋 `/recaplbc`

Génère un récapitulatif de vente formaté avec les pièces jointes (GPS + carte d'identité). Supporte jusqu'à **3 biens** dans un seul récap.

Les prix (`prix_depart`, `negociation`) sont automatiquement formatés avec des apostrophes comme séparateurs de milliers : `1600000` → `1'600'000$`. Si le prix est déjà formaté ou contient du texte (`N/A`), la valeur est conservée telle quelle.

| Option | Type | Requis | Description |
|---|---|---|---|
| `annonce` | texte | ✅ | Numéro d'annonce LBC |
| `prix_depart` | texte | ✅ | Prix de départ (ex : `1600000` ou `1'600'000`) |
| `negociation` | texte | ✅ | Prix négocié ou `N/A` |
| `commission` | texte | ✅ | Commission (ex : `10`) |
| `type` | texte | ✅ | Type du 1er bien |
| `adresse` | texte | ✅ | Adresse du 1er bien |
| `etage` | texte | ✅ | Étage du 1er bien ou `N/A` |
| `frais_dossier` | booléen | ✅ | Frais de dossier effectués |
| `double_cles` | booléen | ✅ | Double clés effectué |
| `gps` | fichier | ✅ | Capture GPS |
| `carte_identite` | fichier | ✅ | Carte d'identité du client |
| `type_2` / `adresse_2` / `etage_2` | texte | ❌ | 2ème bien |
| `type_3` / `adresse_3` / `etage_3` | texte | ❌ | 3ème bien |
| `description` | texte | ❌ | Infos complémentaires |

---

## ✏️ `/editrecaplbc`

Modifie un récap LBC déjà envoyé. Seuls les champs fournis sont mis à jour ; les pièces jointes non remplacées sont **préservées automatiquement**. Le formatage automatique des prix (apostrophes) s'applique également lors de la modification.

```
/editrecaplbc message_id:123456789 prix_depart:1600000 negociation:1500000
```

---

## 🏷️ `/rename`

Renomme le salon ticket courant avec un format standardisé.

Exemple : `🦊✅𝟭𝟯𝟯𝟲_𝗦𝗮𝗹𝗼𝗻`

| Option | Type | Requis | Description |
|---|---|---|---|
| `agent` | choix | ✅ | Agent responsable |
| `statut` | choix | ✅ | `⌛ En attente` / `✅ Vendu` / `❓ Ne sais pas` / `❌ Fin de contrat` |
| `numero` | texte | ✅ | Numéro de l'annonce |
| `description` | texte | ❌ | Description libre |

---

## 🏷️ `/renameannonce`

Renomme un salon annonce avec un format standardisé.

Exemple : `✅┃𝟭𝟯𝟰𝟲┃𝗕𝘂𝗿𝗲𝗮𝘂_𝗗𝗲𝗹-𝗣𝗲𝗿𝗿𝗼`

| Option | Type | Requis | Description |
|---|---|---|---|
| `statut` | choix | ✅ | `✅ A vendre` ou `❌ Vendu` |
| `numero` | texte | ✅ | Numéro de référence |
| `type` | texte | ✅ | Type de bien |
| `secteur` | texte | ✅ | Secteur / quartier |

---

## 🔥 `/reduc`

Publie une annonce de réduction de prix temporaire avec ping `@Notification-LBC`. Le message est **automatiquement supprimé** après la durée choisie, même en cas de redémarrage du bot (persisté en MongoDB).

| Option | Type | Requis | Description |
|---|---|---|---|
| `prix` | texte | ✅ | Nouveau prix réduit |
| `duree` | choix | ✅ | 6h / 12h / 24h / 48h / 72h / 7 jours |

---

## 📋 `/prepatchnote`

Publie un pré-patchnote dans le salon dédié. **Réservé à la Direction.**

Un modal s'ouvre avec deux champs :
- **Version / Titre** (ex : `v1.3.0 — Cartes de visite & Tickets`)
- **Contenu** (jusqu'à 4000 caractères, markdown Discord supporté)

L'embed est publié dans le salon configuré avec le nom de l'auteur en footer.

---

## 📅 `/rdv`

Gère les rendez-vous agents/clients avec rappels automatiques. Les données sont persistées en MongoDB pour survivre aux redémarrages.

### `/rdv créer`

| Option | Type | Requis | Description |
|---|---|---|---|
| `client` | mention | ✅ | Le client concerné |
| `date` | texte | ✅ | `aujourd'hui`, `demain`, ou `JJ/MM/AAAA` |
| `heure` | texte | ✅ | Format `18h30` ou `18:30` |
| `description` | texte | ❌ | Objet du rendez-vous |
| `lieu` | texte | ❌ | Lieu du rendez-vous (ex : `Agence Dynasty 8, Rockford Hills`) |
| `rappel` | choix | ❌ | 15 min / 30 min (défaut) / 1h / À l'heure pile uniquement |

→ Ping des deux parties à la création. Si un pré-rappel est configuré, il est envoyé X minutes avant, puis **automatiquement supprimé** quand le rappel principal se déclenche à l'heure pile.

### `/rdv liste`

| Option | Type | Description |
|---|---|---|
| `agent` | mention | Filtrer les rendez-vous d'un agent en particulier (laisser vide = tous les agents) |

→ Affiche les RDV à venir triés par date. Quand un filtre agent est appliqué, le titre de l'embed change en `📅 Rendez-vous de [Nom]` et la colonne Agent disparaît des entrées.

### `/rdv annuler`

Annule un rendez-vous via son identifiant (affiché dans le message de confirmation à la création).

| Option | Type | Requis | Description |
|---|---|---|---|
| `id` | texte | ✅ | Identifiant du RDV (ex : `rdv_1714123456789`) |

---

## 📋 `/attente`

Gère la liste d'attente des clients recherchant un bien. Le dashboard est automatiquement mis à jour dans le salon configuré.

### `/attente add`

| Option | Type | Requis | Description |
|---|---|---|---|
| `client` | mention | ✅ | Le client à ajouter |
| `ticket` | mention salon | ✅ | Le salon ticket du client |
| `budget_max` | nombre | ✅ | Budget maximum du client |
| `notes` | texte | ❌ | Notes complémentaires |

→ Ouvre un sélecteur de types de bien (max 5), puis un modal pour saisir le secteur de chaque type librement. Un récap est envoyé dans le ticket.

### `/attente update`

Modifie la fiche d'un client existant (budget, notes, types de bien et secteurs).

### `/attente remove`

Retire un client de la liste d'attente et met à jour le dashboard.

### `/attente list`

| Option | Type | Description |
|---|---|---|
| `type` | choix | Filtrer par type de bien |
| `zone` | texte | Filtrer par secteur (recherche partielle, insensible à la casse) |

---

## 🏠 `/bien`

Enregistre un bien disponible et affiche automatiquement les clients en liste d'attente dont le budget et les critères correspondent.

| Option | Type | Requis | Description |
|---|---|---|---|
| `type` | choix | ✅ | Type de bien (24 choix) |
| `zone` | texte | ✅ | Secteur du bien (texte libre) |
| `prix` | nombre | ✅ | Prix du bien |

→ Affiche les clients dont le budget max ≥ prix et dont un bien recherché correspond au type + secteur (recherche insensible à la casse).

---

## 🪪 `/carte`

Affiche la carte d'agent Dynasty 8 de l'agent qui exécute la commande. La carte est détectée automatiquement via le Discord ID.

La carte contient : nom, titre, numéro de téléphone RP (en bloc de code), habilitations, et photo de l'agent. Si la carte est **supprimée manuellement** dans Discord, les timers de rappel/suppression sont automatiquement annulés.

> Pour ajouter ou modifier un agent, éditer le tableau `CARTES` dans `commands/carte.js`.

---

## ➕ `/adduser`

Ajoute un membre au salon ticket courant avec les permissions **Voir le salon**, **Envoyer des messages** et **Voir l'historique**.

| Option | Type | Requis | Description |
|---|---|---|---|
| `membre` | mention | ✅ | Le membre à ajouter |

---

## 📨 `/embed`

Envoie un message embed personnalisé dans un ou plusieurs salons. **Réservé aux Administrateurs.**

Ouvre un modal pour saisir le titre, le contenu (markdown Discord supporté, jusqu'à 4000 caractères) et une couleur hexadécimale optionnelle.

| Option | Type | Description |
|---|---|---|
| `salon1` à `salon10` | mention salon | Salons de destination (jusqu'à 10). Si aucun n'est spécifié, le message est envoyé dans le salon courant. |

---

## 🚀 Installation

### Étape 1 — Créer le bot sur Discord

1. Va sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → nom : `Dynasty 8`
3. Onglet **Bot** → **Reset Token** → copie le token
4. Active dans **Privileged Gateway Intents** : `Server Members Intent` + `Message Content Intent`
5. **OAuth2 → URL Generator** → `bot` + `applications.commands`, permissions `Administrator` → invite le bot

### Étape 2 — Base de données MongoDB Atlas

1. Crée un cluster gratuit **M0** sur [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Database Access** → utilisateur avec mot de passe
3. **Network Access** → `0.0.0.0/0`
4. **Connect → Drivers** → copie l'URI `mongodb+srv://...`

### Étape 3 — Héberger sur Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Onglet **Variables** :

| Variable | Valeur |
|---|---|
| `TOKEN` | Token du bot Discord |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | ID du serveur Discord |
| `MONGODB_URI` | URI MongoDB Atlas |
| `TZ` | `Europe/Paris` |

> ⚠️ `TZ=Europe/Paris` est obligatoire pour que les rappels de RDV se déclenchent à la bonne heure.

### Étape 4 — IDs à configurer dans le code

**`commands/annonce.js`**
```js
const CATEGORIE_TICKETS_ID = 'ID_CATEGORIE_TICKETS';
const ROLES_TICKETS_LBC    = ['ID_ROLE_GESTIONNAIRE_LBC', 'ID_ROLE_RESPONSABLE_LBC'];
const ROLES_AUTORISES      = ['ID_ROLE_EMPLOYE', 'ID_ROLE_DIRECTION'];
```

**`utils/annonceBuilder.js`** — Agents (IDs Discord + emojis + genre) et rôle de notification :
```js
const ROLE_NOTIFICATIONS_LBC_ID = 'ID_ROLE_NOTIFICATIONS_LBC';

const AGENTS = [
  { name: 'Sacha Rollay', id: 'ID_DISCORD', emoji: '🦊', feminin: true },
  // ...
];
```

**`commands/prepatchnote.js`**
```js
const SALON_PREPATCHNOTE_ID = 'ID_SALON_PREPATCHNOTE';
```

**`utils/attenteManager.js`**
```js
const DASHBOARD_CHANNEL_ID = 'ID_SALON_DASHBOARD_ATTENTE';
```

---

## ❓ Problèmes fréquents

**Le bot ne répond pas aux commandes slash ?**
→ Attends 1-2 minutes. Les commandes slash prennent du temps à s'enregistrer.

**`@Notification-LBC` ne ping pas ?**
→ Vérifie `ROLE_NOTIFICATIONS_LBC_ID` dans `utils/annonceBuilder.js` et que le message est envoyé avec `allowedMentions: { parse: ['roles'] }`.

**L'agent n'est pas pingé à l'ouverture du ticket ?**
→ Vérifie que l'ID Discord de l'agent est bien renseigné dans `AGENTS` dans `utils/annonceBuilder.js`.

**Les rappels de RDV ne se déclenchent pas à la bonne heure ?**
→ Vérifie que `TZ=Europe/Paris` est défini dans Railway.

**MongoDB ne se connecte pas ?**
→ Vérifie l'URI dans `MONGODB_URI` et que `0.0.0.0/0` est autorisé dans Atlas Network Access.

**`/editannonce` ou `/editrecaplbc` ne trouve pas le message ?**
→ Utilise la commande dans **le même salon** que le message. Active le mode développeur pour copier les IDs.

**`/rename` — le salon ne se renomme pas ?**
→ Discord limite les renommages à **2 fois par 10 minutes** par salon.

---

*Dynasty 8 — Baylife RP*

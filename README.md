# 🏠 Dynasty 8 — Bot Discord
### Agence Immobilière | Baylife RP

---

## 📋 Fonctionnalités

| Commande | Description | Qui peut l'utiliser |
|---|---|---|
| `/panel-tickets` | Affiche le panel de tickets | Admins |
| `/annonce` | Publie une annonce immobilière | Agentes |
| `/client dossier` | Voir le dossier d'un client | Agentes |
| `/client statut` | Mettre à jour un dossier | Agentes |
| `/client liste` | Voir tous les dossiers actifs | Agentes |

---

## 🚀 INSTALLATION ÉTAPE PAR ÉTAPE

### ÉTAPE 1 — Créer le bot sur Discord

1. Va sur https://discord.com/developers/applications
2. Clique sur **"New Application"** → donne-lui le nom **"Dynasty 8"**
3. Va dans l'onglet **"Bot"** → clique **"Add Bot"**
4. Clique **"Reset Token"** → copie le token (tu en auras besoin plus tard)
5. Active ces options dans **"Privileged Gateway Intents"** :
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. Va dans **"OAuth2"** → **"URL Generator"**
   - Coche : `bot` + `applications.commands`
   - Dans Bot Permissions, coche : `Administrator`
   - Copie le lien généré et ouvre-le pour inviter le bot sur ton serveur

---

### ÉTAPE 2 — Récupérer les IDs Discord

Pour récupérer un ID : **Paramètres Discord → Avancés → Active "Mode développeur"**
Ensuite, fais **clic droit** sur un élément → **"Copier l'identifiant"**

Tu auras besoin de :
- ✅ **ID du serveur** (clic droit sur le serveur)
- ✅ **ID du bot** (depuis le Developer Portal → "Application ID")
- ✅ **ID du canal #annonces** (où les annonces seront postées)
- ✅ **ID du canal #tickets** (où le panel sera affiché)
- ✅ **ID de la catégorie tickets** (la catégorie qui contiendra les salons de tickets)
- ✅ **ID du rôle Agente** (le rôle de tes agentes)
- ✅ **ID du canal #logs** (optionnel, pour les logs)

---

### ÉTAPE 3 — Héberger sur Railway (gratuit)

1. Crée un compte sur https://railway.app (connecte-toi avec GitHub)
2. Clique **"New Project"** → **"Deploy from GitHub repo"**
3. Upload les fichiers du bot sur GitHub (ou utilise Railway's file upload)
4. Dans Railway, va dans **"Variables"** et ajoute toutes ces variables :

```
TOKEN          = (le token de ton bot)
CLIENT_ID      = (l'Application ID de ton bot)
GUILD_ID       = (l'ID de ton serveur)
CHANNEL_ANNONCES_ID  = (ID du canal annonces)
CHANNEL_TICKETS_ID   = (ID du canal tickets panel)
CATEGORIE_TICKETS_ID = (ID de la catégorie tickets)
ROLE_AGENTE_ID       = (ID du rôle agente)
CHANNEL_LOGS_ID      = (ID du canal logs — optionnel)
```

5. Railway va lancer le bot automatiquement !

> 💡 **Alternative simple** : Tu peux aussi utiliser https://replit.com
> Crée un Repl, uploade les fichiers, et ajoute les variables dans "Secrets"

---

### ÉTAPE 4 — Configurer les canaux Discord

Crée ces canaux sur ton serveur si ce n'est pas déjà fait :

```
📁 DYNASTY 8
  ├── 📢 #annonces-immobilier
  ├── 🎫 #ouvrir-un-ticket
  └── 📋 #logs-bot (optionnel)

📁 TICKETS (catégorie)
  └── (les tickets seront créés ici automatiquement)
```

---

### ÉTAPE 5 — Lancer le panel de tickets

Une fois le bot en ligne, tape dans ton salon `#ouvrir-un-ticket` :

```
/panel-tickets
```

Le bot va afficher le beau panel avec les boutons automatiquement ! 🎉

---

## 🛠️ Utilisation quotidienne

### Publier une annonce
```
/annonce type:Maison transaction:Vente quartier:Rockford Hills prix:250 000$ pieces:5 description:Belle villa avec piscine...
```

### Voir le dossier d'un client
```
/client dossier membre:@NomDuClient
```

### Mettre à jour un statut
```
/client statut membre:@NomDuClient reference:ID_TICKET statut:Conclu note:Bien vendu !
```

### Voir tous les dossiers actifs
```
/client liste
```

---

## ❓ Problèmes fréquents

**Le bot ne répond pas aux commandes slash ?**
→ Attends 1-2 minutes après le démarrage, les commandes prennent du temps à s'enregistrer.

**"Canal des annonces introuvable" ?**
→ Vérifie que l'ID dans les variables correspond bien à ton canal.

**Les tickets ne se créent pas ?**
→ Vérifie que l'ID de la catégorie tickets est correct et que le bot a les permissions Administrator.

---

*Dynasty 8 — Baylife RP | Bot créé avec ❤️*

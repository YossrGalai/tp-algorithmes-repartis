# 🖧 TP — Simulation d’Algorithmes Répartis
## Exclusion Mutuelle, Élection & Snapshot Distribué

> Projet académique réalisé avec **React** pour la simulation visuelle et interactive d’algorithmes répartis.

---

# 📖 Présentation

Les systèmes répartis permettent à plusieurs processus ou machines de coopérer à travers un réseau afin d’exécuter des tâches de manière coordonnée.

Dans ce projet, nous avons développé une simulation interactive d’algorithmes répartis permettant :

- l’accès sécurisé à une ressource partagée,
- l’élection d’un coordinateur,
- la gestion des communications entre processus,
- l’observation des échanges de messages en temps réel,
- la capture de l’état global d’un système distribué grâce au snapshot distribué.

Le projet inclut une interface développée avec **React** afin de visualiser les événements, les messages échangés et le comportement des processus distribués.

---

# 🎯 Objectifs du projet

Ce TP a pour objectifs :

✅ Comprendre les principes des systèmes distribués  
✅ Étudier les mécanismes d’exclusion mutuelle  
✅ Simuler des algorithmes d’élection  
✅ Observer les échanges de messages entre processus  
✅ Capturer l’état global d’un système distribué  
✅ Comparer les performances des algorithmes répartis  
✅ Visualiser les scénarios distribués avec React

---

# 🧠 Algorithmes implémentés

## 🔐 Exclusion Mutuelle

- Ricart–Agrawala Algorithm
- Token Ring Algorithm

## 👑 Élection

- Bully Algorithm
- Ring Election Algorithm

## 📸 Snapshot Distribué

- Chandy–Lamport Snapshot Algorithm

---

# ⚙️ Fonctionnalités

Le projet permet :

- 🔹 Création de plusieurs processus distribués
- 🔹 Simulation des communications réseau
- 🔹 Visualisation des échanges de messages
- 🔹 Gestion d’une ressource critique
- 🔹 Simulation d’un jeton circulaire
- 🔹 Détection de panne d’un leader
- 🔹 Élection automatique d’un nouveau coordinateur
- 🔹 Capture de l’état global du système
- 🔹 Journalisation des événements
- 🔹 Interface graphique interactive avec React

---

# 🏗️ Architecture du projet

Le système est composé de plusieurs processus simulés communicant entre eux via des échanges de messages.

Chaque processus possède :

- un identifiant (ID),
- un état,
- une file de messages,
- une logique de traitement des événements.

---

# 🛠️ Technologies utilisées

## Frontend

- React.js
- JavaScript
- HTML5 / CSS3

## Simulation & logique

- Gestion des états distribués
- Communication simulée entre processus
- Journalisation des événements
- export des événements
## Outils

- Node.js
- npm

---

# 🚀 Installation

## 1️⃣ Cloner le dépôt

```bash
git clone https://github.com/YossrGalai/tp-algorithmes-repartis.git
```

---

## 2️⃣ Accéder au dossier du projet

```bash
cd tp-algorithmes-repartis
```

---

## 3️⃣ Installer les dépendances

```bash
npm install
```

---

# ▶️ Lancement du projet

## Démarrer l’application React

```bash
npm start
```

L’application sera accessible sur :

```bash
http://localhost:3000
```

---

# 🔐 Partie 1 — Exclusion Mutuelle

L’exclusion mutuelle garantit qu’un seul processus peut accéder à une ressource critique à un instant donné.

---

# Ricart–Agrawala

## 📌 Principe

Chaque processus doit demander l’autorisation des autres processus avant d’accéder à la ressource critique.

Le protocole repose sur :

- l’envoi de messages REQUEST,
- la réception de messages REPLY,
- un horodatage logique permettant de gérer les priorités.

---

## 🔄 Scénario simulé

### Exemple avec 3 processus :

- P1
- P2
- P3

### Étapes :

1. P1 demande l’accès à la ressource.
2. P2 et P3 répondent avec REPLY.
3. P1 entre en section critique.
4. P1 libère la ressource.
5. P2 peut ensuite accéder à la ressource.

---

## 📨 Messages échangés

| Type | Description |
|---|---|
| REQUEST | Demande d’accès à la ressource |
| REPLY | Autorisation accordée |
| RELEASE | Libération de la ressource |

---

## ✅ Avantages

- Garantit l’exclusion mutuelle
- Pas de coordinateur central
- Algorithme totalement distribué

---

## ❌ Inconvénients

- Grand nombre de messages
- Temps d’attente plus élevé

---

# Token Ring

## 📌 Principe

Les processus sont organisés sous forme d’anneau logique.

Un jeton unique circule entre les processus.

Seul le processus possédant le jeton peut accéder à la ressource critique.

---

## 🔄 Fonctionnement

1. Le jeton circule entre les processus.
2. Lorsqu’un processus reçoit le jeton :
   - il entre en section critique s’il en a besoin,
   - sinon il transmet le jeton au suivant.
3. Le jeton continue de circuler dans l’anneau.

---

## ✅ Avantages

- Nombre réduit de messages
- Gestion simple de l’accès

---

## ❌ Inconvénients

- Problème si le jeton est perdu
- Sensible aux pannes

---

# 👑 Partie 2 — Élection

Lorsqu’un coordinateur tombe en panne, un nouvel leader doit être élu automatiquement.

---

# Bully Algorithm

## 📌 Principe

Le processus ayant le plus grand identifiant devient coordinateur.

---

## 🔄 Fonctionnement

1. Détection de panne du leader.
2. Envoi des messages ELECTION.
3. Les processus ayant un ID supérieur répondent.
4. Le processus avec le plus grand ID devient coordinateur.
5. Diffusion du message COORDINATOR.

---

## 📨 Messages utilisés

| Message | Description |
|---|---|
| ELECTION | Déclenchement de l’élection |
| OK | Réponse d’un processus supérieur |
| COORDINATOR | Annonce du nouveau leader |

---

# Ring Election Algorithm

## 📌 Principe

Les processus sont organisés dans un anneau logique.

Un message d’élection circule contenant les identifiants des processus actifs.

Le processus ayant l’ID maximal devient coordinateur.

---

## 🔄 Fonctionnement

1. Détection de la panne.
2. Circulation du message d’élection.
3. Comparaison des IDs.
4. Sélection du plus grand ID.
5. Annonce du nouveau coordinateur.

---

# 📸 Partie 3 — Snapshot Distribué

## Chandy–Lamport Snapshot Algorithm

### 📌 Principe

L’algorithme de snapshot distribué permet de capturer un état global cohérent du système sans interrompre l’exécution des processus.

Il permet :

- d’enregistrer l’état local des processus,
- de sauvegarder les messages en transit,
- d’observer le comportement global du système distribué.

---

## ⚙️ Fonctionnement

Le snapshot utilise des messages spéciaux appelés :

```bash
MARKER
```

---

## 🔄 Déroulement

### 1️⃣ Initialisation

Un processus démarre le snapshot :

- sauvegarde son état local,
- envoie un `MARKER` aux autres processus.

---

### 2️⃣ Réception du premier MARKER

Le processus :

- enregistre son état,
- sauvegarde l’état des canaux,
- retransmet le `MARKER`.

---

### 3️⃣ Réception des autres MARKER

Le processus arrête l’enregistrement du canal correspondant.

---

## 📨 Messages utilisés

| Message | Description |
|---|---|
| MARKER | Déclenchement du snapshot |
| STATE | Sauvegarde de l’état local |
| CHANNEL STATE | Messages en transit |

---

## 🧪 Exemple de journalisation

```bash
[P1] Snapshot démarré
[P1] MARKER envoyé à P2 et P3
[P2] État local sauvegardé
[P2] MARKER retransmis
[P3] Message en transit détecté
[GLOBAL STATE] Snapshot terminé
```

---

## ✅ Avantages

- Capture cohérente de l’état global
- Aucun arrêt du système nécessaire
- Très utile pour le monitoring distribué

---

# 🧪 Scénarios de test

Le projet inclut plusieurs scénarios :

## 🔹 Accès concurrent

Plusieurs processus demandent simultanément l’accès à la ressource critique.

---

## 🔹 Circulation du jeton

Simulation du Token Ring avec passage du jeton entre les processus.

---

## 🔹 Panne du leader

Le coordinateur actuel tombe en panne.

Le système déclenche automatiquement une nouvelle élection.

---

## 🔹 Snapshot distribué

Capture de l’état global du système pendant l’exécution des communications.

---

## 🔹 Journalisation

Tous les événements sont affichés :

```bash
[P1] REQUEST envoyé
[P2] REPLY envoyé
[P1] Entrée en section critique
[P3] Jeton reçu
[Leader] Panne détectée
[P5] Nouveau coordinateur élu
[P1] Snapshot démarré
```

---

# 📊 Comparaison des algorithmes

| Algorithme | Type | Nombre de messages | Tolérance aux pannes |
|---|---|---|---|
| Ricart–Agrawala | Exclusion mutuelle | Élevé | Moyenne |
| Token Ring | Exclusion mutuelle | Faible | Faible |
| Bully | Élection | Moyen | Bonne |
| Ring Election | Élection | Moyen | Bonne |
| Chandy–Lamport | Snapshot | Moyen | Bonne |

---

Le projet propose :

✅ Visualisation des échanges de messages  
✅ Affichage des processus actifs  
✅ Simulation graphique des algorithmes  
✅ Snapshot distribué  
✅ Journalisation en temps réel

---

# 📂 Structure du projet

```bash
tp-algorithmes-repartis/
│
├── public/
│
├── src/
│   ├── components/
│   ├── algorithms/
│   ├── pages/
│   ├── styles/
│   └── App.js
│
├── package.json
├── README.md
└── ...
```

---

# 🔮 Améliorations futures

- ✅ Détection automatique des pannes
- ✅ Communication réseau réelle avec sockets
- ✅ Ajout d’autres algorithmes répartis
- ✅ Déploiement multi-machines
- ✅ Visualisation réseau avancée
- ✅ Interface temps réel plus interactive

---

# 👨‍💻 Auteur

## Yossr Galai  
## Emna Kallel  
## Maha Tlili  
## Tasnime Benboubaker  
## Ilef Msaddak

Projet académique en systèmes distribués — Algorithmes Répartis.

### GitHub

https://github.com/YossrGalai

---

# 📄 Licence

Projet réalisé dans un cadre pédagogique et éducatif.

Utilisation libre pour l’apprentissage et l’expérimentation.

---

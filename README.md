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


# 👨‍💻 Auteur

## Yossr Galai  
## Emna Kallel  
## Maha Tlili  
## Tasnime Benboubaker  
## Ilef Msaddak

Projet académique en systèmes distribués — Algorithmes Répartis.


---

# 📄 Licence

Projet réalisé dans un cadre pédagogique et éducatif.

Utilisation libre pour l’apprentissage et l’expérimentation.

---

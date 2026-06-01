# 🎮 Simple Games

Application web éducative pour enfants, axée sur les mathématiques, le français et les jeux de réflexion. Fonctionne comme une **Progressive Web App (PWA)** : installable sur mobile/tablette, utilisable hors ligne.

---

## Contenu

### 🧮 Mathématiques
Huit types d'exercices avec trois niveaux de difficulté (facile, moyen, difficile) :

| Exercice | URL |
|---|---|
| Additions | `/math/additions/` |
| Soustractions | `/math/soustractions/` |
| Multiplications | `/math/multiplications/` |
| Divisions | `/math/divisions/` |
| Divisions posées | `/math/divisions-posees/` |
| Compléments | `/math/complements/` |
| Calcul mixte | `/math/mixte/` |
| Comparaisons | `/math/comparaisons/` |

Chaque exercice propose :
- **Mode Entraînement** — problèmes illimités avec feedback immédiat et suivi de série
- **Mode Challenge 100** — résoudre 100 calculs le plus vite possible (classement par temps)
- **Mode Challenge 1 minute** — résoudre le plus de calculs en 60 secondes (classement par score)

### 📝 Français
Six catégories d'exercices avec banques de questions intégrées :

| Catégorie | URL |
|---|---|
| Conjugaison | `/francais/conjugaison/` |
| Homophones | `/francais/homophones/` |
| Pluriels | `/francais/pluriels/` |
| Féminin / Masculin | `/francais/feminin-masculin/` |
| Vocabulaire | `/francais/vocabulaire/` |
| Orthographe | `/francais/orthographe/` |

### 👑 Jeux classiques
| Jeu | Description |
|---|---|
| **Sudoku** | Grille 9×9, mode brouillon, indices, annulation illimitée |
| **Picross** | Nonogramme 5×5 / 10×10 / 15×15, génération unique vérifiée |
| **Couronnes** | Placement de couronnes par contraintes de lignes/colonnes/couleurs |

### 🏆 Classements
- Scores persistants en base de données SQLite
- Classement en ligne récupéré à chaque partie
- Sauvegarde locale automatique hors ligne avec re-synchronisation au retour du réseau

---

## Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- npm (inclus avec Node.js)

---

## Installation

### 1. Cloner le dépôt

```bash
git clone <url-du-repo>
cd simple_games
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Créer un fichier **`.env`** à la racine du projet :

```env
# Compte administrateur root (créé automatiquement au premier démarrage)
ROOT_ADMIN_USER=admin
ROOT_ADMIN_PASS=motdepasse_securise

# Clé secrète pour les sessions (générez une valeur aléatoire longue)
SESSION_SECRET=une_chaine_aleatoire_tres_longue_et_secrete
```

> ⚠️ Le serveur refuse de démarrer si `ROOT_ADMIN_USER` ou `ROOT_ADMIN_PASS` ne sont pas définis.

### 4. (Optionnel) Activer HTTPS

Placer les fichiers `cert.pem` et `key.pem` à la racine du projet. Le serveur bascule automatiquement en HTTPS s'ils sont présents.

### 5. Démarrer le serveur

```bash
npm start
```

Le serveur démarre sur le port **8765** :
- HTTP : `http://localhost:8765`
- HTTPS (si certificats présents) : `https://localhost:8765`

---

## Console d'administration

Accessible à l'URL `/admin/`.

### Fonctionnalités
- **Tableau de bord** — statistiques globales (scores du jour, de la semaine, joueurs uniques)
- **Gestion des scores** — consultation, filtrage, suppression unitaire ou en masse, export CSV
- **Gestion du contenu** — ajout / modification / suppression d'entrées dans les banques de questions françaises
- **Paramètres** — bloquer les soumissions, désactiver un type de challenge, afficher une annonce
- **Noms bannis** — empêcher certains pseudonymes dans les classements
- **Gestion des administrateurs** — créer des comptes `admin` ou `superadmin` (superadmin requis)
- **Journal d'activité** — historique de toutes les actions admin

### Rôles
| Rôle | Accès |
|---|---|
| `admin` | Scores, contenu, paramètres, noms bannis, stats, log, export |
| `superadmin` | Tout ci-dessus + gestion des comptes administrateurs |

Le compte root (`is_root = 1`) est créé automatiquement depuis le `.env` au premier démarrage et **ne peut pas être supprimé**.

---

## Structure du projet

```
simple_games/
├── server.js          # Serveur Express (API + routes statiques)
├── package.json
├── .env               # Variables d'environnement (à créer, non versionné)
├── scores.db          # Base SQLite (créée automatiquement)
├── sw.js              # Service Worker (cache PWA)
├── manifest.json      # Manifest PWA
├── index.html         # Page d'accueil
├── admin/             # Console d'administration
│   ├── index.html
│   ├── login.html
│   ├── admin.js
│   └── admin.css
├── math/              # Jeux mathématiques
├── francais/          # Jeux de français
├── jeux/              # Jeux classiques (Sudoku, Picross, Couronnes)
└── data/
    └── francais/      # Banques de questions JSON (6 fichiers)
```

---

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `ROOT_ADMIN_USER` | ✅ | Nom d'utilisateur du compte admin root |
| `ROOT_ADMIN_PASS` | ✅ | Mot de passe du compte admin root |
| `SESSION_SECRET` | Recommandé | Clé de signature des sessions (auto-générée si absente, mais non persistante entre redémarrages) |

---

## Technologies utilisées

| Composant | Technologie |
|---|---|
| Serveur | Node.js + Express |
| Base de données | SQLite via `better-sqlite3` |
| Sessions | `express-session` + `connect-sqlite3` |
| Authentification | `bcrypt` |
| Frontend | HTML / CSS / JavaScript vanilla |
| PWA | Service Worker + Web App Manifest |

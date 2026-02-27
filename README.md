# Cyber DevOps Playground — Awesome Sysadmin (Markdown → Site Web)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![HTML](https://img.shields.io/badge/HTML-5-orange.svg)](https://developer.mozilla.org/fr/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS-3-blue.svg)](https://developer.mozilla.org/fr/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow.svg)](https://developer.mozilla.org/fr/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://www.python.org/)
[![Maintained?](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](./commits)

> **Transforme une awesome list Markdown (type “Awesome Sysadmin”) en un site web “wow” ultra moderne : dark mode spectaculaire, recherche instantanée, filtres, palette de commande, “surprends-moi”, et micro-interactions.**  
> ✅ Interface en français  
> ✅ **Noms d’outils / URLs non modifiés**  
> ✅ Descriptions **traduites en FR** via pré-génération `data.json` (recommandé)

---

## Table des matières
- [✨ Fonctionnalités](#-fonctionnalités)
- [🧠 Aperçu du concept](#-aperçu-du-concept)
- [⚡ Installation rapide](#-installation-rapide)
- [🛠️ Installation manuelle](#️-installation-manuelle)
- [🚀 Utilisation](#-utilisation)
- [🧩 Architecture du projet](#-architecture-du-projet)
- [🔧 Génération de `data.json` (parsing + traduction)](#-génération-de-datajson-parsing--traduction)
- [🌐 Déploiement (GitHub Pages)](#-déploiement-github-pages)
- [🔒 Sécurité & bonnes pratiques](#-sécurité--bonnes-pratiques)
- [🧪 Critères d’acceptation](#-critères-dacceptation)
- [❓ FAQ](#-faq)
- [🤝 Contribution](#-contribution)
- [📜 Licence](#-licence)
- [👤 Auteur](#-auteur)

---

## ✨ Fonctionnalités

### Navigation “explorateur” pour une liste massive
- Sidebar “Table des matières” sticky (desktop) + drawer hamburger (mobile)
- Sections catégories / sous-catégories
- Permaliens par outil + bouton **Copier le lien** (🔗)

### 🔎 Recherche + Filtres (UX “super pouvoirs”)
- Recherche full-text : nom, description, tags, catégorie
- Surlignage des mots trouvés
- Filtres :
  - Catégorie
  - Licence
  - Langage
  - Présence de lien **Source Code**
  - Présence de lien **Demo**
- Tri :
  - A → Z
  - Densité de tags
  - “Roulette découverte” (fun)

### 🎛️ Interactions “fun mais propres”
- Palette de commande **Ctrl/⌘ K**
- Bouton 🎲 **Surprends-moi**
- Dark mode + Light mode (mémorisé)
- Konami code → mini thème “rétro”
- Respect `prefers-reduced-motion` (animations réduites automatiquement)

### 🇫🇷 Traduction des descriptions (pré-génération)
- Script Python qui :
  - parse **100%** du Markdown
  - extrait liens (y compris Demo)
  - détecte licences / langages
  - traduit EN → FR via LibreTranslate
  - produit un `data.json` prêt pour le site

---

## 🧠 Aperçu du concept

Le site charge les données de cette manière :

1) ✅ **Priorité : `data.json`** (déjà traduit en FR)  
2) 🔁 **Fallback : parsing direct du Markdown** si `data.json` absent  
   → Dans ce cas, les descriptions restent en anglais (pas de traduction runtime)

🎯 Objectif : **site statique, rapide, maintenable**, qui reste fluide même avec des centaines/milliers d’entrées.

---

## ⚡ Installation rapide

### 1) Mettre les fichiers au bon endroit
Place ton Markdown source à la racine du dossier, nommé :
- `awesome-sysadmin.md` (recommandé)

### 2) Lancer LibreTranslate (traduction FR)
```bash
docker run -it --rm -p 5000:5000 libretranslate/libretranslate
````

### 3) Générer `data.json`

```bash
python build_data.py
```

### 4) Lancer le site (serveur local)

⚠️ `fetch()` peut être bloqué en `file://`, donc on lance un mini serveur :

```bash
python -m http.server 8080
```

Ouvre :

* [http://localhost:8080](http://localhost:8080)

---

## 🛠️ Installation manuelle

### Prérequis

* **Python 3** (3.10+ conseillé)
* **Docker** (recommandé) pour LibreTranslate
* Optionnel : `pip install requests` si ton Python n’a pas `requests`

### Étapes

```bash
# 1) Cloner le dépôt
git clone <URL_DU_DEPOT>
cd <DOSSIER_DU_DEPOT>

# 2) Ajouter ton Markdown
cp /chemin/vers/awesome-sysadmin.md ./awesome-sysadmin.md

# 3) Lancer LibreTranslate
docker run -it --rm -p 5000:5000 libretranslate/libretranslate

# 4) Générer data.json
python build_data.py

# 5) Lancer le site
python -m http.server 8080
```

---

## 🚀 Utilisation

### Workflow recommandé

1. Tu mets à jour `awesome-sysadmin.md`
2. Tu relances :

   ```bash
   python build_data.py
   ```
3. Tu refresh le navigateur (Ctrl+F5)

### Ce que tu peux faire dans l’UI

* Tape dans la barre de recherche (sticky)
* Filtre par licence/langage/catégorie
* Utilise Ctrl/⌘K pour la palette de commande
* Clique 🎲 “Surprends-moi” pour découvrir un outil aléatoire

---

## 🧩 Architecture du projet

```
/site
  index.html              # Structure du site
  styles.css              # Identité visuelle (Cyber DevOps Playground)
  app.js                  # UI + chargement data.json + fallback parsing markdown
  awesome-sysadmin.md     # Source (awesome list)
  data.json               # Données générées (FR)
  build_data.py           # Parser + traduction
  .translate_cache.json   # Cache de traduction (évite de retraduire)
  README.md
```

---

## 🔧 Génération de `data.json` (parsing + traduction)

### Pourquoi pré-générer ?

* Site plus rapide (pas de traduction côté navigateur)
* Répétable / stable (cache `.translate_cache.json`)
* “Statique” friendly (parfait pour GitHub Pages)

### Le format de sortie (extrait)

```json
{
  "name": "Apache Ant",
  "url": "https://ant.apache.org/",
  "description_fr": "Outil de construction d'automatisation...",
  "links": { "Source Code": "https://github.com/apache/ant", "Demo": "..." },
  "licenses": ["Apache-2.0"],
  "langs": ["Java"]
}
```

### Commande

```bash
python build_data.py
```

💡 Le script :

* parse toutes les catégories / sous-catégories
* détecte les tags en backticks
* conserve les labels de liens tels quels (**Demo**, **Source Code**, etc.)
* traduit uniquement la description (pas le nom de l’outil)

---

## 🌐 Déploiement (GitHub Pages)

### Option simple : Pages sur la branche `main` / dossier root

* Mets tout à la racine du repo **ou** dans `/docs`
* Assure-toi que `index.html` est au bon niveau
* Va dans **Settings → Pages**
* Choisis la source (branch + folder)

### Important

* `data.json` doit être publié avec le site
* `awesome-sysadmin.md` est optionnel en production (fallback uniquement)

---

## 🔒 Sécurité & bonnes pratiques

* Les liens externes sont ouverts avec :

  * `target="_blank"`
  * `rel="noopener noreferrer"`
* Le site est statique : pas d’exécution côté serveur
* Recommandation : **ne pas activer** de traduction runtime via API publique (privacy + stabilité)
* Respect des préférences utilisateur :

  * `prefers-reduced-motion`
  * `prefers-color-scheme`

---

## 🧪 Critères d’acceptation

✅ Sur mobile : je peux chercher + filtrer + naviguer facilement
✅ Les ancres (liens vers sections/outils) fonctionnent
✅ Le site reste fluide avec une grosse liste
✅ UI en français, noms/URLs inchangés
✅ Animations présentes mais désactivables via reduced-motion

---

## ❓ FAQ

### “Je vois une page vide / rien ne se charge”

* Lance bien un serveur :

  ```bash
  python -m http.server 8080
  ```
* Vérifie que `data.json` est au même niveau que `index.html`

### “La traduction ne marche pas”

* As-tu lancé LibreTranslate ?

  ```bash
  docker run -it --rm -p 5000:5000 libretranslate/libretranslate
  ```
* Le service doit être accessible sur `http://localhost:5000/translate`

### “Je n’ai pas Docker”

* Tu peux désactiver la traduction :

  * dans `build_data.py` : `TRANSLATE_ENABLED = False`
* Tu obtiendras quand même un `data.json` (descriptions EN), et le site fonctionnera.

### “Le parsing ne récupère pas certains liens”

Certains README utilisent des labels variés (ex: “Live Demo”, “Homepage”, “Docs”).
➡️ Le parser conserve tous les liens `[Label](URL)` trouvés dans la ligne de l’outil.
Si ton README a des formats exotiques, ouvre une issue avec 2–3 exemples.

---

## 🤝 Contribution

Les contributions sont bienvenues :

* amélioration du parsing (cas Markdown spéciaux)
* ajout de nouveaux filtres / stats
* optimisation performances (virtualisation si liste énorme)

### Comment contribuer

1. Fork
2. Crée une branche :

   ```bash
   git checkout -b feat/ma-feature
   ```
3. Commit + PR

---

## 📜 Licence

Ce projet est sous licence **MIT**.

---

## 👤 Auteur

Nicolas BODAINE - Projet maintenu par **TutoTech**.

---

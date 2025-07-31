# LMAY Generator

Outil de génération automatique de fichiers LMAY à partir de l'analyse de systèmes de fichiers (langage-agnostique).

## Fonctionnalités

- **Analyse de système de fichiers** : Scanning récursif, détection de langages
- **Extraction de patterns architecturaux** : Détection de structures MVC, composants, etc.
- **Génération hiérarchique** : Création de `root.lmay` et fichiers de sous-modules
- **Détection de dépendances** : Analyse des fichiers de configuration (package.json, etc.)

## Architecture

```
src/
├── scanner.js          # Scanner de système de fichiers
├── generator.js        # Générateur LMAY
└── cli.js             # Interface ligne de commande
```

## Installation

```bash
npm install
```

## Usage

```bash
# Générer LMAY pour n'importe quel projet
node src/cli.js --input /path/to/project --output .

# Avec configuration personnalisée
node src/cli.js --config config/default.json --input /path/to/project
```

## Configuration

Voir `config/default.json` pour la configuration par défaut.
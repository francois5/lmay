# LMAY Validator

Outil de validation de fichiers LMAY selon la spécification v1.0.

## Fonctionnalités

- **Validation syntaxique YAML** : Vérification de la syntaxe YAML
- **Validation sémantique LMAY** : Conformité à la spécification v1.0
- **Vérification des références** : Cohérence des liens entre fichiers
- **Validation hiérarchique** : Liens parent/enfant corrects

## Architecture

```
src/
├── validator.js        # Validateur principal
├── yaml-validator.js   # Validation syntaxique YAML
├── schema-validator.js # Validation selon schéma LMAY
├── reference-validator.js # Validation des références
└── cli.js             # Interface ligne de commande
```

## Installation

```bash
npm install
```

## Usage

```bash
# Valider un fichier LMAY
node src/cli.js root.lmay

# Valider un projet complet
node src/cli.js --project /path/to/project

# Mode strict avec toutes les validations
node src/cli.js --strict root.lmay
```

## Types de validation

- **Syntaxique** : YAML bien formé
- **Structurelle** : Sections obligatoires présentes
- **Sémantique** : Valeurs cohérentes et valides
- **Référentielle** : Liens entre fichiers corrects
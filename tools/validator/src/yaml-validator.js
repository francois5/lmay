const yaml = require('js-yaml');
const fs = require('fs');

class YAMLValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Valide la syntaxe YAML d'un fichier
   */
  async validateFile(filePath) {
    this.errors = [];
    this.warnings = [];

    try {
      // Vérifier que le fichier existe
      if (!fs.existsSync(filePath)) {
        this.errors.push({
          type: 'file_not_found',
          message: `Fichier introuvable: ${filePath}`,
          file: filePath
        });
        return false;
      }

      // Lire le contenu du fichier
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Valider que le fichier n'est pas vide
      if (content.trim().length === 0) {
        this.errors.push({
          type: 'empty_file',
          message: 'Le fichier LMAY est vide',
          file: filePath
        });
        return false;
      }

      // Parser le YAML
      const parsedContent = yaml.load(content, {
        filename: filePath,
        onWarning: (warning) => {
          this.warnings.push({
            type: 'yaml_warning',
            message: warning.message,
            file: filePath,
            line: warning.mark?.line,
            column: warning.mark?.column
          });
        }
      });

      // Vérifications supplémentaires
      this.performAdditionalChecks(content, filePath);

      return parsedContent;

    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        this.errors.push({
          type: 'yaml_syntax_error',
          message: error.message,
          file: filePath,
          line: error.mark?.line,
          column: error.mark?.column,
          snippet: this.getErrorSnippet(error, filePath)
        });
        return false;
      } else {
        this.errors.push({
          type: 'file_read_error',
          message: `Erreur lors de la lecture du fichier: ${error.message}`,
          file: filePath
        });
        return false;
      }
    }
  }

  /**
   * Effectue des vérifications supplémentaires sur le contenu YAML
   */
  performAdditionalChecks(content, filePath) {
    const lines = content.split('\n');

    // Vérifier l'indentation
    this.checkIndentation(lines, filePath);
    
    // Vérifier les caractères problématiques
    this.checkProblematicCharacters(lines, filePath);
    
    // Vérifier la structure des clés
    this.checkKeyStructure(lines, filePath);
  }

  /**
   * Vérifie la cohérence de l'indentation
   */
  checkIndentation(lines, filePath) {
    let expectedIndent = null;
    let inconsistentIndentation = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Ignorer les lignes vides et les commentaires
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }

      // Calculer l'indentation de la ligne
      const indent = line.length - line.trimStart().length;
      
      if (indent > 0) {
        if (expectedIndent === null) {
          expectedIndent = indent;
        } else if (indent % expectedIndent !== 0) {
          inconsistentIndentation = true;
          this.warnings.push({
            type: 'inconsistent_indentation',
            message: `Indentation incohérente détectée (attendu multiple de ${expectedIndent})`,
            file: filePath,
            line: i + 1,
            column: 1
          });
        }
      }
    }

    // Vérifier si l'indentation recommandée (2 espaces) est utilisée
    if (expectedIndent && expectedIndent !== 2) {
      this.warnings.push({
        type: 'non_standard_indentation',
        message: `Indentation non-standard détectée (${expectedIndent} espaces, recommandé: 2)`,
        file: filePath
      });
    }
  }

  /**
   * Vérifie les caractères problématiques
   */
  checkProblematicCharacters(lines, filePath) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Vérifier les tabulations
      if (line.includes('\t')) {
        this.warnings.push({
          type: 'tab_character',
          message: 'Caractère de tabulation détecté (utiliser des espaces)',
          file: filePath,
          line: i + 1
        });
      }

      // Vérifier les espaces en fin de ligne
      if (line.endsWith(' ') && line.trim() !== '') {
        this.warnings.push({
          type: 'trailing_whitespace',
          message: 'Espaces en fin de ligne détectés',
          file: filePath,
          line: i + 1
        });
      }

      // Vérifier les caractères non-ASCII problématiques
      const problematicChars = /[^\x00-\x7F]/g;
      if (problematicChars.test(line)) {
        this.warnings.push({
          type: 'non_ascii_characters',
          message: 'Caractères non-ASCII détectés (peuvent causer des problèmes)',
          file: filePath,
          line: i + 1
        });
      }
    }
  }

  /**
   * Vérifie la structure des clés YAML
   */
  checkKeyStructure(lines, filePath) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Ignorer les lignes vides, commentaires et valeurs
      if (trimmedLine === '' || trimmedLine.startsWith('#') || !trimmedLine.includes(':')) {
        continue;
      }

      // Extraire la clé
      const keyMatch = trimmedLine.match(/^([^:]+):/);
      if (keyMatch) {
        const key = keyMatch[1].trim();
        
        // Vérifier la convention de nommage snake_case
        if (!/^[a-z][a-z0-9_]*$/.test(key)) {
          this.warnings.push({
            type: 'key_naming_convention',
            message: `Clé "${key}" ne suit pas la convention snake_case`,
            file: filePath,
            line: i + 1
          });
        }

        // Vérifier les clés trop longues
        if (key.length > 50) {
          this.warnings.push({
            type: 'long_key_name',
            message: `Clé "${key}" est très longue (${key.length} caractères)`,
            file: filePath,
            line: i + 1
          });
        }
      }
    }
  }

  /**
   * Extrait un snippet de code autour d'une erreur
   */
  getErrorSnippet(error, filePath) {
    if (!error.mark) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const errorLine = error.mark.line;
      
      const start = Math.max(0, errorLine - 2);
      const end = Math.min(lines.length, errorLine + 3);
      
      const snippet = [];
      for (let i = start; i < end; i++) {
        const marker = i === errorLine ? '>>> ' : '    ';
        snippet.push(`${marker}${i + 1}: ${lines[i]}`);
      }
      
      return snippet.join('\n');
    } catch (err) {
      return null;
    }
  }

  /**
   * Retourne les erreurs de validation
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Retourne les avertissements
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * Vérifie si la validation a réussi
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Génère un rapport de validation
   */
  generateReport() {
    const report = {
      valid: this.isValid(),
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings
    };

    return report;
  }
}

module.exports = YAMLValidator;
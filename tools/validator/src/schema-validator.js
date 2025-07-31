const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false
    });
    addFormats(this.ajv);
    
    // Charger le schéma LMAY
    this.loadSchema();
    
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Charge le schéma JSON pour LMAY v1.0
   */
  loadSchema() {
    try {
      const schemaPath = path.join(__dirname, '../config/lmay-schema.json');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      this.validate = this.ajv.compile(this.schema);
    } catch (error) {
      throw new Error(`Impossible de charger le schéma LMAY: ${error.message}`);
    }
  }

  /**
   * Valide un objet LMAY contre le schéma
   */
  validateLMAY(lmayData, filePath) {
    this.errors = [];
    this.warnings = [];

    // Validation contre le schéma JSON
    const isValid = this.validate(lmayData);
    
    if (!isValid) {
      this.processSchemaErrors(this.validate.errors, filePath);
    }

    // Validations sémantiques supplémentaires
    this.performSemanticValidation(lmayData, filePath);

    return this.errors.length === 0;
  }

  /**
   * Traite les erreurs du schéma JSON
   */
  processSchemaErrors(schemaErrors, filePath) {
    for (const error of schemaErrors) {
      let message = '';
      let type = 'schema_error';

      switch (error.keyword) {
        case 'required':
          message = `Propriété obligatoire manquante: ${error.params.missingProperty}`;
          type = 'missing_required_property';
          break;
        
        case 'type':
          message = `Type incorrect pour "${error.instancePath}": attendu ${error.params.type}, reçu ${typeof error.data}`;
          type = 'invalid_type';
          break;
        
        case 'enum':
          message = `Valeur non autorisée pour "${error.instancePath}": "${error.data}". Valeurs autorisées: ${error.params.allowedValues.join(', ')}`;
          type = 'invalid_enum_value';
          break;
        
        case 'minLength':
          message = `"${error.instancePath}" est trop court (minimum ${error.params.limit} caractères)`;
          type = 'string_too_short';
          break;
        
        case 'maxLength':
          message = `"${error.instancePath}" est trop long (maximum ${error.params.limit} caractères)`;
          type = 'string_too_long';
          break;
        
        case 'pattern':
          message = `"${error.instancePath}" ne respecte pas le format requis`;
          type = 'invalid_pattern';
          break;
        
        case 'minimum':
          message = `"${error.instancePath}" est trop petit (minimum ${error.params.limit})`;
          type = 'value_too_small';
          break;
        
        case 'additionalProperties':
          message = `Propriété non autorisée: "${error.params.additionalProperty}"`;
          type = 'unknown_property';
          break;
        
        default:
          message = `Erreur de validation: ${error.message}`;
      }

      this.errors.push({
        type,
        message,
        file: filePath,
        path: error.instancePath,
        value: error.data,
        schemaPath: error.schemaPath
      });
    }
  }

  /**
   * Effectue des validations sémantiques supplémentaires
   */
  performSemanticValidation(lmayData, filePath) {
    // Vérifier la version LMAY
    this.validateLMAYVersion(lmayData, filePath);
    
    // Vérifier la cohérence du projet
    this.validateProjectConsistency(lmayData, filePath);
    
    // Vérifier l'architecture
    this.validateArchitecture(lmayData, filePath);
    
    // Vérifier la structure
    this.validateStructure(lmayData, filePath);
    
    // Vérifier les dépendances
    this.validateDependencies(lmayData, filePath);
  }

  /**
   * Valide la version LMAY
   */
  validateLMAYVersion(lmayData, filePath) {
    if (!lmayData.lmay_version) {
      this.errors.push({
        type: 'missing_lmay_version',
        message: 'Version LMAY manquante',
        file: filePath,
        path: '/lmay_version'
      });
      return;
    }

    if (lmayData.lmay_version !== '1.0') {
      this.warnings.push({
        type: 'unsupported_lmay_version',
        message: `Version LMAY "${lmayData.lmay_version}" non supportée par ce validateur`,
        file: filePath,
        path: '/lmay_version'
      });
    }
  }

  /**
   * Valide la cohérence des informations de projet
   */
  validateProjectConsistency(lmayData, filePath) {
    if (!lmayData.project) return;

    const project = lmayData.project;

    // Vérifier que le nom du projet n'est pas générique
    if (project.name && ['project', 'app', 'application', 'untitled'].includes(project.name.toLowerCase())) {
      this.warnings.push({
        type: 'generic_project_name',
        message: `Nom de projet générique: "${project.name}"`,
        file: filePath,
        path: '/project/name'
      });
    }

    // Vérifier la cohérence entre langages et frameworks
    if (project.languages && project.frameworks) {
      this.validateLanguageFrameworkConsistency(project.languages, project.frameworks, filePath);
    }

    // Vérifier le format de la version
    if (project.version && !/^\d+\.\d+\.\d+/.test(project.version)) {
      this.warnings.push({
        type: 'non_semver_version',
        message: `Version ne suit pas le format semver: "${project.version}"`,
        file: filePath,
        path: '/project/version'
      });
    }
  }

  /**
   * Valide la cohérence entre langages et frameworks
   */
  validateLanguageFrameworkConsistency(languages, frameworks, filePath) {
    const frameworkLanguageMap = {
      'react': ['javascript', 'typescript'],
      'vue': ['javascript', 'typescript'],
      'angular': ['typescript'],
      'express': ['javascript', 'typescript'],
      'django': ['python'],
      'flask': ['python'],
      'spring': ['java'],
      'rails': ['ruby'],
      'laravel': ['php']
    };

    for (const framework of frameworks) {
      const expectedLanguages = frameworkLanguageMap[framework.toLowerCase()];
      if (expectedLanguages) {
        const hasCompatibleLanguage = expectedLanguages.some(lang => languages.includes(lang));
        if (!hasCompatibleLanguage) {
          this.warnings.push({
            type: 'framework_language_mismatch',
            message: `Framework "${framework}" généralement utilisé avec ${expectedLanguages.join('/')} mais langages déclarés: ${languages.join(', ')}`,
            file: filePath,
            path: '/project'
          });
        }
      }
    }
  }

  /**
   * Valide l'architecture
   */
  validateArchitecture(lmayData, filePath) {
    if (!lmayData.architecture) return;

    const arch = lmayData.architecture;

    // Vérifier les points d'entrée
    if (arch.entry_points && arch.entry_points.length === 0) {
      this.warnings.push({
        type: 'no_entry_points',
        message: 'Aucun point d\'entrée défini',
        file: filePath,
        path: '/architecture/entry_points'
      });
    }

    // Vérifier la cohérence entre pattern et entry_points
    if (arch.pattern === 'Microservices' && arch.entry_points && arch.entry_points.length < 2) {
      this.warnings.push({
        type: 'microservices_single_entry',
        message: 'Architecture microservices avec un seul point d\'entrée',
        file: filePath,
        path: '/architecture'
      });
    }
  }

  /**
   * Valide la structure
   */
  validateStructure(lmayData, filePath) {
    if (!lmayData.structure) return;

    const structure = lmayData.structure;
    const directoryNames = Object.keys(structure);

    // Vérifier qu'il y a au moins une structure définie
    if (directoryNames.length === 0) {
      this.warnings.push({
        type: 'empty_structure',
        message: 'Aucune structure de répertoire définie',
        file: filePath,
        path: '/structure'
      });
      return;
    }

    // Vérifier chaque élément de structure
    for (const [name, info] of Object.entries(structure)) {
      this.validateStructureItem(name, info, filePath);
    }

    // Vérifier les patterns architecturaux communs
    this.validateCommonPatterns(directoryNames, filePath);
  }

  /**
   * Valide un élément de structure individuel
   */
  validateStructureItem(name, info, filePath) {
    const basePath = `/structure/${name}`;

    // Vérifier que le chemin n'est pas absolu
    if (info.path && path.isAbsolute(info.path)) {
      this.warnings.push({
        type: 'absolute_path_in_structure',
        message: `Chemin absolu détecté: "${info.path}" (utiliser des chemins relatifs)`,
        file: filePath,
        path: `${basePath}/path`
      });
    }

    // Vérifier la cohérence file_count
    if (info.type === 'file' && info.file_count && info.file_count !== 1) {
      this.errors.push({
        type: 'invalid_file_count',
        message: `file_count doit être 1 pour un fichier, reçu: ${info.file_count}`,
        file: filePath,
        path: `${basePath}/file_count`
      });
    }

    // Vérifier la cohérence primary_language
    if (info.primary_language && info.type === 'file') {
      this.warnings.push({
        type: 'language_on_file',
        message: 'primary_language généralement utilisé pour les répertoires, pas les fichiers',
        file: filePath,
        path: `${basePath}/primary_language`
      });
    }
  }

  /**
   * Valide les patterns architecturaux communs
   */
  validateCommonPatterns(directoryNames, filePath) {
    const lowerNames = directoryNames.map(name => name.toLowerCase());

    // Pattern MVC incomplet
    const hasMvc = ['models', 'views', 'controllers'].some(part => 
      lowerNames.some(name => name.includes(part))
    );
    if (hasMvc) {
      const missingParts = ['models', 'views', 'controllers'].filter(part =>
        !lowerNames.some(name => name.includes(part))
      );
      if (missingParts.length > 0) {
        this.warnings.push({
          type: 'incomplete_mvc_pattern',
          message: `Pattern MVC incomplet, manque: ${missingParts.join(', ')}`,
          file: filePath,
          path: '/structure'
        });
      }
    }
  }

  /**
   * Valide les dépendances
   */
  validateDependencies(lmayData, filePath) {
    if (!lmayData.dependencies) return;

    const deps = lmayData.dependencies;

    // Vérifier les dépendances externes
    if (deps.external) {
      for (let i = 0; i < deps.external.length; i++) {
        const dep = deps.external[i];
        this.validateExternalDependency(dep, i, filePath);
      }
    }

    // Vérifier les dépendances internes
    if (deps.internal) {
      for (let i = 0; i < deps.internal.length; i++) {
        const dep = deps.internal[i];
        this.validateInternalDependency(dep, i, filePath);
      }
    }
  }

  /**
   * Valide une dépendance externe
   */
  validateExternalDependency(dep, index, filePath) {
    const basePath = `/dependencies/external/${index}`;

    // Vérifier les versions étranges
    if (dep.version) {
      if (dep.version === '*' || dep.version === 'latest') {
        this.warnings.push({
          type: 'unsafe_dependency_version',
          message: `Version non-sûre pour "${dep.name}": "${dep.version}"`,
          file: filePath,
          path: `${basePath}/version`
        });
      }
    }
  }

  /**
   * Valide une dépendance interne
   */
  validateInternalDependency(dep, index, filePath) {
    const basePath = `/dependencies/internal/${index}`;

    // Vérifier que le chemin n'est pas absolu
    if (dep.path && path.isAbsolute(dep.path)) {
      this.warnings.push({
        type: 'absolute_internal_dependency_path',
        message: `Chemin absolu pour dépendance interne: "${dep.path}"`,
        file: filePath,
        path: `${basePath}/path`
      });
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
    return {
      valid: this.isValid(),
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

module.exports = SchemaValidator;
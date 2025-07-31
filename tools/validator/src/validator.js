const YAMLValidator = require('./yaml-validator');
const SchemaValidator = require('./schema-validator');
const ReferenceValidator = require('./reference-validator');
const path = require('path');

class LMAYValidator {
  constructor(options = {}) {
    this.options = {
      strict: false,
      checkReferences: true,
      checkHierarchy: true,
      ...options
    };

    this.yamlValidator = new YAMLValidator();
    this.schemaValidator = new SchemaValidator();
    this.referenceValidator = new ReferenceValidator();

    this.results = {
      valid: false,
      errors: [],
      warnings: [],
      summary: {}
    };
  }

  /**
   * Valide un fichier LMAY unique
   */
  async validateFile(filePath) {
    this.resetResults();
    
    console.log(`🔍 Validation du fichier: ${filePath}`);

    // 1. Validation syntaxique YAML
    const parsedContent = await this.yamlValidator.validateFile(filePath);
    this.mergeResults(this.yamlValidator.generateReport(), 'yaml');

    if (!parsedContent) {
      return this.finalizeResults();
    }

    // 2. Validation sémantique contre le schéma
    this.schemaValidator.validateLMAY(parsedContent, filePath);
    this.mergeResults(this.schemaValidator.generateReport(), 'schema');

    return this.finalizeResults();
  }

  /**
   * Valide un projet LMAY complet
   */
  async validateProject(projectPath, rootFile = 'root.lmay') {
    this.resetResults();
    
    console.log(`🔍 Validation du projet: ${projectPath}`);

    const rootFilePath = path.join(projectPath, rootFile);

    // 1. Valider le fichier racine
    const rootValid = await this.validateFile(rootFilePath);
    
    if (!rootValid.valid && !this.options.strict) {
      console.log('❌ Fichier racine invalide, arrêt de la validation');
      return this.finalizeResults();
    }

    // 2. Validation des références (si activée)
    if (this.options.checkReferences) {
      console.log('🔗 Validation des références...');
      await this.referenceValidator.validateProject(projectPath, rootFile);
      this.mergeResults(this.referenceValidator.generateReport(), 'references');
    }

    // 3. Validation de la hiérarchie (si activée)
    if (this.options.checkHierarchy) {
      console.log('🌳 Validation de la hiérarchie...');
      await this.validateHierarchy(projectPath, rootFile);
    }

    return this.finalizeResults();
  }

  /**
   * Valide la hiérarchie parent/enfant
   */
  async validateHierarchy(projectPath, rootFile) {
    const hierarchyErrors = [];
    const hierarchyWarnings = [];

    try {
      // Construire l'arbre hiérarchique
      const hierarchyTree = await this.buildHierarchyTree(projectPath, rootFile);
      
      // Valider la cohérence hiérarchique
      this.validateHierarchyConsistency(hierarchyTree, hierarchyErrors, hierarchyWarnings);
      
      // Valider les niveaux de profondeur
      this.validateDepthLevels(hierarchyTree, hierarchyErrors, hierarchyWarnings);

    } catch (error) {
      hierarchyErrors.push({
        type: 'hierarchy_build_error',
        message: `Erreur lors de la construction de l'arbre hiérarchique: ${error.message}`,
        file: path.join(projectPath, rootFile)
      });
    }

    // Ajouter les résultats
    this.results.errors.push(...hierarchyErrors);
    this.results.warnings.push(...hierarchyWarnings);
    this.results.summary.hierarchy = {
      errorCount: hierarchyErrors.length,
      warningCount: hierarchyWarnings.length
    };
  }

  /**
   * Construit l'arbre hiérarchique du projet
   */
  async buildHierarchyTree(projectPath, rootFile, visited = new Set()) {
    const rootPath = path.join(projectPath, rootFile);
    
    if (visited.has(rootPath)) {
      throw new Error(`Référence circulaire détectée: ${rootPath}`);
    }
    
    visited.add(rootPath);

    const parsedContent = await this.yamlValidator.validateFile(rootPath);
    if (!parsedContent) {
      throw new Error(`Impossible de parser le fichier: ${rootPath}`);
    }

    const node = {
      file: rootPath,
      data: parsedContent,
      children: [],
      depth: 0,
      parent: null
    };

    // Construire les enfants récursivement
    if (parsedContent.structure) {
      for (const [itemName, itemInfo] of Object.entries(parsedContent.structure)) {
        if (itemInfo.lmay_file) {
          try {
            const childPath = path.resolve(path.dirname(rootPath), itemInfo.lmay_file);
            const childNode = await this.buildHierarchyTree(
              projectPath, 
              path.relative(projectPath, childPath), 
              new Set(visited)
            );
            
            childNode.parent = node;
            childNode.depth = node.depth + 1;
            childNode.parentKey = itemName;
            
            node.children.push(childNode);
          } catch (error) {
            // Les erreurs de référence sont gérées par ReferenceValidator
          }
        }
      }
    }

    return node;
  }

  /**
   * Valide la cohérence hiérarchique
   */
  validateHierarchyConsistency(node, errors, warnings, maxDepth = 10) {
    // Vérifier la profondeur maximale
    if (node.depth > maxDepth) {
      warnings.push({
        type: 'excessive_hierarchy_depth',
        message: `Hiérarchie très profonde détectée (niveau ${node.depth})`,
        file: node.file,
        depth: node.depth
      });
    }

    // Vérifier les métadonnées de hiérarchie dans le fichier
    if (node.data.hierarchy) {
      this.validateHierarchyMetadata(node, errors, warnings);
    }

    // Vérifier récursivement les enfants
    for (const child of node.children) {
      this.validateHierarchyConsistency(child, errors, warnings, maxDepth);
    }
  }

  /**
   * Valide les métadonnées de hiérarchie
   */
  validateHierarchyMetadata(node, errors, warnings) {
    const hierarchy = node.data.hierarchy;

    // Vérifier la profondeur déclarée
    if (hierarchy.depth !== undefined && hierarchy.depth !== node.depth) {
      errors.push({
        type: 'incorrect_hierarchy_depth',
        message: `Profondeur hiérarchique incorrecte: déclaré ${hierarchy.depth}, calculé ${node.depth}`,
        file: node.file,
        path: '/hierarchy/depth'
      });
    }

    // Vérifier la référence au parent
    if (hierarchy.parent && node.parent) {
      const expectedParent = path.relative(
        path.dirname(node.file), 
        node.parent.file
      );
      
      if (hierarchy.parent !== expectedParent) {
        errors.push({
          type: 'incorrect_parent_reference',
          message: `Référence parent incorrecte: déclaré "${hierarchy.parent}", attendu "${expectedParent}"`,
          file: node.file,
          path: '/hierarchy/parent'
        });
      }
    }
  }

  /**
   * Valide les niveaux de profondeur
   */
  validateDepthLevels(node, errors, warnings, levelCounts = {}) {
    // Compter les nœuds par niveau
    levelCounts[node.depth] = (levelCounts[node.depth] || 0) + 1;

    // Parcourir les enfants
    for (const child of node.children) {
      this.validateDepthLevels(child, errors, warnings, levelCounts);
    }

    // À la racine, analyser la distribution
    if (node.depth === 0) {
      this.analyzeDepthDistribution(levelCounts, warnings);
    }
  }

  /**
   * Analyse la distribution des profondeurs
   */
  analyzeDepthDistribution(levelCounts, warnings) {
    const levels = Object.keys(levelCounts).map(Number).sort((a, b) => a - b);
    const maxLevel = Math.max(...levels);

    // Avertir si la hiérarchie est très plate
    if (maxLevel <= 1 && levelCounts[1] > 10) {
      warnings.push({
        type: 'flat_hierarchy',
        message: `Hiérarchie très plate détectée (${levelCounts[1]} éléments au niveau 1)`,
        suggestion: 'Considérer une organisation plus hiérarchique'
      });
    }

    // Avertir si la hiérarchie est déséquilibrée
    for (let i = 1; i < levels.length; i++) {
      const currentLevel = levels[i];
      const previousLevel = levels[i - 1];
      
      if (levelCounts[currentLevel] > levelCounts[previousLevel] * 3) {
        warnings.push({
          type: 'unbalanced_hierarchy',
          message: `Hiérarchie déséquilibrée: niveau ${currentLevel} a ${levelCounts[currentLevel]} éléments vs ${levelCounts[previousLevel]} au niveau ${previousLevel}`,
          level: currentLevel
        });
      }
    }
  }

  /**
   * Remet à zéro les résultats
   */
  resetResults() {
    this.results = {
      valid: false,
      errors: [],
      warnings: [],
      summary: {}
    };
  }

  /**
   * Fusionne les résultats d'un validateur
   */
  mergeResults(report, validatorType) {
    this.results.errors.push(...report.errors);
    this.results.warnings.push(...report.warnings);
    this.results.summary[validatorType] = {
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      valid: report.valid
    };
  }

  /**
   * Finalise les résultats
   */
  finalizeResults() {
    this.results.valid = this.results.errors.length === 0;
    this.results.summary.total = {
      errorCount: this.results.errors.length,
      warningCount: this.results.warnings.length,
      valid: this.results.valid
    };

    return this.results;
  }

  /**
   * Génère un rapport détaillé
   */
  generateDetailedReport() {
    const report = this.finalizeResults();
    
    return {
      ...report,
      timestamp: new Date().toISOString(),
      validatorVersion: '1.0.0',
      options: this.options
    };
  }
}

module.exports = LMAYValidator;
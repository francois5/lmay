const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ReferenceValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.fileMap = new Map(); // Cache des fichiers LMAY chargés
  }

  /**
   * Valide les références dans un projet LMAY
   */
  async validateProject(projectPath, rootFile = 'root.lmay') {
    this.errors = [];
    this.warnings = [];
    this.fileMap.clear();

    const rootPath = path.join(projectPath, rootFile);
    
    if (!fs.existsSync(rootPath)) {
      this.errors.push({
        type: 'root_file_not_found',
        message: `Fichier racine LMAY introuvable: ${rootPath}`,
        file: rootPath
      });
      return false;
    }

    try {
      // Charger et valider le fichier racine
      const rootData = await this.loadLMAYFile(rootPath);
      if (!rootData) return false;

      // Valider les références dans le fichier racine
      await this.validateFileReferences(rootData, rootPath, projectPath);

      // Découvrir et valider tous les fichiers LMAY référencés
      await this.discoverAndValidateReferences(projectPath);

      return this.errors.length === 0;

    } catch (error) {
      this.errors.push({
        type: 'validation_error',
        message: `Erreur lors de la validation des références: ${error.message}`,
        file: rootPath
      });
      return false;
    }
  }

  /**
   * Charge un fichier LMAY et le met en cache
   */
  async loadLMAYFile(filePath) {
    if (this.fileMap.has(filePath)) {
      return this.fileMap.get(filePath);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = yaml.load(content);
      this.fileMap.set(filePath, data);
      return data;
    } catch (error) {
      this.errors.push({
        type: 'file_load_error',
        message: `Impossible de charger le fichier LMAY: ${error.message}`,
        file: filePath
      });
      return null;
    }
  }

  /**
   * Valide les références dans un fichier LMAY
   */
  async validateFileReferences(lmayData, filePath, basePath) {
    // Valider les références de structure
    if (lmayData.structure) {
      await this.validateStructureReferences(lmayData.structure, filePath, basePath);
    }

    // Valider les points d'entrée
    if (lmayData.architecture && lmayData.architecture.entry_points) {
      this.validateEntryPointReferences(lmayData.architecture.entry_points, filePath, basePath);
    }

    // Valider les dépendances internes
    if (lmayData.dependencies && lmayData.dependencies.internal) {
      this.validateInternalDependencyReferences(lmayData.dependencies.internal, filePath, basePath);
    }
  }

  /**
   * Valide les références de structure
   */
  async validateStructureReferences(structure, filePath, basePath) {
    for (const [itemName, itemInfo] of Object.entries(structure)) {
      const itemPath = `/structure/${itemName}`;

      // Vérifier que le chemin référencé existe
      if (itemInfo.path) {
        const fullPath = path.resolve(basePath, itemInfo.path);
        if (!fs.existsSync(fullPath)) {
          this.errors.push({
            type: 'referenced_path_not_found',
            message: `Chemin référencé introuvable: ${itemInfo.path}`,
            file: filePath,
            path: `${itemPath}/path`,
            referencedPath: fullPath
          });
        } else {
          // Vérifier la cohérence du type
          const stats = fs.statSync(fullPath);
          const actualType = stats.isDirectory() ? 'directory' : 'file';
          if (itemInfo.type && itemInfo.type !== actualType) {
            this.errors.push({
              type: 'type_mismatch',
              message: `Type incohérent pour ${itemInfo.path}: déclaré "${itemInfo.type}", trouvé "${actualType}"`,
              file: filePath,
              path: `${itemPath}/type`,
              referencedPath: fullPath
            });
          }
        }
      }

      // Vérifier les fichiers LMAY référencés
      if (itemInfo.lmay_file) {
        await this.validateLMAYFileReference(itemInfo.lmay_file, filePath, basePath, `${itemPath}/lmay_file`);
      }
    }
  }

  /**
   * Valide une référence à un fichier LMAY
   */
  async validateLMAYFileReference(lmayFilePath, parentFile, basePath, contextPath) {
    const fullPath = path.resolve(basePath, lmayFilePath);
    
    if (!fs.existsSync(fullPath)) {
      this.errors.push({
        type: 'lmay_file_not_found',
        message: `Fichier LMAY référencé introuvable: ${lmayFilePath}`,
        file: parentFile,
        path: contextPath,
        referencedFile: fullPath
      });
      return;
    }

    // Vérifier l'extension
    if (!lmayFilePath.endsWith('.lmay')) {
      this.warnings.push({
        type: 'invalid_lmay_extension',
        message: `Fichier LMAY sans extension .lmay: ${lmayFilePath}`,
        file: parentFile,
        path: contextPath
      });
    }

    // Charger et valider le fichier référencé
    const referencedData = await this.loadLMAYFile(fullPath);
    if (referencedData) {
      // Validation récursive des références dans le fichier enfant
      await this.validateFileReferences(referencedData, fullPath, basePath);
    }
  }

  /**
   * Valide les références des points d'entrée
   */
  validateEntryPointReferences(entryPoints, filePath, basePath) {
    for (let i = 0; i < entryPoints.length; i++) {
      const entryPoint = entryPoints[i];
      const entryPath = `/architecture/entry_points/${i}`;

      if (entryPoint.file) {
        const fullPath = path.resolve(basePath, entryPoint.file);
        
        if (!fs.existsSync(fullPath)) {
          this.errors.push({
            type: 'entry_point_not_found',
            message: `Point d'entrée introuvable: ${entryPoint.file}`,
            file: filePath,
            path: `${entryPath}/file`,
            referencedPath: fullPath
          });
        } else {
          // Vérifier que c'est bien un fichier
          const stats = fs.statSync(fullPath);
          if (!stats.isFile()) {
            this.errors.push({
              type: 'entry_point_not_file',
              message: `Point d'entrée n'est pas un fichier: ${entryPoint.file}`,
              file: filePath,
              path: `${entryPath}/file`
            });
          }
        }
      }
    }
  }

  /**
   * Valide les références des dépendances internes
   */
  validateInternalDependencyReferences(internalDeps, filePath, basePath) {
    for (let i = 0; i < internalDeps.length; i++) {
      const dep = internalDeps[i];
      const depPath = `/dependencies/internal/${i}`;

      if (dep.path) {
        const fullPath = path.resolve(basePath, dep.path);
        
        if (!fs.existsSync(fullPath)) {
          this.errors.push({
            type: 'internal_dependency_not_found',
            message: `Dépendance interne introuvable: ${dep.path}`,
            file: filePath,
            path: `${depPath}/path`,
            referencedPath: fullPath
          });
        }
      }
    }
  }

  /**
   * Découvre et valide toutes les références dans le projet
   */
  async discoverAndValidateReferences(projectPath) {
    // Trouver tous les fichiers .lmay dans le projet
    const lmayFiles = this.findAllLMAYFiles(projectPath);
    
    for (const lmayFile of lmayFiles) {
      if (!this.fileMap.has(lmayFile)) {
        const data = await this.loadLMAYFile(lmayFile);
        if (data) {
          await this.validateFileReferences(data, lmayFile, projectPath);
        }
      }
    }

    // Vérifier les références circulaires
    this.detectCircularReferences();

    // Vérifier les fichiers orphelins
    this.detectOrphanFiles(projectPath);
  }

  /**
   * Trouve tous les fichiers .lmay dans un répertoire
   */
  findAllLMAYFiles(dirPath, files = []) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
          this.findAllLMAYFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.lmay')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignorer les erreurs de lecture de répertoire
    }

    return files;
  }

  /**
   * Vérifie si un répertoire doit être ignoré
   */
  shouldSkipDirectory(name) {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.cache'];
    return skipDirs.includes(name) || name.startsWith('.');
  }

  /**
   * Détecte les références circulaires
   */
  detectCircularReferences() {
    const visited = new Set();
    const recursionStack = new Set();

    for (const filePath of this.fileMap.keys()) {
      if (!visited.has(filePath)) {
        this.detectCircularReferencesRecursive(filePath, visited, recursionStack, []);
      }
    }
  }

  /**
   * Détection récursive des références circulaires
   */
  detectCircularReferencesRecursive(filePath, visited, recursionStack, path) {
    visited.add(filePath);
    recursionStack.add(filePath);

    const data = this.fileMap.get(filePath);
    if (data && data.structure) {
      for (const [itemName, itemInfo] of Object.entries(data.structure)) {
        if (itemInfo.lmay_file) {
          const referencedPath = path.resolve(path.dirname(filePath), itemInfo.lmay_file);
          
          if (recursionStack.has(referencedPath)) {
            // Référence circulaire détectée
            this.errors.push({
              type: 'circular_reference',
              message: `Référence circulaire détectée: ${[...path, filePath, referencedPath].join(' -> ')}`,
              file: filePath,
              path: `/structure/${itemName}/lmay_file`,
              cycle: [...path, filePath, referencedPath]
            });
          } else if (!visited.has(referencedPath) && this.fileMap.has(referencedPath)) {
            this.detectCircularReferencesRecursive(
              referencedPath, 
              visited, 
              recursionStack, 
              [...path, filePath]
            );
          }
        }
      }
    }

    recursionStack.delete(filePath);
  }

  /**
   * Détecte les fichiers LMAY orphelins (non référencés)
   */
  detectOrphanFiles(projectPath) {
    const allLMAYFiles = new Set(this.findAllLMAYFiles(projectPath));
    const referencedFiles = new Set();

    // Marquer le fichier racine comme référencé
    const rootFile = path.join(projectPath, 'root.lmay');
    if (allLMAYFiles.has(rootFile)) {
      referencedFiles.add(rootFile);
    }

    // Collecter toutes les références
    for (const [filePath, data] of this.fileMap.entries()) {
      if (data && data.structure) {
        for (const itemInfo of Object.values(data.structure)) {
          if (itemInfo.lmay_file) {
            const referencedPath = path.resolve(path.dirname(filePath), itemInfo.lmay_file);
            referencedFiles.add(referencedPath);
          }
        }
      }
    }

    // Identifier les fichiers orphelins
    for (const lmayFile of allLMAYFiles) {
      if (!referencedFiles.has(lmayFile)) {
        this.warnings.push({
          type: 'orphan_lmay_file',
          message: `Fichier LMAY orphelin (non référencé): ${path.relative(projectPath, lmayFile)}`,
          file: lmayFile
        });
      }
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
      warnings: this.warnings,
      filesValidated: this.fileMap.size
    };
  }
}

module.exports = ReferenceValidator;
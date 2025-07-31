const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');

class LMAYGenerator {
  constructor(config) {
    this.config = config;
  }

  /**
   * Génère les fichiers LMAY à partir de la structure analysée
   */
  async generate(projectPath, structure, analysis) {
    const outputPath = path.resolve(projectPath);
    
    // Générer le fichier root.lmay
    const rootLmay = this.generateRootLmay(structure, analysis, projectPath);
    await this.writeFile(
      path.join(outputPath, this.config.output.rootFile),
      rootLmay
    );

    // Générer les fichiers de modules si nécessaire
    if (this.config.structure.createModuleFiles) {
      await this.generateModuleFiles(structure, outputPath, analysis);
    }

    return {
      rootFile: path.join(outputPath, this.config.output.rootFile),
      moduleFiles: []  // TODO: retourner la liste des fichiers de modules créés
    };
  }

  /**
   * Génère le contenu du fichier root.lmay
   */
  generateRootLmay(structure, analysis, projectPath) {
    const projectName = this.config.project.name === 'auto-detected' 
      ? path.basename(projectPath)
      : this.config.project.name;

    const rootContent = {
      lmay_version: this.config.lmay.version,
      project: {
        name: projectName,
        version: this.detectVersion(analysis.configFiles),
        description: this.config.project.description,
        languages: analysis.languages,
        frameworks: analysis.frameworks.length > 0 ? analysis.frameworks : undefined
      },
      architecture: {
        pattern: this.detectArchitecturalPattern(structure, analysis),
        entry_points: this.formatEntryPoints(analysis.entryPoints, projectPath)
      },
      structure: this.generateStructureSection(structure, projectPath),
      dependencies: this.extractDependencies(analysis.configFiles),
      interfaces: this.detectInterfaces(structure, analysis),
      metadata: {
        generated_at: new Date().toISOString(),
        total_files: analysis.totalFiles,
        total_directories: analysis.totalDirectories,
        generator_version: '1.0.0'
      }
    };

    // Nettoyer les valeurs undefined
    return this.cleanObject(rootContent);
  }

  /**
   * Génère la section structure du fichier LMAY
   */
  generateStructureSection(structure, basePath) {
    const structureMap = {};

    if (structure.children) {
      structure.children.forEach(child => {
        if (child.type === 'directory') {
          const relativePath = path.relative(basePath, child.path);
          structureMap[child.name] = {
            path: relativePath,
            type: 'directory',
            description: this.generateDirectoryDescription(child),
            file_count: this.countFiles(child),
            primary_language: this.detectPrimaryLanguage(child)
          };
        }
      });
    }

    return structureMap;
  }

  /**
   * Compte le nombre de fichiers dans un répertoire
   */
  countFiles(node) {
    if (node.type === 'file') return 1;
    
    let count = 0;
    if (node.children) {
      node.children.forEach(child => {
        count += this.countFiles(child);
      });
    }
    return count;
  }

  /**
   * Détecte le langage principal d'un répertoire
   */
  detectPrimaryLanguage(node) {
    const languages = {};
    this.collectLanguages(node, languages);
    
    // Retourner le langage le plus fréquent
    const sortedLanguages = Object.entries(languages)
      .sort(([,a], [,b]) => b - a);
    
    return sortedLanguages.length > 0 ? sortedLanguages[0][0] : null;
  }

  /**
   * Collecte les langages dans un sous-arbre
   */
  collectLanguages(node, languages) {
    if (node.type === 'file') {
      const lang = this.detectLanguageFromExtension(node.extension);
      if (lang) {
        languages[lang] = (languages[lang] || 0) + 1;
      }
    } else if (node.children) {
      node.children.forEach(child => this.collectLanguages(child, languages));
    }
  }

  /**
   * Génère une description automatique pour un répertoire
   */
  generateDirectoryDescription(node) {
    const name = node.name.toLowerCase();
    
    const descriptions = {
      'src': 'Source code directory',
      'lib': 'Library and utility modules',
      'test': 'Test files and test utilities',
      'tests': 'Test files and test utilities',
      'docs': 'Documentation files', 
      'config': 'Configuration files',
      'assets': 'Static assets and resources',
      'public': 'Public web assets',
      'components': 'Reusable components',
      'services': 'Service layer modules',
      'models': 'Data models and schemas',
      'controllers': 'Request controllers',
      'routes': 'Routing definitions',
      'middleware': 'Middleware functions',
      'utils': 'Utility functions and helpers',
      'helpers': 'Helper functions',
      'scripts': 'Build and utility scripts'
    };

    // Correspondance exacte
    if (descriptions[name]) {
      return descriptions[name];
    }

    // Correspondance partielle
    for (const [key, desc] of Object.entries(descriptions)) {
      if (name.includes(key)) {
        return desc;
      }
    }

    return `Directory containing ${this.countFiles(node)} files`;
  }

  /**
   * Détecte le pattern architectural dominant
   */
  detectArchitecturalPattern(structure, analysis) {
    const patterns = [];
    
    // Analyser la structure des répertoires
    if (structure.children) {
      const dirNames = structure.children
        .filter(child => child.type === 'directory')
        .map(child => child.name.toLowerCase());

      // Pattern MVC
      if (dirNames.some(name => name.includes('model')) &&
          dirNames.some(name => name.includes('view')) &&
          dirNames.some(name => name.includes('controller'))) {
        patterns.push('MVC');
      }

      // Pattern Component-based
      if (dirNames.some(name => name.includes('component'))) {
        patterns.push('Component-based');
      }

      // Pattern Service-oriented
      if (dirNames.some(name => name.includes('service'))) {
        patterns.push('Service-oriented');
      }

      // Pattern Layered
      if (dirNames.length >= 3) {
        patterns.push('Layered');
      }
    }

    return patterns.length > 0 ? patterns[0] : 'Unstructured';
  }

  /**
   * Formate les points d'entrée
   */
  formatEntryPoints(entryPoints, basePath) {
    return entryPoints.map(entryPoint => {
      const relativePath = path.relative(basePath, entryPoint);
      return {
        file: relativePath,
        type: this.detectEntryPointType(entryPoint)
      };
    });
  }

  /**
   * Détecte le type de point d'entrée
   */
  detectEntryPointType(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('server')) return 'server';
    if (fileName.includes('app')) return 'application';
    if (fileName.includes('main')) return 'main';
    if (fileName.includes('index')) return 'index';
    
    return 'entry';
  }

  /**
   * Extrait les dépendances des fichiers de configuration
   */
  extractDependencies(configFiles) {
    const dependencies = {
      external: [],
      internal: []
    };

    configFiles.forEach(configFile => {
      try {
        if (configFile.endsWith('package.json')) {
          const packageJson = JSON.parse(fs.readFileSync(configFile, 'utf8'));
          if (packageJson.dependencies) {
            Object.keys(packageJson.dependencies).forEach(dep => {
              dependencies.external.push({
                name: dep,
                version: packageJson.dependencies[dep],
                type: 'npm'
              });
            });
          }
        }
        // TODO: Ajouter support pour d'autres types de fichiers de config
      } catch (error) {
        console.warn(`Erreur lors de la lecture du fichier ${configFile}:`, error.message);
      }
    });

    return dependencies.external.length > 0 || dependencies.internal.length > 0 
      ? dependencies 
      : undefined;
  }

  /**
   * Détecte les interfaces du système
   */
  detectInterfaces(structure, analysis) {
    const interfaces = [];
    
    // TODO: Implémenter la détection d'interfaces
    // - APIs REST
    // - Endpoints GraphQL
    // - Interfaces CLI
    // - Interfaces de données
    
    return interfaces.length > 0 ? interfaces : undefined;
  }

  /**
   * Détecte la version du projet
   */
  detectVersion(configFiles) {
    for (const configFile of configFiles) {
      try {
        if (configFile.endsWith('package.json')) {
          const packageJson = JSON.parse(fs.readFileSync(configFile, 'utf8'));
          return packageJson.version || '1.0.0';
        }
      } catch (error) {
        // Ignorer les erreurs de lecture
      }
    }
    return '1.0.0';
  }

  /**
   * Détection de langage par extension (helper)
   */
  detectLanguageFromExtension(extension) {
    const languageMap = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust'
    };
    return languageMap[extension?.toLowerCase()];
  }

  /**
   * Génère les fichiers de modules (optionnel)
   */
  async generateModuleFiles(structure, outputPath, analysis) {
    // TODO: Implémenter la génération de fichiers de modules séparés
    // pour les gros projets avec beaucoup de répertoires
  }

  /**
   * Écrit un fichier YAML
   */
  async writeFile(filePath, content) {
    const yamlContent = yaml.dump(content, {
      indent: this.config.output.indent,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });

    await fs.promises.writeFile(filePath, yamlContent, 'utf8');
  }

  /**
   * Nettoie un objet en supprimant les valeurs undefined
   */
  cleanObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObject(item)).filter(item => item !== undefined);
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          const cleanedValue = this.cleanObject(value);
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    
    return obj;
  }
}

module.exports = LMAYGenerator;
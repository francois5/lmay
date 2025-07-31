const fs = require('fs');
const path = require('path');

class FileSystemScanner {
  constructor(config) {
    this.config = config;
    this.excludePatterns = config.analysis.excludePatterns || [];
    this.maxDepth = config.analysis.scanDepth || 5;
    this.includeDotFiles = config.analysis.includeDotFiles || false;
  }

  /**
   * Scanne récursivement un répertoire et retourne la structure
   */
  async scanDirectory(dirPath, currentDepth = 0) {
    if (currentDepth > this.maxDepth) {
      return null;
    }

    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      return this.createFileNode(dirPath, stats);
    }

    const dirName = path.basename(dirPath);
    
    // Vérifier les patterns d'exclusion
    if (this.shouldExclude(dirName)) {
      return null;
    }

    const dirNode = {
      name: dirName,
      type: 'directory',
      path: dirPath,
      children: [],
      stats: {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      }
    };

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Ignorer les fichiers cachés si configuré
        if (!this.includeDotFiles && entry.name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(dirPath, entry.name);
        const childNode = await this.scanDirectory(entryPath, currentDepth + 1);
        
        if (childNode) {
          dirNode.children.push(childNode);
        }
      }

      // Trier les enfants (dossiers d'abord, puis fichiers)
      dirNode.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      console.warn(`Erreur lors de la lecture du répertoire ${dirPath}:`, error.message);
    }

    return dirNode;
  }

  /**
   * Crée un nœud pour un fichier
   */
  createFileNode(filePath, stats) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    
    return {
      name: fileName,
      type: 'file',
      path: filePath,
      extension: ext,
      stats: {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      }
    };
  }

  /**
   * Vérifie si un nom de fichier/dossier doit être exclu
   */
  shouldExclude(name) {
    return this.excludePatterns.some(pattern => {
      // Support simple des patterns avec wildcards
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  /**
   * Analyse la structure et extrait des métadonnées
   */
  analyzeStructure(rootNode) {
    const analysis = {
      totalFiles: 0,
      totalDirectories: 0,
      languages: new Set(),
      frameworks: new Set(),
      entryPoints: [],
      configFiles: []
    };

    this.walkStructure(rootNode, analysis);

    return {
      ...analysis,
      languages: Array.from(analysis.languages),
      frameworks: Array.from(analysis.frameworks)
    };
  }

  /**
   * Parcourt récursivement la structure pour analyser
   */
  walkStructure(node, analysis) {
    if (node.type === 'directory') {
      analysis.totalDirectories++;
      
      // Parcourir les enfants
      if (node.children) {
        node.children.forEach(child => this.walkStructure(child, analysis));
      }
    } else {
      analysis.totalFiles++;
      
      // Détecter le langage par extension
      const language = this.detectLanguage(node.extension);
      if (language) {
        analysis.languages.add(language);
      }

      // Détecter les points d'entrée potentiels
      if (this.isEntryPoint(node.name)) {
        analysis.entryPoints.push(node.path);
      }

      // Détecter les fichiers de configuration
      if (this.isConfigFile(node.name)) {
        analysis.configFiles.push(node.path);
      }
    }
  }

  /**
   * Détecte le langage par extension de fichier
   */
  detectLanguage(extension) {
    const languageMap = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.sh': 'shell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less'
    };

    return languageMap[extension?.toLowerCase()];
  }

  /**
   * Vérifie si un fichier est un point d'entrée potentiel
   */
  isEntryPoint(fileName) {
    const entryPatterns = [
      'index', 'main', 'app', 'server', 'start',
      'run', 'launch', 'boot', 'init'
    ];

    const baseName = path.basename(fileName, path.extname(fileName));
    return entryPatterns.includes(baseName.toLowerCase());
  }

  /**
   * Vérifie si un fichier est un fichier de configuration
   */
  isConfigFile(fileName) {
    const configPatterns = [
      'package.json', 'composer.json', 'requirements.txt',
      'Gemfile', 'go.mod', 'Cargo.toml', 'pom.xml',
      '.gitignore', 'README.md', 'LICENSE',
      'tsconfig.json', 'webpack.config.js',
      'babel.config.js', 'jest.config.js'
    ];

    return configPatterns.some(pattern => 
      fileName.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}

module.exports = FileSystemScanner;
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

class DistributedScanner {
  constructor(config) {
    this.config = config;
    this.sources = config.sources || {};
  }

  /**
   * Scanne toutes les sources configurées
   */
  async scanAllSources() {
    const results = {
      sources: [],
      totalNodes: 0,
      totalFiles: 0,
      languages: new Set(),
      services: new Set(),
      infrastructure: new Set()
    };

    // Scanner local si configuré
    if (this.sources.type === 'local' || this.sources.local) {
      console.log('🔍 Scanning local file system...');
      const localResult = await this.scanLocalSource();
      if (localResult) {
        results.sources.push(localResult);
        this.mergeResults(results, localResult);
      }
    }

    // Scanner serveurs distants si configuré
    if (this.sources.remote && this.sources.remote.enabled) {
      console.log('🌐 Scanning remote servers...');
      const remoteResults = await this.scanRemoteSources();
      for (const result of remoteResults) {
        results.sources.push(result);
        this.mergeResults(results, result);
      }
    }

    // Scanner sites web si configuré
    if (this.sources.web && this.sources.web.enabled) {
      console.log('🌍 Scanning web sites...');
      const webResults = await this.scanWebSources();
      for (const result of webResults) {
        results.sources.push(result);
        this.mergeResults(results, result);
      }
    }

    return {
      ...results,
      languages: Array.from(results.languages),
      services: Array.from(results.services),
      infrastructure: Array.from(results.infrastructure)
    };
  }

  /**
   * Scanne le système de fichiers local
   */
  async scanLocalSource() {
    const FileSystemScanner = require('./scanner');
    const scanner = new FileSystemScanner(this.config);
    
    try {
      const structure = await scanner.scanDirectory(process.cwd());
      const analysis = scanner.analyzeStructure(structure);
      
      return {
        type: 'local',
        location: process.cwd(),
        status: 'success',
        structure,
        analysis,
        metadata: {
          scannedAt: new Date().toISOString(),
          totalFiles: analysis.totalFiles,
          totalDirectories: analysis.totalDirectories
        }
      };
    } catch (error) {
      return {
        type: 'local',
        location: process.cwd(),
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Scanne les serveurs distants via SSH/SFTP
   */
  async scanRemoteSources() {
    const results = [];
    const servers = this.sources.remote.servers || [];
    
    for (const server of servers) {
      try {
        console.log(`  📡 Scanning ${server.host}:${server.port || 22}${server.path || '/'}`);
        const result = await this.scanRemoteServer(server);
        results.push(result);
      } catch (error) {
        console.warn(`  ⚠️  Failed to scan ${server.host}: ${error.message}`);
        results.push({
          type: 'remote',
          location: `${server.host}:${server.port || 22}${server.path || '/'}`,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Scanne un serveur distant
   */
  async scanRemoteServer(server) {
    return new Promise((resolve, reject) => {
      const command = this.buildSSHCommand(server);
      const process = spawn('ssh', command, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.sources.remote.timeout || 30000
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const structure = this.parseRemoteOutput(stdout);
            resolve({
              type: 'remote',
              location: `${server.host}:${server.port || 22}${server.path || '/'}`,
              status: 'success',
              structure,
              analysis: this.analyzeRemoteStructure(structure),
              metadata: {
                scannedAt: new Date().toISOString(),
                method: 'ssh'
              }
            });
          } catch (error) {
            reject(new Error(`Failed to parse remote output: ${error.message}`));
          }
        } else {
          reject(new Error(`SSH command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`SSH process error: ${error.message}`));
      });
    });
  }

  /**
   * Construit la commande SSH pour scanner un serveur distant
   */
  buildSSHCommand(server) {
    const args = [];

    // Options de connexion
    if (server.port && server.port !== 22) {
      args.push('-p', server.port.toString());
    }

    // Authentification
    if (this.sources.remote.authentication.keyFile) {
      args.push('-i', this.sources.remote.authentication.keyFile);
    }

    // Options de sécurité
    args.push('-o', 'StrictHostKeyChecking=no');
    args.push('-o', 'UserKnownHostsFile=/dev/null');
    args.push('-o', 'LogLevel=ERROR');

    // Utilisateur et host
    const user = server.username || this.sources.remote.authentication.username || 'root';
    args.push(`${user}@${server.host}`);

    // Commande à exécuter sur le serveur distant
    const remotePath = server.path || '/';
    const remoteCommand = `find ${remotePath} -maxdepth ${this.sources.local.scanDepth || 5} -type f -o -type d | head -1000`;
    args.push(remoteCommand);

    return args;
  }

  /**
   * Parse la sortie d'un scan distant
   */
  parseRemoteOutput(output) {
    const lines = output.trim().split('\n').filter(line => line.trim());
    const structure = {
      name: 'remote-root',
      type: 'directory',
      path: '/',
      children: []
    };

    const pathMap = new Map();
    pathMap.set('/', structure);

    for (const line of lines) {
      const fullPath = line.trim();
      if (!fullPath) continue;

      const pathParts = fullPath.split('/').filter(part => part);
      let currentPath = '';
      let parent = structure;

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        currentPath += '/' + part;

        if (!pathMap.has(currentPath)) {
          const isFile = i === pathParts.length - 1 && this.looksLikeFile(part);
          const node = {
            name: part,
            type: isFile ? 'file' : 'directory',
            path: currentPath,
            children: isFile ? undefined : []
          };

          parent.children.push(node);
          pathMap.set(currentPath, node);
        }

        parent = pathMap.get(currentPath);
      }
    }

    return structure;
  }

  /**
   * Vérifie si un nom ressemble à un fichier
   */
  looksLikeFile(name) {
    return name.includes('.') && !name.startsWith('.');
  }

  /**
   * Analyse la structure d'un serveur distant
   */
  analyzeRemoteStructure(structure) {
    const analysis = {
      totalFiles: 0,
      totalDirectories: 0,
      languages: new Set(),
      services: new Set(),
      configFiles: []
    };

    this.walkRemoteStructure(structure, analysis);

    return {
      ...analysis,
      languages: Array.from(analysis.languages),
      services: Array.from(analysis.services)
    };
  }

  /**
   * Parcourt récursivement une structure distante
   */
  walkRemoteStructure(node, analysis) {
    if (node.type === 'directory') {
      analysis.totalDirectories++;
      
      // Détecter les services par nom de répertoire
      this.detectServiceFromPath(node.path, analysis.services);
      
      if (node.children) {
        node.children.forEach(child => this.walkRemoteStructure(child, analysis));
      }
    } else {
      analysis.totalFiles++;
      
      // Détecter le langage
      const ext = path.extname(node.name);
      const language = this.detectLanguageFromExtension(ext);
      if (language) {
        analysis.languages.add(language);
      }

      // Détecter les fichiers de configuration
      if (this.isConfigFile(node.name)) {
        analysis.configFiles.push(node.path);
      }
    }
  }

  /**
   * Détecte des services à partir du chemin
   */
  detectServiceFromPath(path, services) {
    const servicePatterns = {
      'nginx': /nginx|www|html/,
      'apache': /apache|httpd/,
      'mysql': /mysql|mariadb/,
      'postgresql': /postgres|pgsql/,
      'redis': /redis/,
      'mongodb': /mongo/,
      'docker': /docker/,
      'kubernetes': /k8s|kubernetes/,
      'jenkins': /jenkins/,
      'gitlab': /gitlab/
    };

    for (const [service, pattern] of Object.entries(servicePatterns)) {
      if (pattern.test(path.toLowerCase())) {
        services.add(service);
      }
    }
  }

  /**
   * Scanne les sites web
   */
  async scanWebSources() {
    const results = [];
    const sites = this.sources.web.sites || [];

    for (const site of sites) {
      try {
        console.log(`  🌐 Scanning ${site.url}`);
        const result = await this.scanWebSite(site);
        results.push(result);
      } catch (error) {
        console.warn(`  ⚠️  Failed to scan ${site.url}: ${error.message}`);
        results.push({
          type: 'web',
          location: site.url,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Scanne un site web
   */
  async scanWebSite(site) {
    const structure = await this.crawlWebSite(site.url, site.maxDepth || this.sources.web.maxDepth || 3);
    
    return {
      type: 'web',
      location: site.url,
      status: 'success',
      structure,
      analysis: this.analyzeWebStructure(structure),
      metadata: {
        scannedAt: new Date().toISOString(),
        method: 'http'
      }
    };
  }

  /**
   * Crawle un site web
   */
  async crawlWebSite(url, maxDepth = 3, visited = new Set(), currentDepth = 0) {
    if (currentDepth >= maxDepth || visited.has(url)) {
      return null;
    }

    visited.add(url);

    try {
      const response = await this.fetchUrl(url);
      const urlObj = new URL(url);
      
      const node = {
        name: urlObj.pathname === '/' ? urlObj.hostname : path.basename(urlObj.pathname),
        type: 'web_page',
        path: url,
        metadata: {
          title: this.extractTitle(response.body),
          statusCode: response.statusCode,
          contentType: response.headers['content-type'],
          size: response.body.length
        },
        children: []
      };

      // Extraire les liens pour continuer le crawling
      const links = this.extractLinks(response.body, url);
      for (const link of links.slice(0, 10)) { // Limiter à 10 liens par page
        const childNode = await this.crawlWebSite(link, maxDepth, visited, currentDepth + 1);
        if (childNode) {
          node.children.push(childNode);
        }
      }

      return node;

    } catch (error) {
      return {
        name: new URL(url).pathname,
        type: 'web_page',
        path: url,
        error: error.message
      };
    }
  }

  /**
   * Effectue une requête HTTP
   */
  async fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': this.sources.web.userAgent || 'LMAY-Generator/1.0'
        },
        timeout: this.sources.web.timeout || 10000
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.end();
    });
  }

  /**
   * Extrait le titre d'une page HTML
   */
  extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : 'Untitled';
  }

  /**
   * Extrait les liens d'une page HTML
   */
  extractLinks(html, baseUrl) {
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    const links = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        if (href.startsWith('http')) {
          links.push(href);
        } else if (href.startsWith('/')) {
          const base = new URL(baseUrl);
          links.push(`${base.protocol}//${base.host}${href}`);
        }
      } catch (error) {
        // Ignorer les URLs malformées
      }
    }

    return [...new Set(links)]; // Supprimer les doublons
  }

  /**
   * Analyse la structure d'un site web
   */
  analyzeWebStructure(structure) {
    const analysis = {
      totalPages: 0,
      technologies: new Set(),
      apis: new Set()
    };

    this.walkWebStructure(structure, analysis);

    return {
      ...analysis,
      technologies: Array.from(analysis.technologies),
      apis: Array.from(analysis.apis)
    };
  }

  /**
   * Parcourt récursivement une structure web
   */
  walkWebStructure(node, analysis) {
    if (node.type === 'web_page') {
      analysis.totalPages++;
      
      // Détecter les technologies par content-type ou URL
      if (node.metadata) {
        this.detectWebTechnologies(node, analysis.technologies);
        this.detectWebAPIs(node, analysis.apis);
      }
    }

    if (node.children) {
      node.children.forEach(child => this.walkWebStructure(child, analysis));
    }
  }

  /**
   * Détecte les technologies web
   */
  detectWebTechnologies(node, technologies) {
    const url = node.path.toLowerCase();
    const contentType = node.metadata?.contentType?.toLowerCase() || '';

    if (contentType.includes('application/json')) {
      technologies.add('JSON API');
    }
    if (url.includes('/api/') || url.includes('/rest/')) {
      technologies.add('REST API');
    }
    if (url.includes('/graphql')) {
      technologies.add('GraphQL');
    }
    if (contentType.includes('text/html')) {
      technologies.add('HTML');
    }
  }

  /**
   * Détecte les APIs web
   */
  detectWebAPIs(node, apis) {
    const url = node.path;
    
    if (url.includes('/api/')) {
      apis.add('REST API');
    }
    if (url.includes('/graphql')) {
      apis.add('GraphQL');
    }
    if (url.includes('/webhook')) {
      apis.add('Webhooks');
    }
  }

  /**
   * Détecte le langage par extension
   */
  detectLanguageFromExtension(extension) {
    const languageMap = {
      '.js': 'javascript',
      '.py': 'python',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.java': 'java',
      '.html': 'html',
      '.css': 'css'
    };
    return languageMap[extension?.toLowerCase()];
  }

  /**
   * Vérifie si un fichier est un fichier de configuration
   */
  isConfigFile(fileName) {
    const configPatterns = [
      'config', 'settings', '.env', 'docker', 'nginx.conf', 
      'apache.conf', 'package.json', 'requirements.txt'
    ];
    return configPatterns.some(pattern => 
      fileName.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Fusionne les résultats
   */
  mergeResults(target, source) {
    if (source.analysis) {
      target.totalFiles += source.analysis.totalFiles || 0;
      target.totalNodes += source.analysis.totalDirectories || source.analysis.totalPages || 0;
      
      if (source.analysis.languages) {
        source.analysis.languages.forEach(lang => target.languages.add(lang));
      }
      if (source.analysis.services) {
        source.analysis.services.forEach(service => target.services.add(service));
      }
      if (source.analysis.technologies) {
        source.analysis.technologies.forEach(tech => target.infrastructure.add(tech));
      }
    }
  }
}

module.exports = DistributedScanner;
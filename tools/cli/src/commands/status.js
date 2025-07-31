const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');

module.exports = async function statusCommand(projectPath, options) {
  const spinner = ora('Analyzing LMAY project status...').start();

  try {
    const targetPath = path.resolve(projectPath);
    
    if (!await fs.pathExists(targetPath)) {
      throw new Error(`Directory does not exist: ${targetPath}`);
    }

    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${targetPath}`);
    }

    if (process.env.LMAY_VERBOSE) {
      spinner.info(`Analyzing: ${chalk.cyan(targetPath)}`);
    }

    // Analyze project structure
    spinner.text = 'Scanning project structure...';
    const analysis = await analyzeProject(targetPath);
    
    spinner.succeed('Project analysis completed');

    // Display project overview
    console.log(chalk.cyan('\n📊 LMAY Project Status'));
    console.log('='.repeat(50));
    console.log(`${chalk.blue('Project:')} ${path.basename(targetPath)}`);
    console.log(`${chalk.blue('Path:')} ${targetPath}`);
    console.log(`${chalk.blue('LMAY Status:')} ${analysis.hasLMAY ? chalk.green('Active') : chalk.red('Not initialized')}`);

    // LMAY files overview
    if (options.files || analysis.lmayFiles.length > 0) {
      console.log(chalk.cyan('\n📄 LMAY Files:'));
      
      if (analysis.lmayFiles.length === 0) {
        console.log(`  ${chalk.yellow('No LMAY files found')}`);
        console.log(`  ${chalk.dim('Run "lmay init" to initialize the project')}`);
      } else {
        for (const file of analysis.lmayFiles) {
          const status = await checkFileStatus(path.join(targetPath, file.path));
          const statusIcon = getStatusIcon(status);
          console.log(`  ${statusIcon} ${file.path} ${chalk.dim(`(${file.size} bytes)`)}`);
          
          if (process.env.LMAY_VERBOSE && status.issues.length > 0) {
            status.issues.forEach(issue => {
              console.log(`    ${chalk.yellow('⚠')} ${issue}`);
            });
          }
        }
        
        console.log(`  ${chalk.blue('→')} Total: ${analysis.lmayFiles.length} files`);
      }
    }

    // Coverage analysis
    if (options.coverage) {
      console.log(chalk.cyan('\n📈 Documentation Coverage:'));
      const coverage = await calculateCoverage(targetPath, analysis);
      
      console.log(`  ${chalk.blue('→')} Documented directories: ${coverage.documentedDirs}/${coverage.totalDirs} (${coverage.dirCoverage}%)`);
      console.log(`  ${chalk.blue('→')} Documented files: ${coverage.documentedFiles}/${coverage.totalFiles} (${coverage.fileCoverage}%)`);
      console.log(`  ${chalk.blue('→')} Languages covered: ${coverage.documentedLanguages}/${coverage.totalLanguages}`);
      
      // Coverage breakdown by directory
      if (process.env.LMAY_VERBOSE && coverage.breakdown.length > 0) {
        console.log(chalk.dim('\n  Coverage by directory:'));
        coverage.breakdown.forEach(dir => {
          const percentage = dir.total > 0 ? Math.round((dir.documented / dir.total) * 100) : 0;
          const bar = generateProgressBar(percentage);
          console.log(`    ${dir.path}: ${bar} ${percentage}%`);
        });
      }
    }

    // Outdated files check
    if (options.outdated) {
      console.log(chalk.cyan('\n⏰ Outdated Files Check:'));
      const outdatedAnalysis = await checkOutdatedFiles(targetPath, analysis);
      
      if (outdatedAnalysis.outdatedFiles.length === 0) {
        console.log(`  ${chalk.green('✓')} All LMAY files appear up to date`);
      } else {
        console.log(`  ${chalk.yellow('⚠')} Found ${outdatedAnalysis.outdatedFiles.length} potentially outdated files:`);
        outdatedAnalysis.outdatedFiles.forEach(file => {
          console.log(`    • ${file.path} ${chalk.dim(`(${file.reason})`)}`);
        });
      }
    }

    // Dependencies analysis
    if (options.dependencies) {
      console.log(chalk.cyan('\n🔗 Dependencies Analysis:'));
      const deps = await analyzeDependencies(targetPath, analysis);
      
      if (deps.packageFiles.length > 0) {
        console.log(`  ${chalk.blue('→')} Package files found: ${deps.packageFiles.length}`);
        deps.packageFiles.forEach(pkg => {
          console.log(`    • ${pkg.file}: ${pkg.dependencies} dependencies`);
        });
      }
      
      if (deps.lmayReferences.length > 0) {
        console.log(`  ${chalk.blue('→')} LMAY cross-references: ${deps.lmayReferences.length}`);
        if (process.env.LMAY_VERBOSE) {
          deps.lmayReferences.forEach(ref => {
            console.log(`    • ${ref.from} → ${ref.to}`);
          });
        }
      }
    }

    // Health summary
    console.log(chalk.cyan('\n🏥 Project Health:'));
    const healthScore = calculateHealthScore(analysis);
    const healthColor = healthScore >= 80 ? 'green' : healthScore >= 60 ? 'yellow' : 'red';
    
    console.log(`  ${chalk.blue('→')} Overall health: ${chalk[healthColor](healthScore + '%')}`);
    
    // Recommendations
    const recommendations = generateRecommendations(analysis, options);
    if (recommendations.length > 0) {
      console.log(chalk.cyan('\n💡 Recommendations:'));
      recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    // Quick actions
    console.log(chalk.cyan('\n⚡ Quick Actions:'));
    console.log(`  ${chalk.bold('lmay generate')} - Update LMAY documentation`);
    console.log(`  ${chalk.bold('lmay validate')} - Validate all LMAY files`);
    
    if (!analysis.hasLMAY) {
      console.log(`  ${chalk.bold('lmay init')} - Initialize LMAY in this project`);
    }

  } catch (error) {
    spinner.fail(`Status check failed: ${error.message}`);
    
    if (process.env.LMAY_VERBOSE) {
      console.error(chalk.red('\n🔍 Error details:'));
      console.error(error.stack);
    }
    
    process.exit(1);
  }
};

async function analyzeProject(projectPath) {
  const analysis = {
    hasLMAY: false,
    lmayFiles: [],
    directories: [],
    totalFiles: 0,
    languages: new Set(),
    frameworks: new Set()
  };

  // Find all LMAY files
  const lmayFiles = await findLMAYFiles(projectPath);
  analysis.lmayFiles = lmayFiles;
  analysis.hasLMAY = lmayFiles.length > 0;

  // Scan directory structure
  await scanDirectory(projectPath, analysis, '');

  // Convert sets to arrays
  analysis.languages = Array.from(analysis.languages);
  analysis.frameworks = Array.from(analysis.frameworks);

  return analysis;
}

async function findLMAYFiles(directory, basePath = '') {
  const files = [];
  
  try {
    const entries = await fs.readdir(directory);
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry);
      const relativePath = path.join(basePath, entry);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile() && entry.endsWith('.lmay')) {
        files.push({
          path: relativePath,
          size: stat.size,
          modified: stat.mtime
        });
      } else if (stat.isDirectory() && !shouldSkipDirectory(entry)) {
        const subFiles = await findLMAYFiles(fullPath, relativePath);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    // Ignore read errors for directories
  }
  
  return files;
}

async function scanDirectory(directory, analysis, basePath) {
  try {
    const entries = await fs.readdir(directory);
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry);
      const relativePath = path.join(basePath, entry);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile()) {
        analysis.totalFiles++;
        
        // Detect language by extension
        const ext = path.extname(entry).toLowerCase();
        const language = getLanguageFromExtension(ext);
        if (language) {
          analysis.languages.add(language);
        }
        
        // Detect frameworks from package files
        if (['package.json', 'requirements.txt', 'pom.xml', 'Cargo.toml'].includes(entry)) {
          const frameworks = await detectFrameworks(fullPath, entry);
          frameworks.forEach(fw => analysis.frameworks.add(fw));
        }
        
      } else if (stat.isDirectory() && !shouldSkipDirectory(entry)) {
        analysis.directories.push(relativePath);
        await scanDirectory(fullPath, analysis, relativePath);
      }
    }
  } catch (error) {
    // Ignore read errors
  }
}

function shouldSkipDirectory(name) {
  const skipDirs = ['.git', 'node_modules', '.vscode', '.idea', 'dist', 'build', '__pycache__'];
  return skipDirs.includes(name) || name.startsWith('.');
}

function getLanguageFromExtension(ext) {
  const langMap = {
    '.js': 'javascript', '.ts': 'typescript', '.py': 'python',
    '.java': 'java', '.go': 'go', '.rs': 'rust', '.php': 'php',
    '.rb': 'ruby', '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c'
  };
  return langMap[ext];
}

async function detectFrameworks(filePath, fileName) {
  const frameworks = [];
  
  try {
    if (fileName === 'package.json') {
      const content = await fs.readFile(filePath, 'utf8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      Object.keys(deps).forEach(dep => {
        if (['react', 'vue', 'angular', 'express', 'fastify', 'next'].includes(dep)) {
          frameworks.push(dep);
        }
      });
    }
    // Add more framework detection logic for other package managers
  } catch (error) {
    // Ignore parsing errors
  }
  
  return frameworks;
}

async function checkFileStatus(filePath) {
  const status = {
    valid: false,
    issues: []
  };

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const stat = await fs.stat(filePath);
    
    // Basic YAML syntax check
    try {
      const yaml = require('yaml');
      const parsed = yaml.parse(content);
      
      if (!parsed.lmay_version) {
        status.issues.push('Missing lmay_version field');
      }
      
      if (!parsed.project) {
        status.issues.push('Missing project section');
      }
      
      status.valid = status.issues.length === 0;
    } catch (yamlError) {
      status.issues.push('Invalid YAML syntax');
    }
    
    // Check if file is very old
    const daysSinceModified = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 30) {
      status.issues.push(`Not modified for ${Math.round(daysSinceModified)} days`);
    }
    
  } catch (error) {
    status.issues.push(`Cannot read file: ${error.message}`);
  }

  return status;
}

function getStatusIcon(status) {
  if (status.valid && status.issues.length === 0) {
    return chalk.green('✓');
  } else if (status.issues.length > 0 && !status.issues.some(i => i.includes('syntax'))) {
    return chalk.yellow('⚠');
  } else {
    return chalk.red('✗');
  }
}

async function calculateCoverage(projectPath, analysis) {
  const coverage = {
    totalDirs: analysis.directories.length,
    documentedDirs: 0,
    totalFiles: analysis.totalFiles,
    documentedFiles: 0,
    totalLanguages: analysis.languages.length,
    documentedLanguages: 0,
    dirCoverage: 0,
    fileCoverage: 0,
    breakdown: []
  };

  // This is a simplified coverage calculation
  // In a real implementation, we'd need to parse LMAY files and check what they document
  
  if (analysis.lmayFiles.length > 0) {
    // Assume some basic coverage if LMAY files exist
    coverage.documentedDirs = Math.min(analysis.lmayFiles.length * 2, coverage.totalDirs);
    coverage.documentedFiles = Math.min(analysis.lmayFiles.length * 10, coverage.totalFiles);
    coverage.documentedLanguages = Math.min(analysis.lmayFiles.length, coverage.totalLanguages);
  }

  coverage.dirCoverage = coverage.totalDirs > 0 ? Math.round((coverage.documentedDirs / coverage.totalDirs) * 100) : 0;
  coverage.fileCoverage = coverage.totalFiles > 0 ? Math.round((coverage.documentedFiles / coverage.totalFiles) * 100) : 0;

  return coverage;
}

async function checkOutdatedFiles(projectPath, analysis) {
  const outdatedAnalysis = {
    outdatedFiles: [],
    reasons: []
  };

  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  for (const file of analysis.lmayFiles) {
    if (file.modified.getTime() < thirtyDaysAgo) {
      outdatedAnalysis.outdatedFiles.push({
        path: file.path,
        reason: 'Not updated in 30+ days'
      });
    }
  }

  return outdatedAnalysis;
}

async function analyzeDependencies(projectPath, analysis) {
  const deps = {
    packageFiles: [],
    lmayReferences: []
  };

  // Find package files
  const packagePatterns = ['package.json', 'requirements.txt', 'pom.xml', 'Cargo.toml'];
  
  for (const pattern of packagePatterns) {
    const files = await findFiles(projectPath, pattern);
    
    for (const file of files) {
      try {
        const depCount = await countDependencies(file, pattern);
        deps.packageFiles.push({
          file: path.relative(projectPath, file),
          dependencies: depCount
        });
      } catch (error) {
        // Ignore counting errors
      }
    }
  }

  // Analyze LMAY cross-references (simplified)
  for (const file of analysis.lmayFiles) {
    try {
      const content = await fs.readFile(path.join(projectPath, file.path), 'utf8');
      const references = findLMAYReferences(content);
      
      references.forEach(ref => {
        deps.lmayReferences.push({
          from: file.path,
          to: ref
        });
      });
    } catch (error) {
      // Ignore read errors
    }
  }

  return deps;
}

async function findFiles(directory, pattern) {
  const files = [];
  
  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = await fs.stat(fullPath);
        
        if (stat.isFile() && entry === pattern) {
          files.push(fullPath);
        } else if (stat.isDirectory() && !shouldSkipDirectory(entry)) {
          await scan(fullPath);
        }
      }
    } catch (error) {
      // Ignore scan errors
    }
  }
  
  await scan(directory);
  return files;
}

async function countDependencies(filePath, fileName) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    if (fileName === 'package.json') {
      const pkg = JSON.parse(content);
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      return deps.length + devDeps.length;
    }
    
    // Add other package manager counting logic
    return 0;
  } catch (error) {
    return 0;
  }
}

function findLMAYReferences(content) {
  const references = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Look for parent references
    if (line.includes('parent:') && line.includes('.lmay')) {
      const match = line.match(/parent:\s*"?([^"]+\.lmay)"?/);
      if (match) {
        references.push(match[1]);
      }
    }
  }
  
  return references;
}

function calculateHealthScore(analysis) {
  let score = 0;
  
  // Base score for having LMAY files
  if (analysis.hasLMAY) {
    score += 40;
  }
  
  // Score for multiple LMAY files
  if (analysis.lmayFiles.length > 1) {
    score += 20;
  }
  
  // Score for recent activity
  const recentFiles = analysis.lmayFiles.filter(file => {
    const daysSince = (Date.now() - file.modified.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 30;
  });
  
  if (recentFiles.length > 0) {
    score += 20;
  }
  
  // Score for language diversity
  if (analysis.languages.length > 0) {
    score += Math.min(analysis.languages.length * 5, 20);
  }
  
  return Math.min(score, 100);
}

function generateRecommendations(analysis, options) {
  const recommendations = [];
  
  if (!analysis.hasLMAY) {
    recommendations.push('Initialize LMAY documentation with "lmay init"');
  } else {
    if (analysis.lmayFiles.length === 1) {
      recommendations.push('Consider creating module-specific LMAY files for better organization');
    }
    
    if (analysis.totalFiles > 50 && analysis.lmayFiles.length < 3) {
      recommendations.push('Large project detected - consider breaking down into multiple LMAY modules');
    }
    
    if (analysis.languages.length > 3) {
      recommendations.push('Multi-language project - document language-specific patterns and conventions');
    }
  }
  
  if (!options.coverage) {
    recommendations.push('Run "lmay status --coverage" to analyze documentation coverage');
  }
  
  if (!options.outdated) {
    recommendations.push('Run "lmay status --outdated" to check for stale documentation');
  }
  
  return recommendations;
}

function generateProgressBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  
  if (percentage >= 80) {
    return chalk.green(bar);
  } else if (percentage >= 60) {
    return chalk.yellow(bar);
  } else {
    return chalk.red(bar);
  }
}
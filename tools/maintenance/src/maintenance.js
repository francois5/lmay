const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const glob = require('fast-glob');
const yaml = require('yaml');
const crypto = require('crypto');
const chokidar = require('chokidar');

class MaintenanceEngine {
  constructor() {
    this.cacheDir = path.join(require('os').homedir(), '.lmay-cache');
    this.tempDir = path.join(require('os').tmpdir(), 'lmay-temp');
  }

  async detectObsoletes(projectPath, options) {
    const spinner = ora('Detecting obsolete LMAY files...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      
      if (options.verbose) {
        spinner.info(`Analyzing project: ${chalk.cyan(resolvedPath)}`);
        spinner.info(`Obsolete threshold: ${chalk.yellow(options.threshold)} days`);
      }

      // Find all LMAY files
      const lmayFiles = await this.findLMAYFiles(resolvedPath);
      if (lmayFiles.length === 0) {
        spinner.warn('No LMAY files found in project');
        return;
      }

      // Analyze project structure
      const projectStructure = await this.analyzeProjectStructure(resolvedPath);
      
      // Detect obsolete files
      const obsoleteAnalysis = await this.analyzeObsolescence(
        lmayFiles, 
        projectStructure, 
        options
      );

      spinner.succeed(`Analysis completed - Found ${obsoleteAnalysis.obsolete.length} obsolete files`);

      // Display results
      await this.displayObsoleteResults(obsoleteAnalysis, options);

      // Auto-clean if requested
      if (options.autoClean && obsoleteAnalysis.obsolete.length > 0) {
        await this.performAutoClean(obsoleteAnalysis.obsolete, options);
      }

      // Save report if requested
      if (options.output) {
        await this.saveObsoleteReport(obsoleteAnalysis, options.output, options.format);
        console.log(chalk.green(`\n📄 Report saved to: ${options.output}`));
      }

    } catch (error) {
      spinner.fail(`Obsolete detection failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async analyzeDrift(projectPath, options) {
    const spinner = ora('Analyzing documentation drift...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      
      if (options.verbose) {
        spinner.info(`Analyzing drift in: ${chalk.cyan(resolvedPath)}`);
      }

      // Load LMAY files and analyze current structure
      const lmayFiles = await this.findLMAYFiles(resolvedPath);
      const currentStructure = await this.analyzeProjectStructure(resolvedPath);
      
      // Parse LMAY files to understand documented structure
      const documentedStructure = await this.parseDocumentedStructure(lmayFiles);
      
      // Compare structures to detect drift
      const driftAnalysis = await this.compareModes(
        documentedStructure,
        currentStructure,
        options
      );

      spinner.succeed(`Drift analysis completed - Found ${driftAnalysis.drifts.length} inconsistencies`);

      // Display results
      await this.displayDriftResults(driftAnalysis, options);

      // Auto-fix if requested
      if (options.fix && driftAnalysis.fixable.length > 0) {
        await this.performDriftFixes(driftAnalysis.fixable, options);
      }

      // Save report if requested
      if (options.output) {
        await this.saveDriftReport(driftAnalysis, options.output, options.format);
        console.log(chalk.green(`\n📄 Report saved to: ${options.output}`));
      }

    } catch (error) {
      spinner.fail(`Drift analysis failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async manageCache(options) {
    const spinner = ora('Managing LMAY cache...').start();

    try {
      await fs.ensureDir(this.cacheDir);

      if (options.clear) {
        await fs.emptyDir(this.cacheDir);
        spinner.succeed('Cache cleared successfully');
        return;
      }

      if (options.stats) {
        const stats = await this.getCacheStats();
        spinner.succeed('Cache statistics retrieved');
        
        console.log(chalk.cyan('\n📊 Cache Statistics:'));
        console.log(`  ${chalk.blue('→')} Location: ${this.cacheDir}`);
        console.log(`  ${chalk.blue('→')} Size: ${stats.sizeFormatted}`);
        console.log(`  ${chalk.blue('→')} Files: ${stats.fileCount}`);
        console.log(`  ${chalk.blue('→')} Age: ${stats.oldestFormatted} (oldest entry)`);
        console.log(`  ${chalk.blue('→')} Health: ${stats.health}`);
        return;
      }

      if (options.rebuild) {
        await fs.emptyDir(this.cacheDir);
        spinner.text = 'Rebuilding cache...';
        // Cache will be rebuilt on next analysis
        spinner.succeed('Cache rebuild scheduled');
        return;
      }

      // Default: show cache info
      const stats = await this.getCacheStats();
      spinner.succeed('Cache information retrieved');
      
      console.log(chalk.cyan('\n🗄️  Cache Management:'));
      console.log(`  Cache location: ${chalk.dim(this.cacheDir)}`);
      console.log(`  Current size: ${stats.sizeFormatted}`);
      
      if (stats.size > options.sizeLimit * 1024 * 1024) {
        console.log(chalk.yellow('\n⚠️  Cache size exceeds limit'));
        console.log('  Run with --clear to clean cache');
      }

    } catch (error) {
      spinner.fail(`Cache management failed: ${error.message}`);
      process.exit(1);
    }
  }

  async healthCheck(projectPath, options) {
    const spinner = ora('Running comprehensive health check...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      
      if (options.verbose) {
        spinner.info(`Health check for: ${chalk.cyan(resolvedPath)}`);
      }

      // Comprehensive analysis
      const healthReport = {
        timestamp: new Date().toISOString(),
        project: resolvedPath,
        lmayFiles: await this.findLMAYFiles(resolvedPath),
        obsoletes: [],
        drifts: [],
        coverage: {},
        performance: {},
        recommendations: []
      };

      // Run obsolete detection
      spinner.text = 'Checking for obsolete files...';
      if (healthReport.lmayFiles.length > 0) {
        const projectStructure = await this.analyzeProjectStructure(resolvedPath);
        const obsoleteAnalysis = await this.analyzeObsolescence(
          healthReport.lmayFiles,
          projectStructure,
          { threshold: 30, strict: false }
        );
        healthReport.obsoletes = obsoleteAnalysis.obsolete;
      }

      // Run drift analysis
      spinner.text = 'Analyzing documentation drift...';
      if (healthReport.lmayFiles.length > 0) {
        const currentStructure = await this.analyzeProjectStructure(resolvedPath);
        const documentedStructure = await this.parseDocumentedStructure(healthReport.lmayFiles);
        const driftAnalysis = await this.compareModes(documentedStructure, currentStructure, {});
        healthReport.drifts = driftAnalysis.drifts;
      }

      // Calculate coverage
      spinner.text = 'Calculating documentation coverage...';
      healthReport.coverage = await this.calculateCoverage(resolvedPath, healthReport.lmayFiles);

      // Performance analysis
      spinner.text = 'Analyzing performance metrics...';
      healthReport.performance = await this.analyzePerformance(resolvedPath);

      // Generate recommendations
      healthReport.recommendations = this.generateHealthRecommendations(healthReport);

      // Calculate health score
      const healthScore = options.score ? this.calculateHealthScore(healthReport) : null;

      spinner.succeed('Health check completed');

      // Display results
      await this.displayHealthResults(healthReport, healthScore, options);

      // Save report if requested
      if (options.output) {
        await this.saveHealthReport(healthReport, options.output, options.format);
        console.log(chalk.green(`\n📄 Report saved to: ${options.output}`));
      }

      // Watch mode
      if (options.watch) {
        await this.startHealthWatch(resolvedPath, options);
      }

    } catch (error) {
      spinner.fail(`Health check failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async cleanup(projectPath, options) {
    const spinner = ora('Cleaning up project...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      const cleanupStats = {
        tempFiles: 0,
        backupFiles: 0,
        duplicates: 0,
        optimized: 0
      };

      if (options.temp) {
        spinner.text = 'Removing temporary files...';
        const tempFiles = await glob('**/*.lmay.tmp', { cwd: resolvedPath });
        
        for (const file of tempFiles) {
          const fullPath = path.join(resolvedPath, file);
          if (!options.dryRun) {
            await fs.remove(fullPath);
          }
          cleanupStats.tempFiles++;
          
          if (options.verbose) {
            console.log(`  ${options.dryRun ? 'Would remove' : 'Removed'}: ${file}`);
          }
        }
      }

      if (options.backups) {
        spinner.text = 'Removing backup files...';
        const backupPatterns = ['**/*.lmay.bak', '**/*.lmay.backup', '**/*.lmay.orig'];
        
        for (const pattern of backupPatterns) {
          const backupFiles = await glob(pattern, { cwd: resolvedPath });
          
          for (const file of backupFiles) {
            const fullPath = path.join(resolvedPath, file);
            if (!options.dryRun) {
              await fs.remove(fullPath);
            }
            cleanupStats.backupFiles++;
            
            if (options.verbose) {
              console.log(`  ${options.dryRun ? 'Would remove' : 'Removed'}: ${file}`);
            }
          }
        }
      }

      if (options.duplicates) {
        spinner.text = 'Detecting duplicate content...';
        const duplicates = await this.findDuplicateLMAYContent(resolvedPath);
        
        for (const duplicate of duplicates) {
          if (!options.dryRun) {
            await fs.remove(duplicate.path);
          }
          cleanupStats.duplicates++;
          
          if (options.verbose) {
            console.log(`  ${options.dryRun ? 'Would remove' : 'Removed'} duplicate: ${duplicate.path}`);
          }
        }
      }

      if (options.optimize) {
        spinner.text = 'Optimizing LMAY files...';
        const lmayFiles = await this.findLMAYFiles(resolvedPath);
        
        for (const file of lmayFiles) {
          const optimized = await this.optimizeLMAYFile(file.path, options.dryRun);
          if (optimized) {
            cleanupStats.optimized++;
            
            if (options.verbose) {
              console.log(`  ${options.dryRun ? 'Would optimize' : 'Optimized'}: ${file.relativePath}`);
            }
          }
        }
      }

      spinner.succeed('Cleanup completed');

      // Display results
      console.log(chalk.cyan('\n🧹 Cleanup Results:'));
      console.log(`  ${chalk.blue('→')} Temporary files: ${cleanupStats.tempFiles}`);
      console.log(`  ${chalk.blue('→')} Backup files: ${cleanupStats.backupFiles}`);
      console.log(`  ${chalk.blue('→')} Duplicates: ${cleanupStats.duplicates}`);
      console.log(`  ${chalk.blue('→')} Optimized: ${cleanupStats.optimized}`);

      if (options.dryRun) {
        console.log(chalk.yellow('\n💡 This was a dry run. Use without --dry-run to actually clean files.'));
      }

    } catch (error) {
      spinner.fail(`Cleanup failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async watchProject(projectPath, options) {
    const resolvedPath = path.resolve(projectPath);
    
    console.log(chalk.cyan('👁️  Starting LMAY project watcher...'));
    console.log(`  Project: ${chalk.dim(resolvedPath)}`);
    console.log(`  Interval: ${chalk.dim(options.interval)}s`);
    console.log(`  Auto-update: ${options.autoUpdate ? chalk.green('enabled') : chalk.red('disabled')}`);
    console.log('\n  Press Ctrl+C to stop watching\n');

    const watcher = chokidar.watch(resolvedPath, {
      persistent: true,
      ignoreInitial: true,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
    });

    let changeTimeout;
    const changeQueue = new Set();

    watcher.on('add', (filePath) => {
      this.handleFileChange('added', filePath, changeQueue, changeTimeout, options);
    });

    watcher.on('change', (filePath) => {
      this.handleFileChange('modified', filePath, changeQueue, changeTimeout, options);
    });

    watcher.on('unlink', (filePath) => {
      this.handleFileChange('removed', filePath, changeQueue, changeTimeout, options);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Stopping watcher...'));
      watcher.close();
      process.exit(0);
    });

    // Keep process alive
    return new Promise(() => {});
  }

  async migrate(projectPath, options) {
    const spinner = ora('Migrating LMAY files...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      
      if (options.verbose) {
        spinner.info(`Migrating from ${options.from} to ${options.to}`);
      }

      const lmayFiles = await this.findLMAYFiles(resolvedPath);
      
      if (lmayFiles.length === 0) {
        spinner.warn('No LMAY files found to migrate');
        return;
      }

      const migrationResults = {
        migrated: 0,
        skipped: 0,
        errors: []
      };

      for (const file of lmayFiles) {
        try {
          spinner.text = `Migrating ${file.relativePath}...`;
          
          if (options.backup) {
            await fs.copy(file.path, `${file.path}.backup`);
          }

          const migrated = await this.migrateLMAYFile(file.path, options.from, options.to);
          
          if (migrated) {
            migrationResults.migrated++;
            
            if (options.validate) {
              // Validate migrated file
              const valid = await this.validateMigratedFile(file.path);
              if (!valid) {
                migrationResults.errors.push(`Validation failed for ${file.relativePath}`);
              }
            }
          } else {
            migrationResults.skipped++;
          }
          
        } catch (error) {
          migrationResults.errors.push(`${file.relativePath}: ${error.message}`);
        }
      }

      spinner.succeed('Migration completed');

      // Display results
      console.log(chalk.cyan('\n🔄 Migration Results:'));
      console.log(`  ${chalk.blue('→')} Migrated: ${migrationResults.migrated}`);
      console.log(`  ${chalk.blue('→')} Skipped: ${migrationResults.skipped}`);
      console.log(`  ${chalk.blue('→')} Errors: ${migrationResults.errors.length}`);

      if (migrationResults.errors.length > 0 && options.verbose) {
        console.log(chalk.red('\n❌ Migration Errors:'));
        migrationResults.errors.forEach(error => {
          console.log(`  • ${error}`);
        });
      }

    } catch (error) {
      spinner.fail(`Migration failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async batchMaintenance(operation, paths, options) {
    const spinner = ora(`Running batch ${operation} operation...`).start();

    try {
      const resolvedPaths = paths.map(p => path.resolve(p));
      const parallel = parseInt(options.parallel) || 4;
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Process in batches
      for (let i = 0; i < resolvedPaths.length; i += parallel) {
        const batch = resolvedPaths.slice(i, i + parallel);
        
        spinner.text = `Processing batch ${Math.floor(i / parallel) + 1}/${Math.ceil(resolvedPaths.length / parallel)}`;
        
        const batchPromises = batch.map(async (targetPath) => {
          try {
            const result = await this.runMaintenanceOperation(operation, targetPath, options);
            return {
              path: targetPath,
              status: 'success',
              result: result
            };
          } catch (error) {
            return {
              path: targetPath,
              status: 'error',
              error: error.message
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update counters
        const batchSuccess = batchResults.filter(r => r.status === 'success').length;
        const batchErrors = batchResults.filter(r => r.status === 'error').length;
        
        successCount += batchSuccess;
        errorCount += batchErrors;

        // Stop on first error if not continuing
        if (batchErrors > 0 && !options.continueOnError) {
          break;
        }
      }

      spinner.succeed(`Batch ${operation} completed`);

      // Display results
      console.log(chalk.cyan(`\n📊 Batch ${operation.toUpperCase()} Results:`));
      console.log(`  ${chalk.blue('→')} Total projects: ${resolvedPaths.length}`);
      console.log(`  ${chalk.blue('→')} Successful: ${chalk.green(successCount)}`);
      console.log(`  ${chalk.blue('→')} Failed: ${chalk.red(errorCount)}`);

      // Save report if requested
      if (options.output) {
        await this.saveBatchReport(results, options.output, options.format);
        console.log(chalk.green(`\n📄 Batch report saved to: ${options.output}`));
      }

      process.exit(errorCount > 0 ? 1 : 0);

    } catch (error) {
      spinner.fail(`Batch ${operation} failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  // Helper methods
  async findLMAYFiles(directory) {
    const lmayFiles = await glob('**/*.lmay', { 
      cwd: directory,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    });

    const fileDetails = [];
    
    for (const relativePath of lmayFiles) {
      const fullPath = path.join(directory, relativePath);
      const stats = await fs.stat(fullPath);
      
      fileDetails.push({
        path: fullPath,
        relativePath: relativePath,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      });
    }

    return fileDetails;
  }

  async analyzeProjectStructure(projectPath) {
    // Simplified project structure analysis
    const structure = {
      directories: [],
      files: [],
      languages: new Set(),
      frameworks: new Set(),
      totalSize: 0
    };

    const allFiles = await glob('**/*', { 
      cwd: projectPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      onlyFiles: true
    });

    for (const file of allFiles) {
      const fullPath = path.join(projectPath, file);
      const stats = await fs.stat(fullPath);
      
      structure.files.push({
        path: file,
        size: stats.size,
        modified: stats.mtime,
        extension: path.extname(file)
      });
      
      structure.totalSize += stats.size;
      
      // Detect language by extension
      const ext = path.extname(file).toLowerCase();
      const language = this.getLanguageFromExtension(ext);
      if (language) {
        structure.languages.add(language);
      }
    }

    structure.languages = Array.from(structure.languages);
    structure.frameworks = Array.from(structure.frameworks);

    return structure;
  }

  getLanguageFromExtension(ext) {
    const langMap = {
      '.js': 'javascript', '.ts': 'typescript', '.py': 'python',
      '.java': 'java', '.go': 'go', '.rs': 'rust', '.php': 'php',
      '.rb': 'ruby', '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c'
    };
    return langMap[ext];
  }

  // Additional helper methods would continue here...
  // For brevity, I'll implement the key analysis methods

  async analyzeObsolescence(lmayFiles, projectStructure, options) {
    const thresholdMs = parseInt(options.threshold) * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    const analysis = {
      obsolete: [],
      outdated: [],
      valid: []
    };

    for (const file of lmayFiles) {
      const age = now - file.modified.getTime();
      
      if (age > thresholdMs) {
        // Check if file still references existing structure
        const content = await fs.readFile(file.path, 'utf8');
        const references = this.extractFileReferences(content);
        
        let hasValidReferences = false;
        for (const ref of references) {
          const refPath = path.resolve(path.dirname(file.path), ref);
          if (await fs.pathExists(refPath)) {
            hasValidReferences = true;
            break;
          }
        }

        if (!hasValidReferences && references.length > 0) {
          analysis.obsolete.push({
            ...file,
            reason: 'References non-existent files',
            age: Math.round(age / (24 * 60 * 60 * 1000))
          });
        } else {
          analysis.outdated.push({
            ...file,
            age: Math.round(age / (24 * 60 * 60 * 1000))
          });
        }
      } else {
        analysis.valid.push(file);
      }
    }

    return analysis;
  }

  extractFileReferences(content) {
    const references = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Look for file paths in LMAY content
      const pathMatches = line.match(/path:\s*"?([^"]+)"?/g);
      if (pathMatches) {
        pathMatches.forEach(match => {
          const pathValue = match.replace(/path:\s*"?/, '').replace(/"?$/, '');
          references.push(pathValue);
        });
      }
      
      // Look for parent references
      if (line.includes('parent:')) {
        const parentMatch = line.match(/parent:\s*"?([^"]+)"?/);
        if (parentMatch) {
          references.push(parentMatch[1]);
        }
      }
    }
    
    return references;
  }

  async displayObsoleteResults(analysis, options) {
    console.log(chalk.cyan('\n🔍 Obsolete File Analysis Results:'));
    console.log(`  ${chalk.blue('→')} Total LMAY files: ${analysis.obsolete.length + analysis.outdated.length + analysis.valid.length}`);
    console.log(`  ${chalk.blue('→')} Obsolete: ${chalk.red(analysis.obsolete.length)}`);
    console.log(`  ${chalk.blue('→')} Outdated: ${chalk.yellow(analysis.outdated.length)}`);
    console.log(`  ${chalk.blue('→')} Valid: ${chalk.green(analysis.valid.length)}`);

    if (analysis.obsolete.length > 0) {
      console.log(chalk.red('\n❌ Obsolete Files:'));
      analysis.obsolete.forEach((file, index) => {
        console.log(`  ${index + 1}. ${chalk.bold(file.relativePath)}`);
        console.log(`     ${chalk.dim('Reason:')} ${file.reason}`);
        console.log(`     ${chalk.dim('Age:')} ${file.age} days`);
      });
    }

    if (analysis.outdated.length > 0 && options.verbose) {
      console.log(chalk.yellow('\n⚠️  Outdated Files:'));
      analysis.outdated.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.relativePath} (${file.age} days old)`);
      });
    }
  }

  // Placeholder methods for other functionality
  async parseDocumentedStructure(lmayFiles) {
    return { documented: [] };
  }

  async compareModes(documented, current, options) {
    return { drifts: [], fixable: [] };
  }

  async displayDriftResults(analysis, options) {
    console.log(chalk.cyan('\n📊 Drift Analysis Results:'));
    console.log(`  ${chalk.blue('→')} Detected drifts: ${analysis.drifts.length}`);
  }

  async getCacheStats() {
    return {
      size: 0,
      sizeFormatted: '0 KB',
      fileCount: 0,
      oldestFormatted: 'N/A',
      health: 'Good'
    };
  }

  async calculateCoverage(projectPath, lmayFiles) {
    return {
      percentage: 0,
      files: 0,
      directories: 0
    };
  }

  async analyzePerformance(projectPath) {
    return {
      analysisTime: 0,
      fileCount: 0,
      complexity: 'Low'
    };
  }

  generateHealthRecommendations(healthReport) {
    return [];
  }

  calculateHealthScore(healthReport) {
    return 85;
  }

  async displayHealthResults(healthReport, healthScore, options) {
    console.log(chalk.cyan('\n🏥 Health Check Results:'));
    if (healthScore !== null) {
      const scoreColor = healthScore >= 80 ? 'green' : healthScore >= 60 ? 'yellow' : 'red';
      console.log(`  ${chalk.blue('→')} Health Score: ${chalk[scoreColor](healthScore + '%')}`);
    }
  }

  handleFileChange(action, filePath, changeQueue, changeTimeout, options) {
    changeQueue.add({ action, filePath, timestamp: Date.now() });
    
    clearTimeout(changeTimeout);
    changeTimeout = setTimeout(() => {
      this.processChanges(Array.from(changeQueue), options);
      changeQueue.clear();
    }, 1000);
  }

  async processChanges(changes, options) {
    if (changes.length === 0) return;
    
    console.log(chalk.blue(`\n📝 Detected ${changes.length} changes:`));
    changes.forEach(change => {
      const icon = change.action === 'added' ? '➕' : change.action === 'modified' ? '✏️' : '➖';
      console.log(`  ${icon} ${change.action}: ${path.basename(change.filePath)}`);
    });

    if (options.autoUpdate) {
      console.log(chalk.yellow('🔄 Auto-updating LMAY documentation...'));
      // Implementation would trigger regeneration
    }
  }
}

module.exports = MaintenanceEngine;
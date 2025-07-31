const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const chokidar = require('chokidar');
const git = require('simple-git');
const diff = require('diff');
const yaml = require('yaml');
const glob = require('glob');
const inquirer = require('inquirer');
const { minimatch } = require('minimatch');
const debounce = require('debounce');

class AutoUpdater {
  constructor() {
    this.configPath = path.join(require('os').homedir(), '.lmay-updater.json');
    this.defaultConfig = {
      updateStrategy: 'conservative', // conservative, aggressive, interactive
      autoCommit: false,
      debounceTime: 2000,
      backupOnUpdate: true,
      validateAfterUpdate: true,
      excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      includePatterns: ['**/*.js', '**/*.ts', '**/*.py', '**/*.java', '**/*.go', '**/*.rs'],
      hooks: {
        preCommit: true,
        postCommit: false,
        prePush: false
      }
    };
  }

  async watchForChanges(projectPath, options) {
    const spinner = ora('Initializing file watcher...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      const config = await this.loadConfig();
      
      if (options.verbose) {
        spinner.info(`Watching project: ${chalk.cyan(resolvedPath)}`);
        spinner.info(`Debounce time: ${chalk.yellow(options.debounce)}ms`);
      }

      // Parse include/exclude patterns
      const includePatterns = options.include ? options.include.split(',') : config.includePatterns;
      const excludePatterns = options.exclude ? options.exclude.split(',') : config.excludePatterns;

      // Setup file watcher
      const watcher = chokidar.watch(resolvedPath, {
        persistent: true,
        ignoreInitial: true,
        ignored: excludePatterns.map(pattern => path.join(resolvedPath, pattern))
      });

      const changeQueue = new Map();
      const debouncedUpdate = debounce(
        () => this.processChangeQueue(changeQueue, resolvedPath, options),
        parseInt(options.debounce) || config.debounceTime
      );

      watcher.on('add', (filePath) => {
        if (this.shouldProcessFile(filePath, includePatterns, excludePatterns)) {
          this.queueChange(changeQueue, 'added', filePath);
          debouncedUpdate();
        }
      });

      watcher.on('change', (filePath) => {
        if (this.shouldProcessFile(filePath, includePatterns, excludePatterns)) {
          this.queueChange(changeQueue, 'modified', filePath);
          debouncedUpdate();
        }
      });

      watcher.on('unlink', (filePath) => {
        if (this.shouldProcessFile(filePath, includePatterns, excludePatterns)) {
          this.queueChange(changeQueue, 'removed', filePath);
          debouncedUpdate();
        }
      });

      spinner.succeed('File watcher started successfully');

      console.log(chalk.cyan('\n👁️  Watching for changes...'));
      console.log(`  Project: ${chalk.dim(resolvedPath)}`);
      console.log(`  Include: ${chalk.dim(includePatterns.join(', '))}`);
      console.log(`  Exclude: ${chalk.dim(excludePatterns.join(', '))}`);
      console.log('\n  Press Ctrl+C to stop watching\n');

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Stopping watcher...'));
        watcher.close();
        process.exit(0);
      });

      // Keep process alive
      return new Promise(() => {});

    } catch (error) {
      spinner.fail(`Watch initialization failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async synchronize(projectPath, options) {
    const spinner = ora('Synchronizing LMAY documentation...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      
      if (options.verbose) {
        spinner.info(`Synchronizing: ${chalk.cyan(resolvedPath)}`);
      }

      // Analyze current project state
      const currentState = await this.analyzeCurrentState(resolvedPath);
      
      // Load existing LMAY files
      const lmayFiles = await this.findLMAYFiles(resolvedPath);
      
      // Compare and detect differences
      const differences = await this.detectDifferences(currentState, lmayFiles, resolvedPath);
      
      if (differences.length === 0 && !options.force) {
        spinner.succeed('LMAY documentation is already synchronized');
        return;
      }

      if (options.backup && lmayFiles.length > 0) {
        spinner.text = 'Creating backup...';
        await this.createBackup(resolvedPath, lmayFiles);
      }

      // Apply synchronization updates
      spinner.text = 'Applying synchronization updates...';
      const updateResults = await this.applySyncUpdates(differences, resolvedPath, options);

      if (options.validate) {
        spinner.text = 'Validating updates...';
        await this.validateUpdates(resolvedPath);
      }

      spinner.succeed(`Synchronization completed - Updated ${updateResults.updated} files`);

      // Display changes summary
      this.displaySyncResults(updateResults, options);

      // Save changes report if requested
      if (options.output) {
        await this.saveSyncReport(updateResults, options.output, options.format);
        console.log(chalk.green(`\n📄 Report saved to: ${options.output}`));
      }

    } catch (error) {
      spinner.fail(`Synchronization failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async detectChanges(projectPath, options) {
    const spinner = ora('Detecting refactoring changes...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      const gitRepo = git(resolvedPath);
      
      if (options.verbose) {
        spinner.info(`Analyzing changes in: ${chalk.cyan(resolvedPath)}`);
      }

      // Determine comparison range
      let comparisonBase = 'HEAD~1';
      if (options.since) {
        comparisonBase = options.since;
      } else if (options.branch) {
        comparisonBase = options.branch;
      }

      // Get Git changes
      const gitChanges = await this.getGitChanges(gitRepo, comparisonBase);
      
      // Analyze changes for LMAY impact
      const analysisResults = await this.analyzeChangesForLMAYImpact(gitChanges, resolvedPath);
      
      // Filter by threshold
      const significantChanges = analysisResults.changes.filter(
        change => change.impact >= parseInt(options.threshold || 5)
      );

      spinner.succeed(`Detection completed - Found ${significantChanges.length} significant changes`);

      // Display results
      this.displayDetectionResults(analysisResults, significantChanges, options);

      // Save detection report if requested
      if (options.output) {
        await this.saveDetectionReport(analysisResults, options.output, options.format);
        console.log(chalk.green(`\n📄 Report saved to: ${options.output}`));
      }

      return analysisResults;

    } catch (error) {
      spinner.fail(`Change detection failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async applyUpdates(projectPath, options) {
    const spinner = ora('Applying refactoring updates...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      
      // Load changes to apply
      let changesToApply;
      if (options.input) {
        changesToApply = await this.loadChangesFromFile(options.input);
      } else {
        // Detect changes automatically
        changesToApply = await this.detectChanges(resolvedPath, { threshold: 1 });
      }

      if (!changesToApply || changesToApply.changes.length === 0) {
        spinner.warn('No changes to apply');
        return;
      }

      if (options.backup) {
        spinner.text = 'Creating backup...';
        const lmayFiles = await this.findLMAYFiles(resolvedPath);
        await this.createBackup(resolvedPath, lmayFiles);
      }

      // Process updates
      const updateResults = {
        applied: 0,
        skipped: 0,
        errors: []
      };

      for (const change of changesToApply.changes) {
        try {
          spinner.text = `Applying update: ${change.description}`;
          
          let shouldApply = true;
          
          // Interactive mode
          if (options.interactive && !options.autoApprove) {
            shouldApply = await this.promptForApproval(change);
          }
          // Auto-approve safe updates
          else if (options.autoApprove && change.safety !== 'safe') {
            shouldApply = false;
            updateResults.skipped++;
            continue;
          }

          if (shouldApply) {
            await this.applyIndividualUpdate(change, resolvedPath);
            updateResults.applied++;
            
            if (options.verbose) {
              console.log(`  ${chalk.green('✓')} Applied: ${change.description}`);
            }
          } else {
            updateResults.skipped++;
            
            if (options.verbose) {
              console.log(`  ${chalk.yellow('⏭')} Skipped: ${change.description}`);
            }
          }

        } catch (error) {
          updateResults.errors.push({
            change: change.description,
            error: error.message
          });
          
          if (options.verbose) {
            console.log(`  ${chalk.red('✗')} Failed: ${change.description} - ${error.message}`);
          }
        }
      }

      spinner.succeed(`Updates applied - ${updateResults.applied} applied, ${updateResults.skipped} skipped`);

      // Display results
      this.displayApplyResults(updateResults, options);

      if (updateResults.errors.length > 0) {
        console.log(chalk.red(`\n❌ Errors occurred during ${updateResults.errors.length} updates`));
        if (options.verbose) {
          updateResults.errors.forEach(error => {
            console.log(`  • ${error.change}: ${error.error}`);
          });
        }
      }

    } catch (error) {
      spinner.fail(`Update application failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async setupGitHooks(projectPath, options) {
    const spinner = ora('Setting up Git hooks...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      const gitRepo = git(resolvedPath);
      
      // Verify it's a Git repository
      const isRepo = await gitRepo.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a Git repository');
      }

      const hooksDir = path.join(resolvedPath, '.git', 'hooks');
      await fs.ensureDir(hooksDir);

      const hooksToSetup = [];
      
      if (options.all || options.preCommit) {
        hooksToSetup.push('pre-commit');
      }
      if (options.all || options.postCommit) {
        hooksToSetup.push('post-commit');
      }
      if (options.all || options.prePush) {
        hooksToSetup.push('pre-push');
      }

      if (options.remove) {
        await this.removeGitHooks(hooksDir, hooksToSetup);
        spinner.succeed('LMAY Git hooks removed');
        return;
      }

      if (hooksToSetup.length === 0) {
        hooksToSetup.push('pre-commit'); // Default
      }

      for (const hookName of hooksToSetup) {
        const hookPath = path.join(hooksDir, hookName);
        const hookContent = this.generateGitHookContent(hookName);
        
        // Check if hook already exists
        if (await fs.pathExists(hookPath)) {
          const existingContent = await fs.readFile(hookPath, 'utf8');
          if (existingContent.includes('lmay-updater')) {
            if (options.verbose) {
              console.log(`  ${chalk.yellow('⚠')} Hook ${hookName} already exists with LMAY integration`);
            }
            continue;
          }
          
          // Append to existing hook
          await fs.appendFile(hookPath, `\n\n# LMAY Auto-updater\n${hookContent}`);
        } else {
          // Create new hook
          await fs.writeFile(hookPath, `#!/bin/sh\n\n# LMAY Auto-updater\n${hookContent}`);
        }
        
        // Make executable
        await fs.chmod(hookPath, '755');
        
        if (options.verbose) {
          console.log(`  ${chalk.green('✓')} Setup ${hookName} hook`);
        }
      }

      spinner.succeed(`Git hooks setup completed - ${hooksToSetup.length} hooks configured`);

      console.log(chalk.cyan('\n🔗 Git Hooks Configured:'));
      hooksToSetup.forEach(hook => {
        console.log(`  ${chalk.blue('→')} ${hook}: LMAY auto-update integration`);
      });

      console.log(chalk.cyan('\n💡 Hooks will automatically:'));
      console.log('  • Detect refactoring changes before commits');
      console.log('  • Update LMAY documentation as needed');
      console.log('  • Validate documentation consistency');

    } catch (error) {
      spinner.fail(`Git hooks setup failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  async rollback(projectPath, options) {
    const spinner = ora('Preparing rollback...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      
      if (options.list) {
        const rollbackPoints = await this.listRollbackPoints(resolvedPath);
        spinner.succeed('Available rollback points retrieved');
        
        console.log(chalk.cyan('\n🔄 Available Rollback Points:'));
        rollbackPoints.forEach((point, index) => {
          console.log(`  ${index + 1}. ${point.timestamp} - ${point.description}`);
          console.log(`     ${chalk.dim('Commit:')} ${point.commit}`);
        });
        return;
      }

      // Perform rollback
      spinner.text = 'Executing rollback...';
      
      const rollbackResult = await this.executeRollback(resolvedPath, options);
      
      spinner.succeed(`Rollback completed - Restored to ${rollbackResult.targetPoint}`);

      console.log(chalk.cyan('\n🔄 Rollback Results:'));
      console.log(`  ${chalk.blue('→')} Target: ${rollbackResult.targetPoint}`);
      console.log(`  ${chalk.blue('→')} Files restored: ${rollbackResult.filesRestored}`);
      console.log(`  ${chalk.blue('→')} Changes reverted: ${rollbackResult.changesReverted}`);

    } catch (error) {
      spinner.fail(`Rollback failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }   
      process.exit(1);
    }
  }

  async batchUpdate(operation, paths, options) {
    const spinner = ora(`Initializing batch ${operation}...`).start();

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
            const result = await this.runUpdateOperation(operation, targetPath, options);
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
        await this.saveBatchUpdateReport(results, options.output, options.format);
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
  async loadConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const content = await fs.readFile(this.configPath, 'utf8');
        return { ...this.defaultConfig, ...JSON.parse(content) };
      }
    } catch (error) {
      // Fall back to defaults
    }
    return this.defaultConfig;
  }

  shouldProcessFile(filePath, includePatterns, excludePatterns) {
    // Check exclusions first
    for (const pattern of excludePatterns) {
      if (minimatch(filePath, pattern)) {
        return false;
      }
    }
    
    // Then check inclusions
    for (const pattern of includePatterns) {
      if (minimatch(filePath, pattern)) {
        return true;
      }
    }
    
    return false;
  }

  queueChange(changeQueue, action, filePath) {
    const key = filePath;
    const existing = changeQueue.get(key);
    
    if (existing) {
      existing.actions.add(action);
      existing.lastModified = Date.now();
    } else {
      changeQueue.set(key, {
        filePath,
        actions: new Set([action]),
        lastModified: Date.now()
      });
    }
  }

  async processChangeQueue(changeQueue, projectPath, options) {
    if (changeQueue.size === 0) return;

    const changes = Array.from(changeQueue.values());
    changeQueue.clear();

    console.log(chalk.blue(`\n📝 Processing ${changes.length} file changes...`));

    // Analyze changes for LMAY impact
    const impactAnalysis = await this.analyzeChangesForLMAYImpact(changes, projectPath);
    
    if (impactAnalysis.requiresUpdate) {
      if (options.dryRun) {
        console.log(chalk.yellow('🧪 Dry run - LMAY updates that would be applied:'));
        this.displayPendingUpdates(impactAnalysis.updates);
      } else {
        // Apply updates
        const updateResults = await this.applyAutoUpdates(impactAnalysis.updates, projectPath);
        console.log(chalk.green(`✅ Auto-updated ${updateResults.updated} LMAY files`));
        
        // Auto-commit if enabled
        if (options.autoCommit) {
          await this.autoCommitChanges(projectPath, updateResults);
        }
      }
    } else {
      console.log(chalk.dim('📋 Changes processed - No LMAY updates required'));
    }
  }

  async findLMAYFiles(directory) {
    const lmayFiles = [];
    const files = await glob('**/*.lmay', { cwd: directory });
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      const stats = await fs.stat(fullPath);
      
      lmayFiles.push({
        path: fullPath,
        relativePath: file,
        content: await fs.readFile(fullPath, 'utf8'),
        modified: stats.mtime
      });
    }
    
    return lmayFiles;
  }

  generateGitHookContent(hookName) {
    switch (hookName) {
      case 'pre-commit':
        return `
# Check for refactoring changes and update LMAY
if command -v lmay-updater >/dev/null 2>&1; then
  echo "🔍 Checking for LMAY updates..."
  lmay-updater detect --threshold 3 >/dev/null
  if [ $? -eq 0 ]; then
    lmay-updater sync --auto-approve
    if [ $? -eq 0 ]; then
      # Add updated LMAY files to commit
      git add "*.lmay"
      echo "✅ LMAY documentation updated"
    fi
  fi
fi
`;
      
      case 'post-commit':
        return `
# Validate LMAY consistency after commit
if command -v lmay-updater >/dev/null 2>&1; then
  lmay-updater sync --validate >/dev/null 2>&1 || echo "⚠️  LMAY validation warning - run 'lmay validate' to check"
fi
`;
      
      case 'pre-push':
        return `
# Ensure LMAY is synchronized before push
if command -v lmay-updater >/dev/null 2>&1; then
  echo "🔍 Final LMAY synchronization check..."
  lmay-updater sync --force --validate
  if [ $? -ne 0 ]; then
    echo "❌ LMAY synchronization failed - push aborted"
    exit 1
  fi
fi
`;
      
      default:
        return '# LMAY integration';
    }
  }

  // Core analysis methods
  async analyzeCurrentState(projectPath) {
    const state = {
      files: [],
      directories: [],
      structure: {},
      dependencies: {},
      exports: {},
      imports: {}
    };

    // Scan for all source files
    const sourceFiles = await glob('**/*.{js,ts,py,java,go,rs,cpp,c,php,rb}', {
      cwd: projectPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    });

    for (const file of sourceFiles) {
      const fullPath = path.join(projectPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      const stats = await fs.stat(fullPath);
      
      const fileInfo = {
        path: fullPath,
        relativePath: file,
        content,
        size: stats.size,
        modified: stats.mtime,
        language: this.detectLanguage(file),
        exports: this.extractExports(content, file),
        imports: this.extractImports(content, file),
        functions: this.extractFunctions(content, file),
        classes: this.extractClasses(content, file)
      };
      
      state.files.push(fileInfo);
    }

    // Scan directory structure
    state.directories = await this.scanDirectoryStructure(projectPath);
    state.structure = this.buildProjectStructure(state.files, state.directories);
    
    return state;
  }

  async detectDifferences(currentState, lmayFiles, projectPath) {
    const differences = [];
    
    // Parse existing LMAY files to understand documented structure
    const documentedState = {};
    for (const lmayFile of lmayFiles) {
      try {
        const parsed = yaml.parse(lmayFile.content);
        documentedState[lmayFile.relativePath] = parsed;
      } catch (error) {
        differences.push({
          type: 'parse_error',
          file: lmayFile.relativePath,
          description: `LMAY file parsing failed: ${error.message}`,
          severity: 'high',
          action: 'fix_syntax'
        });
      }
    }

    // Compare file structure
    const currentFiles = new Set(currentState.files.map(f => f.relativePath));
    const documentedFiles = new Set();
    
    Object.values(documentedState).forEach(lmayDoc => {
      if (lmayDoc.structure && lmayDoc.structure.files) {
        Object.keys(lmayDoc.structure.files).forEach(file => {
          documentedFiles.add(file);
        });
      }
    });

    // Find new files not documented
    for (const file of currentFiles) {
      if (!documentedFiles.has(file)) {
        differences.push({
          type: 'new_file',
          file,
          description: `New file ${file} needs LMAY documentation`,
          severity: 'medium',
          action: 'add_documentation'
        });
      }
    }

    // Find removed files still documented
    for (const file of documentedFiles) {
      if (!currentFiles.has(file)) {
        differences.push({
          type: 'removed_file',
          file,
          description: `File ${file} removed but still in LMAY docs`,
          severity: 'medium',
          action: 'remove_documentation'
        });
      }
    }

    // Check for structural changes in existing files
    for (const fileInfo of currentState.files) {
      const changes = await this.detectFileChanges(fileInfo, documentedState, projectPath);
      differences.push(...changes);
    }

    return differences;
  }

  async applySyncUpdates(differences, projectPath, options) {
    const results = { updated: 0, errors: [], changes: [] };
    
    for (const diff of differences) {
      try {
        switch (diff.action) {
          case 'add_documentation':
            await this.addFileDocumentation(diff.file, projectPath);
            results.updated++;
            results.changes.push(`Added documentation for ${diff.file}`);
            break;
            
          case 'remove_documentation':
            await this.removeFileDocumentation(diff.file, projectPath);
            results.updated++;
            results.changes.push(`Removed documentation for ${diff.file}`);
            break;
            
          case 'update_exports':
            await this.updateExportsDocumentation(diff.file, diff.newExports, projectPath);
            results.updated++;
            results.changes.push(`Updated exports for ${diff.file}`);
            break;
            
          case 'update_imports':
            await this.updateImportsDocumentation(diff.file, diff.newImports, projectPath);
            results.updated++;
            results.changes.push(`Updated imports for ${diff.file}`);
            break;
            
          case 'fix_syntax':
            if (options.autoFix) {
              await this.fixLMAYSyntax(diff.file, projectPath);
              results.updated++;
              results.changes.push(`Fixed syntax in ${diff.file}`);
            }
            break;
        }
      } catch (error) {
        results.errors.push({
          file: diff.file,
          action: diff.action,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async getGitChanges(gitRepo, base) {
    try {
      const log = await gitRepo.log({ from: base, to: 'HEAD' });
      const diffSummary = await gitRepo.diffSummary([base, 'HEAD']);
      
      const changedFiles = [];
      
      for (const file of diffSummary.files) {
        const fileDiff = await gitRepo.diff([base, 'HEAD', '--', file.file]);
        
        changedFiles.push({
          file: file.file,
          insertions: file.insertions,
          deletions: file.deletions,
          changes: file.changes,
          diff: fileDiff,
          status: this.getChangeStatus(file)
        });
      }
      
      return {
        commits: log.all,
        files: changedFiles,
        summary: {
          totalFiles: diffSummary.files.length,
          insertions: diffSummary.insertions,
          deletions: diffSummary.deletions
        }
      };
    } catch (error) {
      throw new Error(`Failed to get Git changes: ${error.message}`);
    }
  }

  async analyzeChangesForLMAYImpact(changes, projectPath) {
    const analysis = {
      changes: [],
      requiresUpdate: false,
      updates: []
    };

    for (const change of changes) {
      const filePath = typeof change === 'string' ? change : change.filePath || change.file;
      const impact = await this.calculateLMAYImpact(filePath, change, projectPath);
      
      if (impact.score > 0) {
        analysis.changes.push({
          file: filePath,
          impact: impact.score,
          reason: impact.reason,
          changes: impact.changes,
          safety: impact.safety,
          description: impact.description
        });
        
        if (impact.updates && impact.updates.length > 0) {
          analysis.updates.push(...impact.updates);
          analysis.requiresUpdate = true;
        }
      }
    }
    
    return analysis;
  }

  displayDetectionResults(analysis, significantChanges, options) {
    console.log(chalk.cyan('\n🔍 Change Detection Results:'));
    console.log(`  ${chalk.blue('→')} Total changes: ${analysis.changes.length}`);
    console.log(`  ${chalk.blue('→')} Significant: ${significantChanges.length}`);
  }

  displaySyncResults(results, options) {
    console.log(chalk.cyan('\n🔄 Synchronization Results:'));
    console.log(`  ${chalk.blue('→')} Files updated: ${results.updated}`);
  }

  displayApplyResults(results, options) {
    console.log(chalk.cyan('\n✅ Apply Results:'));
    console.log(`  ${chalk.blue('→')} Applied: ${results.applied}`);
    console.log(`  ${chalk.blue('→')} Skipped: ${results.skipped}`);
  }

  async promptForApproval(change) {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'approve',
      message: `Apply update: ${change.description}?`,
      default: change.safety === 'safe'
    }]);
    return answer.approve;
  }

  // Helper methods for file analysis
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.php': 'php',
      '.rb': 'ruby'
    };
    return languageMap[ext] || 'unknown';
  }

  extractExports(content, filePath) {
    const exports = [];
    const language = this.detectLanguage(filePath);
    
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          // ES6 exports
          const esExports = content.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g);
          if (esExports) {
            exports.push(...esExports.map(exp => exp.match(/\w+$/)[0]));
          }
          
          // CommonJS exports
          const cjsExports = content.match(/module\.exports\s*=\s*(\w+)|exports\.(\w+)/g);
          if (cjsExports) {
            exports.push(...cjsExports.map(exp => {
              const match = exp.match(/\.(\w+)/) || exp.match(/=\s*(\w+)/);
              return match ? match[1] : null;
            }).filter(Boolean));
          }
          break;
          
        case 'python':
          const pyExports = content.match(/^def\s+(\w+)|^class\s+(\w+)/gm);
          if (pyExports) {
            exports.push(...pyExports.map(exp => exp.match(/\w+$/)[0]));
          }
          break;
      }
    } catch (error) {
      // Silent fail for parsing errors
    }
    
    return exports;
  }

  extractImports(content, filePath) {
    const imports = [];
    const language = this.detectLanguage(filePath);
    
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          // ES6 imports
          const esImports = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
          if (esImports) {
            imports.push(...esImports.map(imp => imp.match(/['"]([^'"]+)['"]/)[1]));
          }
          
          // CommonJS requires
          const cjsImports = content.match(/require\(['"]([^'"]+)['"]\)/g);
          if (cjsImports) {
            imports.push(...cjsImports.map(imp => imp.match(/['"]([^'"]+)['"]/)[1]));
          }
          break;
          
        case 'python':
          const pyImports = content.match(/^(?:from\s+(\S+)\s+)?import\s+(\S+)/gm);
          if (pyImports) {
            imports.push(...pyImports.map(imp => {
              const fromMatch = imp.match(/from\s+(\S+)/);
              const importMatch = imp.match(/import\s+(\S+)/);
              return fromMatch ? fromMatch[1] : importMatch[1];
            }));
          }
          break;
      }
    } catch (error) {
      // Silent fail for parsing errors
    }
    
    return imports;
  }

  extractFunctions(content, filePath) {
    const functions = [];
    const language = this.detectLanguage(filePath);
    
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          const jsFunctions = content.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(|\w+\s*=>))/g);
          if (jsFunctions) {
            functions.push(...jsFunctions.map(fn => {
              const match = fn.match(/(\w+)/);
              return match ? match[1] : null;
            }).filter(Boolean));
          }
          break;
          
        case 'python':
          const pyFunctions = content.match(/^\s*def\s+(\w+)/gm);
          if (pyFunctions) {
            functions.push(...pyFunctions.map(fn => fn.match(/\w+$/)[0]));
          }
          break;
      }
    } catch (error) {
      // Silent fail for parsing errors
    }
    
    return functions;
  }

  extractClasses(content, filePath) {
    const classes = [];
    const language = this.detectLanguage(filePath);
    
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          const jsClasses = content.match(/class\s+(\w+)/g);
          if (jsClasses) {
            classes.push(...jsClasses.map(cls => cls.match(/\w+$/)[0]));
          }
          break;
          
        case 'python':
          const pyClasses = content.match(/^\s*class\s+(\w+)/gm);
          if (pyClasses) {
            classes.push(...pyClasses.map(cls => cls.match(/\w+$/)[0]));
          }
          break;
      }
    } catch (error) {
      // Silent fail for parsing errors
    }
    
    return classes;
  }

  async scanDirectoryStructure(rootPath) {
    const directories = [];
    
    const scanDir = async (dirPath, relativePath = '') => {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relPath = path.join(relativePath, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory() && !this.shouldSkipDirectory(item)) {
          directories.push({
            path: fullPath,
            relativePath: relPath,
            name: item,
            modified: stats.mtime
          });
          
          await scanDir(fullPath, relPath);
        }
      }
    };
    
    await scanDir(rootPath);
    return directories;
  }

  shouldSkipDirectory(name) {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage'];
    return skipDirs.includes(name) || name.startsWith('.');
  }

  buildProjectStructure(files, directories) {
    const structure = {
      files: {},
      directories: {},
      modules: {},
      dependencies: new Set()
    };
    
    // Build file structure
    files.forEach(file => {
      structure.files[file.relativePath] = {
        language: file.language,
        exports: file.exports,
        imports: file.imports,
        functions: file.functions,
        classes: file.classes,
        size: file.size,
        modified: file.modified
      };
      
      // Track external dependencies
      file.imports.forEach(imp => {
        if (!imp.startsWith('.') && !imp.startsWith('/')) {
          structure.dependencies.add(imp.split('/')[0]);
        }
      });
    });
    
    // Build directory structure
    directories.forEach(dir => {
      structure.directories[dir.relativePath] = {
        name: dir.name,
        modified: dir.modified
      };
    });
    
    structure.dependencies = Array.from(structure.dependencies);
    return structure;
  }

  async detectFileChanges(fileInfo, documentedState, projectPath) {
    const changes = [];
    
    // Find relevant LMAY files that should document this file
    const relevantLMAYFiles = this.findRelevantLMAYFiles(fileInfo.relativePath, documentedState);
    
    for (const lmayPath of relevantLMAYFiles) {
      const lmayDoc = documentedState[lmayPath];
      const documentedFile = lmayDoc.structure?.files?.[fileInfo.relativePath];
      
      if (documentedFile) {
        // Check exports changes
        const docExports = documentedFile.exports || [];
        const currentExports = fileInfo.exports || [];
        
        if (!this.arraysEqual(docExports, currentExports)) {
          changes.push({
            type: 'exports_changed',
            file: fileInfo.relativePath,
            lmayFile: lmayPath,
            description: `Exports changed in ${fileInfo.relativePath}`,
            severity: 'medium',
            action: 'update_exports',
            oldExports: docExports,
            newExports: currentExports
          });
        }
        
        // Check imports changes
        const docImports = documentedFile.imports || [];
        const currentImports = fileInfo.imports || [];
        
        if (!this.arraysEqual(docImports, currentImports)) {
          changes.push({
            type: 'imports_changed',
            file: fileInfo.relativePath,
            lmayFile: lmayPath,
            description: `Imports changed in ${fileInfo.relativePath}`,
            severity: 'low',
            action: 'update_imports',
            oldImports: docImports,
            newImports: currentImports
          });
        }
      }
    }
    
    return changes;
  }

  findRelevantLMAYFiles(filePath, documentedState) {
    const relevantFiles = [];
    
    Object.keys(documentedState).forEach(lmayPath => {
      const lmayDoc = documentedState[lmayPath];
      if (lmayDoc.structure?.files?.[filePath]) {
        relevantFiles.push(lmayPath);
      }
    });
    
    return relevantFiles;
  }

  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, index) => val === sorted2[index]);
  }

  getChangeStatus(file) {
    if (file.insertions > 0 && file.deletions === 0) return 'added';
    if (file.insertions === 0 && file.deletions > 0) return 'deleted';
    if (file.insertions > 0 && file.deletions > 0) return 'modified';
    return 'unchanged';
  }

  async calculateLMAYImpact(filePath, change, projectPath) {
    const impact = {
      score: 0,
      reason: [],
      changes: [],
      safety: 'safe',
      description: '',
      updates: []
    };
    
    // Determine impact based on file type and changes
    const language = this.detectLanguage(filePath);
    const isSourceFile = ['javascript', 'typescript', 'python', 'java', 'go', 'rust'].includes(language);
    
    if (!isSourceFile) {
      return impact; // No impact for non-source files
    }
    
    // Calculate impact score
    if (change.insertions > 50 || change.deletions > 50) {
      impact.score += 8;
      impact.reason.push('Large change volume');
      impact.safety = 'risky';
    } else if (change.insertions > 10 || change.deletions > 10) {
      impact.score += 5;
      impact.reason.push('Medium change volume');
      impact.safety = 'moderate';
    } else {
      impact.score += 2;
      impact.reason.push('Small change volume');
    }
    
    // Check for structural changes
    if (change.diff) {
      if (change.diff.includes('export') || change.diff.includes('module.exports')) {
        impact.score += 6;
        impact.reason.push('Export changes detected');
        impact.safety = 'moderate';
      }
      
      if (change.diff.includes('import') || change.diff.includes('require(')) {
        impact.score += 3;
        impact.reason.push('Import changes detected');
      }
      
      if (change.diff.includes('class ') || change.diff.includes('function ')) {
        impact.score += 4;
        impact.reason.push('Function/class changes detected');
      }
    }
    
    impact.description = `${filePath}: ${impact.reason.join(', ')}`;
    
    // Generate update suggestions
    if (impact.score >= 5) {
      impact.updates.push({
        type: 'sync_documentation',
        file: filePath,
        priority: impact.score >= 8 ? 'high' : 'medium',
        description: `Update LMAY documentation for ${filePath}`
      });
    }
    
    return impact;
  }

  // Update operation methods
  async addFileDocumentation(filePath, projectPath) {
    // Find appropriate LMAY file to update
    const lmayFiles = await this.findLMAYFiles(projectPath);
    const targetLMAY = this.findBestLMAYFileForPath(filePath, lmayFiles);
    
    if (targetLMAY) {
      const content = yaml.parse(targetLMAY.content);
      if (!content.structure) content.structure = {};
      if (!content.structure.files) content.structure.files = {};
      
      // Read file info
      const fullPath = path.join(projectPath, filePath);
      const fileContent = await fs.readFile(fullPath, 'utf8');
      
      content.structure.files[filePath] = {
        language: this.detectLanguage(filePath),
        exports: this.extractExports(fileContent, filePath),
        imports: this.extractImports(fileContent, filePath),
        functions: this.extractFunctions(fileContent, filePath),
        classes: this.extractClasses(fileContent, filePath)
      };
      
      await fs.writeFile(targetLMAY.path, yaml.stringify(content));
    }
  }

  async removeFileDocumentation(filePath, projectPath) {
    const lmayFiles = await this.findLMAYFiles(projectPath);
    
    for (const lmayFile of lmayFiles) {
      try {
        const content = yaml.parse(lmayFile.content);
        if (content.structure?.files?.[filePath]) {
          delete content.structure.files[filePath];
          await fs.writeFile(lmayFile.path, yaml.stringify(content));
        }
      } catch (error) {
        // Skip malformed LMAY files
      }
    }
  }

  async updateExportsDocumentation(filePath, newExports, projectPath) {
    const lmayFiles = await this.findLMAYFiles(projectPath);
    
    for (const lmayFile of lmayFiles) {
      try {
        const content = yaml.parse(lmayFile.content);
        if (content.structure?.files?.[filePath]) {
          content.structure.files[filePath].exports = newExports;
          await fs.writeFile(lmayFile.path, yaml.stringify(content));
        }
      } catch (error) {
        // Skip malformed LMAY files
      }
    }
  }

  async updateImportsDocumentation(filePath, newImports, projectPath) {
    const lmayFiles = await this.findLMAYFiles(projectPath);
    
    for (const lmayFile of lmayFiles) {
      try {
        const content = yaml.parse(lmayFile.content);
        if (content.structure?.files?.[filePath]) {
          content.structure.files[filePath].imports = newImports;
          await fs.writeFile(lmayFile.path, yaml.stringify(content));
        }
      } catch (error) {
        // Skip malformed LMAY files
      }
    }
  }

  findBestLMAYFileForPath(filePath, lmayFiles) {
    // Simple heuristic: find LMAY file in same or parent directory
    const fileDir = path.dirname(filePath);
    
    // Try exact directory match first
    for (const lmayFile of lmayFiles) {
      const lmayDir = path.dirname(lmayFile.relativePath);
      if (lmayDir === fileDir) return lmayFile;
    }
    
    // Try parent directories
    const pathParts = fileDir.split(path.sep);
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentDir = pathParts.slice(0, i).join(path.sep) || '.';
      for (const lmayFile of lmayFiles) {
        const lmayDir = path.dirname(lmayFile.relativePath);
        if (lmayDir === parentDir) return lmayFile;
      }
    }
    
    // Fall back to root LMAY file
    return lmayFiles.find(f => f.relativePath.includes('root.lmay')) || lmayFiles[0];
  }

  async createBackup(projectPath, lmayFiles) {
    const backupDir = path.join(projectPath, '.lmay-backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    
    await fs.ensureDir(backupPath);
    
    for (const lmayFile of lmayFiles) {
      const backupFile = path.join(backupPath, lmayFile.relativePath);
      await fs.ensureDir(path.dirname(backupFile));
      await fs.copy(lmayFile.path, backupFile);
    }
    
    console.log(chalk.dim(`  Backup created: ${backupPath}`));
  }

  async validateUpdates(projectPath) {
    try {
      const { validator } = require('../../validator/src/validator');
      const validationResults = await validator.validateProject(projectPath);
      
      if (validationResults.errors.length > 0) {
        throw new Error(`Validation failed: ${validationResults.errors.length} errors found`);
      }
    } catch (error) {
      // Validation is optional if validator is not available
      console.log(chalk.yellow('⚠️  Validation skipped - validator not available'));
    }
  }

  async applyAutoUpdates(updates, projectPath) {
    const results = { updated: 0, errors: [] };
    
    for (const update of updates) {
      try {
        switch (update.type) {
          case 'sync_documentation':
            await this.syncFileDocumentation(update.file, projectPath);
            results.updated++;
            break;
        }
      } catch (error) {
        results.errors.push({ update, error: error.message });
      }
    }
    
    return results;
  }

  async syncFileDocumentation(filePath, projectPath) {
    const fullPath = path.join(projectPath, filePath);
    if (await fs.pathExists(fullPath)) {
      await this.addFileDocumentation(filePath, projectPath);
    } else {
      await this.removeFileDocumentation(filePath, projectPath);
    }
  }

  async autoCommitChanges(projectPath, updateResults) {
    const gitRepo = git(projectPath);
    
    // Add LMAY files
    await gitRepo.add('*.lmay');
    
    // Commit with descriptive message
    const message = `Auto-update LMAY documentation

${updateResults.updated} files updated
Changes: ${updateResults.changes.join(', ')}`;

    await gitRepo.commit(message);
    console.log(chalk.green('📝 Auto-committed LMAY updates'));
  }

  displayPendingUpdates(updates) {
    updates.forEach(update => {
      console.log(`  ${chalk.yellow('→')} ${update.description}`);
    });
  }

  // Additional helper methods
  async loadChangesFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  async applyIndividualUpdate(change, projectPath) {
    // Apply individual update based on change type
    switch (change.type) {
      case 'exports_changed':
        await this.updateExportsDocumentation(change.file, change.newExports, projectPath);
        break;
      case 'imports_changed':
        await this.updateImportsDocumentation(change.file, change.newImports, projectPath);
        break;
      case 'new_file':
        await this.addFileDocumentation(change.file, projectPath);
        break;
      case 'removed_file':
        await this.removeFileDocumentation(change.file, projectPath);
        break;
    }
  }

  async saveDetectionReport(analysisResults, outputPath, format = 'json') {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChanges: analysisResults.changes.length,
        requiresUpdate: analysisResults.requiresUpdate,
        updates: analysisResults.updates.length
      },
      changes: analysisResults.changes,
      updates: analysisResults.updates
    };
    
    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    } else {
      // Simple text format
      const text = `LMAY Change Report - ${report.timestamp}

Total Changes: ${report.summary.totalChanges}
Requires Update: ${report.summary.requiresUpdate}
Pending Updates: ${report.summary.updates}

${report.changes.map(c => `${c.file}: ${c.description}`).join('\n')}`;
      await fs.writeFile(outputPath, text);
    }
  }

  async saveSyncReport(updateResults, outputPath, format = 'json') {
    const report = {
      timestamp: new Date().toISOString(),
      updated: updateResults.updated,
      errors: updateResults.errors,
      changes: updateResults.changes
    };
    
    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    } else {
      const text = `LMAY Sync Report - ${report.timestamp}

Files Updated: ${report.updated}
Errors: ${report.errors.length}

Changes:
${report.changes.join('\n')}`;
      await fs.writeFile(outputPath, text);
    }
  }

  async saveBatchUpdateReport(results, outputPath, format = 'json') {
    const report = {
      timestamp: new Date().toISOString(),
      results: results
    };
    
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  }

  async listRollbackPoints(projectPath) {
    const gitRepo = git(projectPath);
    const log = await gitRepo.log({ maxCount: 10 });
    
    return log.all.map(commit => ({
      commit: commit.hash.substring(0, 8),
      timestamp: commit.date,
      description: commit.message
    }));
  }

  async executeRollback(projectPath, options) {
    const gitRepo = git(projectPath);
    const targetCommit = options.commit || 'HEAD~1';
    
    // Get files that will be affected
    const diffSummary = await gitRepo.diffSummary([targetCommit, 'HEAD']);
    const lmayFiles = diffSummary.files.filter(f => f.file.endsWith('.lmay'));
    
    // Reset LMAY files to target commit
    for (const file of lmayFiles) {
      await gitRepo.checkout([targetCommit, '--', file.file]);
    }
    
    return {
      targetPoint: targetCommit,
      filesRestored: lmayFiles.length,
      changesReverted: lmayFiles.reduce((sum, f) => sum + f.changes, 0)
    };
  }

  async runUpdateOperation(operation, targetPath, options) {
    switch (operation) {
      case 'sync':
        return await this.synchronize(targetPath, options);
      case 'detect':
        return await this.detectChanges(targetPath, options);
      case 'apply':
        return await this.applyUpdates(targetPath, options);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  async removeGitHooks(hooksDir, hookNames) {
    for (const hookName of hookNames) {
      const hookPath = path.join(hooksDir, hookName);
      if (await fs.pathExists(hookPath)) {
        const content = await fs.readFile(hookPath, 'utf8');
        const lines = content.split('\n');
        
        // Remove LMAY-related lines
        const filteredLines = [];
        let inLMAYSection = false;
        
        for (const line of lines) {
          if (line.includes('# LMAY Auto-updater')) {
            inLMAYSection = true;
            continue;
          }
          
          if (inLMAYSection && (line.trim() === '' || line.startsWith('#'))) {
            continue;
          }
          
          if (inLMAYSection && !line.includes('lmay')) {
            inLMAYSection = false;
          }
          
          if (!inLMAYSection) {
            filteredLines.push(line);
          }
        }
        
        if (filteredLines.join('\n').trim() === '#!/bin/sh') {
          await fs.remove(hookPath);
        } else {
          await fs.writeFile(hookPath, filteredLines.join('\n'));
        }
      }
    }
  }

  // Configuration management
  async manageConfig(options) {
    if (options.list) {
      const config = await this.loadConfig();
      console.log(chalk.cyan('\n⚙️  Current Configuration:'));
      Object.entries(config).forEach(([key, value]) => {
        console.log(`  ${chalk.blue(key)}: ${JSON.stringify(value)}`);
      });
      return;
    }

    if (options.reset) {
      await fs.writeFile(this.configPath, JSON.stringify(this.defaultConfig, null, 2));
      console.log(chalk.green('✅ Configuration reset to defaults'));
      return;
    }

    if (options.set) {
      const [key, value] = options.set.split('=');
      if (!key || value === undefined) {
        console.error(chalk.red('Invalid format. Use: --set key=value'));
        process.exit(1);
      }

      const config = await this.loadConfig();
      
      // Parse value
      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value; // Keep as string if not valid JSON
      }

      config[key] = parsedValue;
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green(`✅ Set ${key} = ${JSON.stringify(parsedValue)}`));
    }
  }

  // Pattern analysis
  async analyzePatterns(projectPath, options) {
    const spinner = ora('Analyzing refactoring patterns...').start();

    try {
      const resolvedPath = path.resolve(projectPath);
      const gitRepo = git(resolvedPath);
      
      // Get commit history
      const daysBack = parseInt(options.history || 30);
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      const log = await gitRepo.log({ since: since.toISOString() });

      spinner.text = 'Analyzing commit patterns...';
      
      const analysis = {
        totalCommits: log.all.length,
        refactoringCommits: [],
        patterns: {
          fileMovements: 0,
          nameChanges: 0,
          structuralChanges: 0,
          dependencyChanges: 0
        },
        recommendations: [],
        commonFiles: {},
        languages: {}
      };

      // Analyze each commit
      for (const commit of log.all) {
        const diffSummary = await gitRepo.diffSummary([`${commit.hash}~1`, commit.hash]);
        
        if (this.isRefactoringCommit(commit, diffSummary)) {
          analysis.refactoringCommits.push({
            hash: commit.hash.substring(0, 8),
            message: commit.message,
            date: commit.date,
            files: diffSummary.files.length,
            insertions: diffSummary.insertions,
            deletions: diffSummary.deletions
          });

          // Analyze patterns
          this.analyzeCommitPatterns(diffSummary, analysis);
        }
      }

      // Generate recommendations
      analysis.recommendations = this.generateUpdateRecommendations(analysis);

      spinner.succeed(`Pattern analysis completed - ${analysis.refactoringCommits.length} refactoring commits found`);

      // Display results
      this.displayPatternAnalysis(analysis, options);

      // Save report if requested
      if (options.output) {
        await this.savePatternReport(analysis, options.output, options.format);
        console.log(chalk.green(`\n📄 Analysis report saved to: ${options.output}`));
      }

    } catch (error) {
      spinner.fail(`Pattern analysis failed: ${error.message}`);
      if (options.verbose) {
        console.error(chalk.red('\nError details:'), error.stack);
      }
      process.exit(1);
    }
  }

  isRefactoringCommit(commit, diffSummary) {
    const message = commit.message.toLowerCase();
    const refactoringKeywords = [
      'refactor', 'rename', 'move', 'restructure', 'reorganize',
      'extract', 'inline', 'split', 'merge', 'cleanup'
    ];
    
    const hasKeyword = refactoringKeywords.some(keyword => 
      message.includes(keyword)
    );
    
    const hasSignificantChanges = diffSummary.files.length > 2 && 
      (diffSummary.insertions > 10 || diffSummary.deletions > 10);
    
    return hasKeyword || hasSignificantChanges;
  }

  analyzeCommitPatterns(diffSummary, analysis) {
    for (const file of diffSummary.files) {
      // Track common files
      if (!analysis.commonFiles[file.file]) {
        analysis.commonFiles[file.file] = 0;
      }
      analysis.commonFiles[file.file]++;

      // Track languages
      const language = this.detectLanguage(file.file);
      if (!analysis.languages[language]) {
        analysis.languages[language] = 0;
      }
      analysis.languages[language]++;

      // Pattern detection
      if (file.file.includes('/')) {
        analysis.patterns.fileMovements++;
      }
      if (file.insertions > 0 && file.deletions > 0) {
        analysis.patterns.nameChanges++;
      }
      if (file.changes > 50) {
        analysis.patterns.structuralChanges++;
      }
    }
  }

  generateUpdateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.refactoringCommits.length > 10) {
      recommendations.push({
        type: 'automation',
        priority: 'high',
        title: 'Enable automatic updates',
        description: 'High refactoring activity detected. Consider enabling watch mode for automatic LMAY updates.'
      });
    }

    if (analysis.patterns.fileMovements > 5) {
      recommendations.push({
        type: 'hooks',
        priority: 'medium',
        title: 'Setup Git hooks',
        description: 'Frequent file movements detected. Git hooks can help maintain LMAY consistency.'
      });
    }

    if (analysis.patterns.structuralChanges > 3) {
      recommendations.push({
        type: 'validation',
        priority: 'medium',
        title: 'Increase validation frequency',
        description: 'Large structural changes detected. Consider more frequent validation runs.'
      });
    }

    return recommendations;
  }

  displayPatternAnalysis(analysis, options) {
    console.log(chalk.cyan('\n🔍 Refactoring Pattern Analysis:'));
    console.log(`  ${chalk.blue('→')} Total commits analyzed: ${analysis.totalCommits}`);
    console.log(`  ${chalk.blue('→')} Refactoring commits: ${analysis.refactoringCommits.length}`);
    
    if (options.patterns) {
      console.log(chalk.cyan('\n📊 Pattern Breakdown:'));
      console.log(`  ${chalk.blue('→')} File movements: ${analysis.patterns.fileMovements}`);
      console.log(`  ${chalk.blue('→')} Name changes: ${analysis.patterns.nameChanges}`);
      console.log(`  ${chalk.blue('→')} Structural changes: ${analysis.patterns.structuralChanges}`);
      
      console.log(chalk.cyan('\n📁 Most Changed Files:'));
      const sortedFiles = Object.entries(analysis.commonFiles)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      sortedFiles.forEach(([file, count]) => {
        console.log(`  ${chalk.blue('→')} ${file}: ${count} changes`);
      });
    }

    if (options.recommendations && analysis.recommendations.length > 0) {
      console.log(chalk.cyan('\n💡 Recommendations:'));
      analysis.recommendations.forEach(rec => {
        const priority = rec.priority === 'high' ? chalk.red(rec.priority) : 
                        rec.priority === 'medium' ? chalk.yellow(rec.priority) : 
                        chalk.green(rec.priority);
        console.log(`  ${chalk.blue('→')} [${priority}] ${rec.title}`);
        console.log(`      ${chalk.dim(rec.description)}`);
      });
    }
  }

  async savePatternReport(analysis, outputPath, format = 'json') {
    const report = {
      timestamp: new Date().toISOString(),
      analysis: analysis
    };
    
    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    } else if (format === 'html') {
      const html = this.generateHTMLReport(analysis);
      await fs.writeFile(outputPath, html);
    } else {
      const text = `LMAY Pattern Analysis Report - ${report.timestamp}

Total Commits: ${analysis.totalCommits}
Refactoring Commits: ${analysis.refactoringCommits.length}

Pattern Breakdown:
- File movements: ${analysis.patterns.fileMovements}
- Name changes: ${analysis.patterns.nameChanges}
- Structural changes: ${analysis.patterns.structuralChanges}

Recommendations:
${analysis.recommendations.map(r => `- [${r.priority}] ${r.title}: ${r.description}`).join('\n')}`;
      
      await fs.writeFile(outputPath, text);
    }
  }

  generateHTMLReport(analysis) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>LMAY Pattern Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .metric { background: #ecf0f1; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .recommendation { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .high { border-left: 4px solid #e74c3c; }
        .medium { border-left: 4px solid #f39c12; }
        .low { border-left: 4px solid #27ae60; }
    </style>
</head>
<body>
    <div class="header">
        <h1>LMAY Pattern Analysis Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    
    <div class="section">
        <h2>Summary</h2>
        <div class="metric">Total Commits Analyzed: ${analysis.totalCommits}</div>
        <div class="metric">Refactoring Commits: ${analysis.refactoringCommits.length}</div>
    </div>
    
    <div class="section">
        <h2>Pattern Breakdown</h2>
        <div class="metric">File Movements: ${analysis.patterns.fileMovements}</div>
        <div class="metric">Name Changes: ${analysis.patterns.nameChanges}</div>
        <div class="metric">Structural Changes: ${analysis.patterns.structuralChanges}</div>
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        ${analysis.recommendations.map(rec => 
          `<div class="recommendation ${rec.priority}">
             <strong>[${rec.priority.toUpperCase()}] ${rec.title}</strong><br>
             ${rec.description}
           </div>`
        ).join('')}
    </div>
</body>
</html>`;
  }
}

module.exports = AutoUpdater;
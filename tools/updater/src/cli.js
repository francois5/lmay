#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const AutoUpdater = require('./updater');

const program = new Command();

program
  .name('lmay-updater')
  .description('Automatic update tools for LMAY documentation during refactoring')
  .version('1.0.0');

// Watch for changes and auto-update
program
  .command('watch')
  .description('Watch project for refactoring changes and auto-update LMAY files')
  .argument('[path]', 'Project path to watch', process.cwd())
  .option('-d, --debounce <ms>', 'Debounce time for file changes in milliseconds', '2000')
  .option('--include <patterns>', 'File patterns to include (comma-separated)', '**/*.js,**/*.ts,**/*.py,**/*.java')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)', 'node_modules/**,dist/**,build/**')
  .option('--auto-commit', 'Automatically commit LMAY updates')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const updater = new AutoUpdater();
    await updater.watchForChanges(path, options);
  });

// Sync LMAY with current project state
program
  .command('sync')
  .description('Synchronize LMAY documentation with current project structure')
  .argument('[path]', 'Project path to synchronize', process.cwd())
  .option('--force', 'Force update even if no changes detected')
  .option('--backup', 'Create backup before updating')
  .option('--validate', 'Validate updates after completion')
  .option('-f, --format <format>', 'Output format for changes report (text|json)', 'text')
  .option('-o, --output <file>', 'Save changes report to file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const updater = new AutoUpdater();
    await updater.synchronize(path, options);
  });

// Detect refactoring changes
program
  .command('detect')
  .description('Detect refactoring changes that require LMAY updates')
  .argument('[path]', 'Project path to analyze', process.cwd())
  .option('--since <commit>', 'Analyze changes since specific commit')
  .option('--branch <branch>', 'Compare with specific branch', 'main')
  .option('--threshold <num>', 'Minimum number of changes to trigger update', '5')
  .option('-f, --format <format>', 'Output format (text|json|diff)', 'text')
  .option('-o, --output <file>', 'Save detection report to file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const updater = new AutoUpdater();
    await updater.detectChanges(path, options);
  });

// Apply refactoring updates
program
  .command('apply')
  .description('Apply detected refactoring changes to LMAY files')
  .argument('[path]', 'Project path to update', process.cwd())
  .option('-i, --input <file>', 'Input file with detected changes')
  .option('--interactive', 'Interactive mode for reviewing changes')
  .option('--auto-approve', 'Auto-approve all safe updates')
  .option('--backup', 'Create backup before applying changes')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const updater = new AutoUpdater();
    await updater.applyUpdates(path, options);
  });

// Setup Git hooks for automatic updates
program
  .command('setup-hooks')
  .description('Setup Git hooks for automatic LMAY updates')
  .argument('[path]', 'Git repository path', process.cwd())
  .option('--pre-commit', 'Setup pre-commit hook')
  .option('--post-commit', 'Setup post-commit hook')
  .option('--pre-push', 'Setup pre-push hook')
  .option('--all', 'Setup all recommended hooks')
  .option('--remove', 'Remove existing LMAY hooks')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const updater = new AutoUpdater();
    await updater.setupGitHooks(path, options);
  });

// Rollback automatic changes
program
  .command('rollback')
  .description('Rollback automatic LMAY updates')
  .argument('[path]', 'Project path', process.cwd())
  .option('--to <commit>', 'Rollback to specific commit')
  .option('--steps <num>', 'Number of update steps to rollback', '1')
  .option('--list', 'List available rollback points')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const updater = new AutoUpdater();
    await updater.rollback(path, options);
  });

// Batch update multiple projects
program
  .command('batch')
  .description('Apply updates to multiple projects in batch')
  .argument('<operation>', 'Operation to perform (sync|detect|apply)')
  .argument('<paths...>', 'Project paths or patterns')
  .option('--parallel <num>', 'Number of parallel operations', '4')
  .option('--continue-on-error', 'Continue processing on errors')
  .option('-f, --format <format>', 'Output format for batch report', 'text')
  .option('-o, --output <file>', 'Save batch report')
  .option('-v, --verbose', 'Verbose output')
  .action(async (operation, paths, options) => {
    const updater = new AutoUpdater();
    await updater.batchUpdate(operation, paths, options);
  });

// Configuration management
program
  .command('config')
  .description('Configure automatic update behavior')
  .option('--list', 'List current configuration')
  .option('--set <key=value>', 'Set configuration value')
  .option('--reset', 'Reset to default configuration')
  .option('--global', 'Use global configuration')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const updater = new AutoUpdater();
    await updater.manageConfig(options);
  });

// Analyze refactoring patterns
program
  .command('analyze')
  .description('Analyze common refactoring patterns in the project')
  .argument('[path]', 'Project path to analyze', process.cwd())
  .option('--history <days>', 'Number of days of history to analyze', '30')
  .option('--patterns', 'Show common refactoring patterns')
  .option('--recommendations', 'Generate update strategy recommendations')
  .option('-f, --format <format>', 'Output format (text|json|html)', 'text')
  .option('-o, --output <file>', 'Save analysis report')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const updater = new AutoUpdater();
    await updater.analyzePatterns(path, options);
  });

// Global error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Unexpected error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled promise rejection:'), reason);
  process.exit(1);
});

program.parse();
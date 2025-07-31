#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const MaintenanceEngine = require('./maintenance');

const program = new Command();

program
  .name('lmay-maintenance')
  .description('LMAY maintenance tools for detecting obsolete files and optimizing projects')
  .version('1.0.0');

// Detect obsolete files
program
  .command('obsolete')
  .description('Detect obsolete LMAY files that no longer match the project structure')
  .argument('[path]', 'Project path to analyze', process.cwd())
  .option('-t, --threshold <days>', 'Days since last modification to consider obsolete', '30')
  .option('-s, --strict', 'Use strict obsolescence detection rules')
  .option('--auto-clean', 'Automatically remove obsolete files (use with caution)')
  .option('-f, --format <format>', 'Output format (text|json|csv)', 'text')
  .option('-o, --output <file>', 'Save report to file')
  .option('--dry-run', 'Show what would be removed without actually removing')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.detectObsoletes(path, options);
  });

// Analyze project drift
program
  .command('drift')
  .description('Analyze drift between LMAY documentation and actual project structure')
  .argument('[path]', 'Project path to analyze', process.cwd())
  .option('-d, --deep', 'Deep analysis including file content changes')
  .option('--ignore-dates', 'Ignore modification dates in drift analysis')
  .option('-f, --format <format>', 'Output format (text|json|html)', 'text')
  .option('-o, --output <file>', 'Save report to file')
  .option('--fix', 'Attempt to automatically fix detected drift')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.analyzeDrift(path, options);
  });

// Cache optimization
program
  .command('cache')
  .description('Optimize and manage LMAY analysis cache')
  .option('--clear', 'Clear all cached analysis results')
  .option('--rebuild', 'Rebuild cache from current project state')
  .option('--stats', 'Show cache statistics and health')
  .option('--size-limit <mb>', 'Set cache size limit in MB', '100')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.manageCache(options);
  });

// Project health check
program
  .command('health')
  .description('Comprehensive health check for LMAY projects')
  .argument('[path]', 'Project path to analyze', process.cwd())
  .option('--score', 'Calculate and display health score')
  .option('--recommendations', 'Generate improvement recommendations')
  .option('-f, --format <format>', 'Output format (text|json|html)', 'text')
  .option('-o, --output <file>', 'Save report to file')
  .option('--watch', 'Continuously monitor project health')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.healthCheck(path, options);
  });

// Cleanup operations
program
  .command('cleanup')
  .description('Clean up temporary files, backups, and optimize project structure')
  .argument('[path]', 'Project path to clean', process.cwd())
  .option('--temp', 'Remove temporary LMAY files')
  .option('--backups', 'Remove backup files (.lmay.bak, etc.)')
  .option('--duplicates', 'Remove duplicate LMAY content')
  .option('--optimize', 'Optimize LMAY file structure and formatting')
  .option('--dry-run', 'Show what would be cleaned without actually doing it')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.cleanup(path, options);
  });

// Watch mode for continuous monitoring
program
  .command('watch')
  .description('Watch project for changes and maintain LMAY documentation automatically')
  .argument('[path]', 'Project path to watch', process.cwd())
  .option('-i, --interval <seconds>', 'Check interval in seconds', '30')
  .option('--auto-update', 'Automatically update LMAY files when changes detected')
  .option('--notify', 'Show desktop notifications for changes')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.watchProject(path, options);
  });

// Migration tools
program
  .command('migrate')
  .description('Migrate LMAY files between versions and formats')
  .argument('[path]', 'Project path to migrate', process.cwd())
  .option('--from <version>', 'Source LMAY version', '1.0')
  .option('--to <version>', 'Target LMAY version', '1.0')
  .option('--backup', 'Create backup before migration')
  .option('--validate', 'Validate after migration')
  .option('-v, --verbose', 'Verbose output')
  .action(async (path, options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.migrate(path, options);
  });

// Batch maintenance operations
program
  .command('batch')
  .description('Run maintenance operations on multiple projects')
  .argument('<operation>', 'Maintenance operation (obsolete|drift|health|cleanup)')
  .argument('<paths...>', 'Project paths or patterns')
  .option('--parallel <num>', 'Number of parallel operations', '4')
  .option('--continue-on-error', 'Continue processing on errors')
  .option('-f, --format <format>', 'Output format', 'text')
  .option('-o, --output <file>', 'Save batch report')
  .option('-v, --verbose', 'Verbose output')
  .action(async (operation, paths, options) => {
    const maintenance = new MaintenanceEngine();
    await maintenance.batchMaintenance(operation, paths, options);
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
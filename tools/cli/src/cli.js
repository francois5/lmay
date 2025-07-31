#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const generateCommand = require('./commands/generate');
const validateCommand = require('./commands/validate');
const initCommand = require('./commands/init');

const program = new Command();

// Main CLI configuration
program
  .name('lmay')
  .description('LMAY - Universal markup for AI understanding of codebases')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-color', 'Disable colored output');

// Generate command
program
  .command('generate')
  .alias('gen')
  .description('Generate LMAY documentation from project analysis')
  .argument('[path]', 'Project path to analyze', process.cwd())
  .option('-o, --output <dir>', 'Output directory for generated files')
  .option('-c, --config <file>', 'Custom configuration file')
  .option('--dry-run', 'Show what would be generated without creating files')
  .option('--distributed', 'Enable distributed system scanning features')
  .option('--scan-remote', 'Include remote server scanning (requires config)')
  .option('-f, --format <format>', 'Output format (yaml|json)', 'yaml')
  .option('--overwrite', 'Overwrite existing LMAY files')
  .action(generateCommand);

// Validate command
program
  .command('validate')
  .alias('val')
  .description('Validate LMAY files according to specification')
  .argument('[file]', 'LMAY file to validate (default: root.lmay)')
  .option('-p, --project <path>', 'Validate entire project')
  .option('-s, --strict', 'Enable strict validation mode')
  .option('--no-references', 'Skip reference validation')
  .option('--no-hierarchy', 'Skip hierarchy validation')
  .option('-f, --format <format>', 'Output format (text|json|sarif)', 'text')
  .option('-o, --output <file>', 'Save report to file')
  .option('--fix', 'Attempt automatic fixes for minor issues')
  .option('--check-distributed', 'Enable distributed system validation')
  .option('--validate-topology', 'Validate network topology references')
  .option('--check-network-connectivity', 'Verify network connectivity in distributed systems')
  .option('--include-infrastructure', 'Include infrastructure validation in reports')
  .action(validateCommand);

// Initialize command
program
  .command('init')
  .description('Initialize a new LMAY project')
  .argument('[path]', 'Project path to initialize', process.cwd())
  .option('-t, --template <type>', 'Project template (basic|web|microservices|distributed)', 'basic')
  .option('--interactive', 'Interactive initialization mode')
  .option('--minimal', 'Create minimal LMAY structure')
  .option('--examples', 'Include example files and documentation')
  .action(initCommand);

// Batch command for processing multiple files/projects
program
  .command('batch')
  .description('Process multiple LMAY projects in batch mode')
  .argument('<command>', 'Command to run (generate|validate)')
  .argument('<paths...>', 'Project paths or file patterns')
  .option('-c, --config <file>', 'Batch configuration file')
  .option('--parallel <num>', 'Number of parallel processes', '4')
  .option('--continue-on-error', 'Continue processing on errors')
  .option('-o, --output <dir>', 'Output directory for batch results')
  .action(async (command, paths, options) => {
    const batchCommand = require('./commands/batch');
    await batchCommand(command, paths, options);
  });

// Status command to check LMAY project health
program
  .command('status')
  .description('Show LMAY project status and health')
  .argument('[path]', 'Project path to check', process.cwd())
  .option('--files', 'List all LMAY files in project')
  .option('--coverage', 'Show documentation coverage metrics')
  .option('--outdated', 'Check for outdated LMAY files')
  .option('--dependencies', 'Show dependency analysis')
  .action(async (path, options) => {
    const statusCommand = require('./commands/status');
    await statusCommand(path, options);
  });

// Config command for managing LMAY configuration
program
  .command('config')
  .description('Manage LMAY configuration')
  .option('--list', 'List current configuration')
  .option('--set <key=value>', 'Set configuration value')
  .option('--get <key>', 'Get configuration value')
  .option('--reset', 'Reset to default configuration')
  .option('--global', 'Use global configuration')
  .action(async (options) => {
    const configCommand = require('./commands/config');
    await configCommand(options);
  });

// Doctor command for diagnosing issues
program
  .command('doctor')
  .description('Diagnose LMAY setup and common issues')
  .option('--fix', 'Attempt to fix detected issues')
  .option('--verbose', 'Show detailed diagnostic information')
  .action(async (options) => {
    const doctorCommand = require('./commands/doctor');
    await doctorCommand(options);
  });

// Global error handling
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage()
});

// Custom help
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ lmay init --interactive          Initialize new project interactively');
  console.log('  $ lmay generate .                 Generate LMAY docs for current directory');
  console.log('  $ lmay validate root.lmay         Validate a specific LMAY file');
  console.log('  $ lmay status --coverage          Show project documentation coverage');
  console.log('  $ lmay batch generate ./projects/* Process multiple projects');
  console.log('');
  console.log('Configuration:');
  console.log('  LMAY looks for configuration in:');
  console.log('  - ./lmay.config.json (project-specific)');
  console.log('  - ~/.lmayrc (user global)');
  console.log('  - Environment variables (LMAY_*)');
  console.log('');
  console.log('Learn more at: https://github.com/francois5/lmay');
});

// Handle unknown commands
program.on('command:*', (operands) => {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  console.log('Run "lmay --help" to see available commands.');
  process.exit(1);
});

// Global options handling
program.hook('preAction', (thisCommand, actionCommand) => {
  const opts = thisCommand.opts();
  
  // Configure global settings
  if (opts.noColor) {
    chalk.level = 0;
  }
  
  if (opts.verbose) {
    process.env.LMAY_VERBOSE = 'true';
  }
  
  // Check for configuration file
  const configPath = findConfigFile(process.cwd());
  if (configPath) {
    process.env.LMAY_CONFIG = configPath;
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Unexpected error:'), error.message);
  if (process.env.LMAY_VERBOSE) {
    console.error(error.stack);
  }
  console.log(chalk.dim('Run with --verbose for more details'));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled promise rejection:'), reason);
  if (process.env.LMAY_VERBOSE) {
    console.error(promise);
  }
  process.exit(1);
});

// Utility function to find configuration file
function findConfigFile(startPath) {
  const configNames = ['lmay.config.json', '.lmayrc', '.lmayrc.json'];
  let currentPath = startPath;
  
  while (currentPath !== path.dirname(currentPath)) {
    for (const configName of configNames) {
      const configPath = path.join(currentPath, configName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    currentPath = path.dirname(currentPath);
  }
  
  // Check global config
  const homeConfig = path.join(require('os').homedir(), '.lmayrc');
  if (fs.existsSync(homeConfig)) {
    return homeConfig;
  }
  
  return null;
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
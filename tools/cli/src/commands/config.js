const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const os = require('os');

const DEFAULT_CONFIG = {
  lmay: {
    version: "1.0",
    autoGenerate: true,
    validateOnSave: true
  },
  analysis: {
    excludePatterns: [
      "node_modules/**",
      ".git/**",
      "*.log",
      "dist/**",
      "build/**"
    ],
    includeHidden: false,
    maxDepth: 10,
    languageDetection: true
  },
  output: {
    rootFile: "root.lmay",
    indent: 2,
    format: "yaml"
  },
  structure: {
    createModuleFiles: true,
    groupByLanguage: false,
    includeTests: true
  },
  validation: {
    strict: false,
    checkReferences: true,
    checkHierarchy: true
  }
};

module.exports = async function configCommand(options) {
  const spinner = ora('Processing configuration...').start();

  try {
    const isGlobal = options.global || false;
    const configPath = getConfigPath(isGlobal);

    if (options.list) {
      await listConfig(configPath, spinner);
    } else if (options.set) {
      await setConfig(configPath, options.set, spinner);
    } else if (options.get) {
      await getConfig(configPath, options.get, spinner);
    } else if (options.reset) {
      await resetConfig(configPath, spinner);
    } else {
      await interactiveConfig(configPath, spinner);
    }

  } catch (error) {
    spinner.fail(`Configuration operation failed: ${error.message}`);
    
    if (process.env.LMAY_VERBOSE) {
      console.error(chalk.red('\n🔍 Error details:'));
      console.error(error.stack);
    }
    
    process.exit(1);
  }
};

function getConfigPath(isGlobal) {
  if (isGlobal) {
    return path.join(os.homedir(), '.lmayrc');
  } else {
    return path.join(process.cwd(), 'lmay.config.json');
  }
}

async function listConfig(configPath, spinner) {
  const config = await loadConfig(configPath);
  
  spinner.succeed('Current LMAY configuration:');
  
  console.log(chalk.cyan(`\n📁 Configuration file: ${configPath}`));
  console.log(chalk.dim(`   ${await fs.pathExists(configPath) ? 'Exists' : 'Does not exist (using defaults)'}\n`));

  displayConfigSection('LMAY Settings', config.lmay);
  displayConfigSection('Analysis Settings', config.analysis);
  displayConfigSection('Output Settings', config.output);
  displayConfigSection('Structure Settings', config.structure);
  displayConfigSection('Validation Settings', config.validation);
}

async function setConfig(configPath, setValue, spinner) {
  if (!setValue.includes('=')) {
    throw new Error('Invalid format. Use key=value format (e.g., analysis.maxDepth=15)');
  }

  const [keyPath, value] = setValue.split('=', 2);
  const config = await loadConfig(configPath);
  
  // Parse the value
  let parsedValue;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    parsedValue = value; // Keep as string if not valid JSON
  }
  
  // Set the value using dot notation
  setNestedValue(config, keyPath, parsedValue);
  
  // Save the updated configuration
  await saveConfig(configPath, config);
  
  spinner.succeed(`Configuration updated: ${keyPath} = ${JSON.stringify(parsedValue)}`);
  
  console.log(chalk.cyan('\n💡 To see all settings, run: lmay config --list'));
}

async function getConfig(configPath, keyPath, spinner) {
  const config = await loadConfig(configPath);
  const value = getNestedValue(config, keyPath);
  
  spinner.succeed(`Configuration value for ${keyPath}:`);
  
  if (value === undefined) {
    console.log(chalk.yellow('  Value not set (using default)'));
  } else {
    console.log(`  ${JSON.stringify(value, null, 2)}`);
  }
}

async function resetConfig(configPath, spinner) {
  spinner.stop();
  
  const answer = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Reset configuration to defaults? This will overwrite ${configPath}`,
    default: false
  }]);
  
  if (!answer.confirm) {
    console.log(chalk.yellow('Reset cancelled'));
    return;
  }
  
  spinner.start('Resetting configuration...');
  
  await saveConfig(configPath, DEFAULT_CONFIG);
  
  spinner.succeed('Configuration reset to defaults');
  
  console.log(chalk.cyan('\n💡 To customize settings, run: lmay config'));
}

async function interactiveConfig(configPath, spinner) {
  spinner.stop();
  
  console.log(chalk.cyan('🔧 Interactive LMAY Configuration'));
  console.log(`Configuration file: ${configPath}\n`);
  
  const config = await loadConfig(configPath);
  
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'autoGenerate',
      message: 'Auto-generate LMAY files when project structure changes?',
      default: config.lmay.autoGenerate
    },
    {
      type: 'confirm',
      name: 'validateOnSave',
      message: 'Validate LMAY files automatically when saving?',
      default: config.lmay.validateOnSave
    },
    {
      type: 'number',
      name: 'maxDepth',
      message: 'Maximum directory depth to analyze:',
      default: config.analysis.maxDepth,
      validate: input => input > 0 || 'Must be greater than 0'
    },
    {
      type: 'confirm',
      name: 'includeHidden',
      message: 'Include hidden files and directories?',
      default: config.analysis.includeHidden
    },
    {
      type: 'confirm',
      name: 'languageDetection',
      message: 'Enable automatic language detection?',
      default: config.analysis.languageDetection
    },
    {
      type: 'input',
      name: 'rootFile',
      message: 'Name for the root LMAY file:',
      default: config.output.rootFile,
      validate: input => input.endsWith('.lmay') || 'Must end with .lmay'
    },
    {
      type: 'list',
      name: 'format',
      message: 'Output format:',
      choices: ['yaml', 'json'],
      default: config.output.format
    },
    {
      type: 'number',
      name: 'indent',
      message: 'Indentation spaces:',
      default: config.output.indent,
      validate: input => input >= 2 && input <= 8 || 'Must be between 2 and 8'
    },
    {
      type: 'confirm',
      name: 'createModuleFiles',
      message: 'Create separate LMAY files for major modules?',
      default: config.structure.createModuleFiles
    },
    {
      type: 'confirm',
      name: 'includeTests',
      message: 'Include test directories in documentation?',
      default: config.structure.includeTests
    },
    {
      type: 'confirm',
      name: 'strictValidation',
      message: 'Enable strict validation mode?',
      default: config.validation.strict
    },
    {
      type: 'confirm',
      name: 'checkReferences',
      message: 'Validate file references and links?',
      default: config.validation.checkReferences
    },
    {
      type: 'confirm',
      name: 'checkHierarchy',
      message: 'Validate LMAY file hierarchy?',
      default: config.validation.checkHierarchy
    },
    {
      type: 'checkbox',
      name: 'excludePatterns',
      message: 'Select additional patterns to exclude:',
      choices: [
        { name: 'Log files (*.log)', value: '*.log' },
        { name: 'Backup files (*.bak, *.backup)', value: '*.bak' },
        { name: 'Temporary files (*.tmp, *.temp)', value: '*.tmp' },
        { name: 'Cache directories (cache/, .cache/)', value: 'cache/**' },
        { name: 'Documentation builds (docs/build/)', value: 'docs/build/**' }
      ]
    }
  ]);
  
  // Update configuration with answers
  config.lmay.autoGenerate = answers.autoGenerate;
  config.lmay.validateOnSave = answers.validateOnSave;
  config.analysis.maxDepth = answers.maxDepth;
  config.analysis.includeHidden = answers.includeHidden;
  config.analysis.languageDetection = answers.languageDetection;
  config.output.rootFile = answers.rootFile;
  config.output.format = answers.format;
  config.output.indent = answers.indent;
  config.structure.createModuleFiles = answers.createModuleFiles;
  config.structure.includeTests = answers.includeTests;
  config.validation.strict = answers.strictValidation;
  config.validation.checkReferences = answers.checkReferences;
  config.validation.checkHierarchy = answers.checkHierarchy;
  
  // Add any additional exclude patterns
  if (answers.excludePatterns.length > 0) {
    config.analysis.excludePatterns = [
      ...config.analysis.excludePatterns,
      ...answers.excludePatterns
    ];
  }
  
  spinner.start('Saving configuration...');
  
  await saveConfig(configPath, config);
  
  spinner.succeed('Configuration saved successfully!');
  
  console.log(chalk.cyan('\n📄 Configuration summary:'));
  console.log(`  ${chalk.blue('→')} File: ${configPath}`);
  console.log(`  ${chalk.blue('→')} Auto-generate: ${answers.autoGenerate ? chalk.green('enabled') : chalk.red('disabled')}`);
  console.log(`  ${chalk.blue('→')} Validation: ${answers.strictValidation ? chalk.yellow('strict') : chalk.green('normal')}`);
  console.log(`  ${chalk.blue('→')} Module files: ${answers.createModuleFiles ? chalk.green('enabled') : chalk.red('disabled')}`);
}

async function loadConfig(configPath) {
  try {
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf8');
      const userConfig = JSON.parse(content);
      
      // Deep merge with defaults
      return mergeDeep(DEFAULT_CONFIG, userConfig);
    }
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not load config from ${configPath}, using defaults`));
  }
  
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep copy
}

async function saveConfig(configPath, config) {
  await fs.ensureFile(configPath);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

function displayConfigSection(title, section) {
  console.log(chalk.cyan(`${title}:`));
  
  Object.entries(section).forEach(([key, value]) => {
    const formattedValue = Array.isArray(value) 
      ? `[${value.join(', ')}]`
      : JSON.stringify(value);
      
    console.log(`  ${chalk.blue(key)}: ${formattedValue}`);
  });
  
  console.log();
}

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

function getNestedValue(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

function mergeDeep(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}
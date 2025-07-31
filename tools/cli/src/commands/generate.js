const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');

// Import generator modules from the existing generator tool
const FileSystemScanner = require('../../../generator/src/scanner');
const DistributedScanner = require('../../../generator/src/distributed-scanner');
const LMAYGenerator = require('../../../generator/src/generator');

module.exports = async function generateCommand(projectPath, options, command) {
  const spinner = ora('Initializing LMAY generation...').start();

  try {
    const startTime = Date.now();
    const opts = command.optsWithGlobals();
    
    // Resolve paths
    const inputPath = path.resolve(projectPath);
    const outputPath = options.output ? path.resolve(options.output) : inputPath;
    
    if (opts.verbose) {
      spinner.info(`Project path: ${chalk.cyan(inputPath)}`);
      spinner.info(`Output path: ${chalk.cyan(outputPath)}`);
    }

    // Verify input directory exists
    if (!await fs.pathExists(inputPath)) {
      spinner.fail(`Input directory does not exist: ${inputPath}`);
      process.exit(1);
    }

    // Load configuration
    spinner.text = 'Loading configuration...';
    const config = await loadConfig(options.config, opts.verbose);
    
    if (opts.verbose) {
      spinner.info('Configuration loaded successfully');
    }

    // Choose scanner based on options
    let scanner;
    if (options.distributed || options.scanRemote) {
      spinner.text = 'Initializing distributed scanner...';
      scanner = new DistributedScanner(config);
      
      if (opts.verbose) {
        spinner.info('Using distributed system scanner');
      }
    } else {
      spinner.text = 'Initializing file system scanner...';
      scanner = new FileSystemScanner(config);
      
      if (opts.verbose) {
        spinner.info('Using standard file system scanner');
      }
    }

    // Scan project structure
    spinner.text = 'Analyzing project structure...';
    let structure;
    
    if (options.distributed && options.scanRemote) {
      // For distributed systems with remote scanning
      structure = await scanner.scanAllSources();
    } else {
      // Standard directory scan
      structure = await scanner.scanDirectory(inputPath);
    }
    
    if (!structure) {
      spinner.fail('Failed to analyze project structure');
      process.exit(1);
    }

    // Analyze the structure
    spinner.text = 'Processing analysis results...';
    const analysis = scanner.analyzeStructure(structure);
    
    if (opts.verbose) {
      spinner.succeed('Analysis completed:');
      console.log(`  ${chalk.blue('→')} Directories: ${analysis.totalDirectories}`);
      console.log(`  ${chalk.blue('→')} Files: ${analysis.totalFiles}`);
      console.log(`  ${chalk.blue('→')} Languages: ${analysis.languages.join(', ') || 'none detected'}`);
      console.log(`  ${chalk.blue('→')} Entry points: ${analysis.entryPoints.length}`);
    } else {
      spinner.succeed(`Analyzed ${analysis.totalFiles} files in ${analysis.totalDirectories} directories`);
    }

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.yellow('\n📋 Dry Run Mode - Files that would be generated:'));
      
      const rootFile = path.join(outputPath, config.output.rootFile);
      console.log(`  ${chalk.green('✓')} ${rootFile}`);
      
      if (config.structure.createModuleFiles && analysis.totalDirectories > 3) {
        console.log(`  ${chalk.green('✓')} Additional module files would be created`);
      }
      
      if (options.distributed) {
        console.log(`  ${chalk.green('✓')} Distributed system documentation files`);
      }
      
      console.log(chalk.green('\n✨ Dry run completed successfully'));
      return;
    }

    // Check for existing files
    const rootFilePath = path.join(outputPath, config.output.rootFile);
    if (await fs.pathExists(rootFilePath) && !options.overwrite) {
      const answer = await require('inquirer').prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: `LMAY file exists at ${rootFilePath}. Overwrite?`,
        default: false
      }]);
      
      if (!answer.overwrite) {
        spinner.info('Generation cancelled by user');
        return;
      }
    }

    // Generate LMAY files
    spinner.start('Generating LMAY documentation...');
    const generator = new LMAYGenerator(config);
    const result = await generator.generate(outputPath, structure, analysis);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    spinner.succeed('LMAY generation completed successfully!');
    
    // Display results
    console.log(chalk.green('\n📄 Generated files:'));
    console.log(`  ${chalk.blue('→')} Root file: ${result.rootFile}`);
    
    if (result.moduleFiles && result.moduleFiles.length > 0) {
      console.log(`  ${chalk.blue('→')} Module files: ${result.moduleFiles.length}`);
      if (opts.verbose) {
        result.moduleFiles.forEach(file => {
          console.log(`    • ${file}`);
        });
      }
    }
    
    console.log(`  ${chalk.blue('→')} Generation time: ${duration}s`);

    // Next steps suggestions
    console.log(chalk.cyan('\n💡 Next steps:'));
    console.log(`  1. Review the generated ${chalk.bold('root.lmay')} file`);
    console.log(`  2. Customize descriptions and metadata as needed`);
    console.log(`  3. Validate with: ${chalk.bold('lmay validate')}`);
    
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      result.warnings.forEach(warning => {
        console.log(`  • ${warning}`);
      });
    }

  } catch (error) {
    spinner.fail(`Generation failed: ${error.message}`);
    
    if (opts.verbose) {
      console.error(chalk.red('\n🔍 Error details:'));
      console.error(error.stack);
    }
    
    console.log(chalk.dim('\nRun with --verbose for more details'));
    process.exit(1);
  }
};

async function loadConfig(configPath, verbose) {
  let config;
  
  if (configPath) {
    // Custom configuration file
    const fullPath = path.resolve(configPath);
    
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`Configuration file not found: ${fullPath}`);
    }
    
    try {
      const configContent = await fs.readFile(fullPath, 'utf8');
      config = JSON.parse(configContent);
      
      if (verbose) {
        console.log(`📝 Using custom config: ${fullPath}`);
      }
    } catch (error) {
      throw new Error(`Invalid configuration file: ${error.message}`);
    }
  } else {
    // Check for project config or use default
    const projectConfig = path.join(process.cwd(), 'lmay.config.json');
    
    if (await fs.pathExists(projectConfig)) {
      const configContent = await fs.readFile(projectConfig, 'utf8');
      config = JSON.parse(configContent);
      
      if (verbose) {
        console.log(`📝 Using project config: ${projectConfig}`);
      }
    } else {
      // Load default configuration
      const defaultConfigPath = path.join(__dirname, '../../../generator/config/default.json');
      const configContent = await fs.readFile(defaultConfigPath, 'utf8');
      config = JSON.parse(configContent);
      
      if (verbose) {
        console.log('📝 Using default configuration');
      }
    }
  }

  // Validate configuration structure
  if (!config.lmay || !config.analysis || !config.output) {
    throw new Error('Invalid LMAY configuration - missing required sections');
  }

  return config;
}
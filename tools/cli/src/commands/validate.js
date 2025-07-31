const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');

// Import validator modules from the existing validator tool
const LMAYValidator = require('../../../validator/src/validator');

module.exports = async function validateCommand(file, options, command) {
  const spinner = ora('Initializing LMAY validation...').start();

  try {
    const startTime = Date.now();
    const opts = command.optsWithGlobals();
    
    // Determine validation mode
    const isProjectMode = options.project || (!file && await fs.pathExists('root.lmay'));
    
    if (opts.verbose) {
      spinner.info(`Validation mode: ${isProjectMode ? 'Project' : 'Single file'}`);
    }

    // Configure validator
    const validatorConfig = {
      strict: options.strict || false,
      checkReferences: options.references !== false,
      checkHierarchy: options.hierarchy !== false,
      distributed: options.checkDistributed || false,
      validateTopology: options.validateTopology || false,
      checkNetworkConnectivity: options.checkNetworkConnectivity || false,
      includeInfrastructure: options.includeInfrastructure || false
    };

    const validator = new LMAYValidator(validatorConfig);
    
    if (opts.verbose) {
      spinner.info('Validator configured with options:');
      Object.entries(validatorConfig).forEach(([key, value]) => {
        if (value) {
          console.log(`  ${chalk.blue('→')} ${key}: ${chalk.green('enabled')}`);
        }
      });
    }

    let results;
    let targetPath;
    
    if (isProjectMode) {
      // Project validation
      const projectPath = options.project || process.cwd();
      const rootFile = file || 'root.lmay';
      targetPath = path.join(projectPath, rootFile);
      
      spinner.text = `Validating project: ${path.basename(projectPath)}`;
      
      if (opts.verbose) {
        spinner.info(`Project path: ${chalk.cyan(projectPath)}`);
        spinner.info(`Root file: ${chalk.cyan(rootFile)}`);
      }
      
      results = await validator.validateProject(projectPath, rootFile);
    } else {
      // Single file validation
      targetPath = path.resolve(file || 'root.lmay');
      
      if (!await fs.pathExists(targetPath)) {
        spinner.fail(`File not found: ${targetPath}`);
        process.exit(1);
      }
      
      spinner.text = `Validating file: ${path.basename(targetPath)}`;
      
      if (opts.verbose) {
        spinner.info(`File path: ${chalk.cyan(targetPath)}`);
      }
      
      results = await validator.validateFile(targetPath);
    }

    // Attempt automatic fixes if requested
    if (options.fix && results.warnings.length > 0) {
      spinner.text = 'Attempting automatic fixes...';
      const fixedCount = await attemptAutoFix(results.warnings, opts.verbose);
      
      if (fixedCount > 0) {
        console.log(chalk.green(`🔧 Fixed ${fixedCount} issues automatically`));
        
        // Re-validate after fixes
        if (isProjectMode) {
          results = await validator.validateProject(path.dirname(targetPath), path.basename(targetPath));
        } else {
          results = await validator.validateFile(targetPath);
        }
      }
    }

    // Generate detailed report
    const report = validator.generateDetailedReport();
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Display results
    if (results.valid) {
      spinner.succeed(chalk.green('Validation passed!'));
    } else {
      spinner.fail(chalk.red('Validation failed'));
    }

    // Show summary
    console.log(chalk.cyan('\n📊 Validation Summary:'));
    console.log(`  ${chalk.blue('→')} Status: ${results.valid ? chalk.green('VALID') : chalk.red('INVALID')}`);
    console.log(`  ${chalk.blue('→')} Errors: ${chalk.red(report.summary.total.errorCount)}`);
    console.log(`  ${chalk.blue('→')} Warnings: ${chalk.yellow(report.summary.total.warningCount)}`);
    console.log(`  ${chalk.blue('→')} Duration: ${duration}s`);

    // Show validator breakdown in verbose mode
    if (opts.verbose && Object.keys(report.summary).length > 1) {
      console.log(chalk.cyan('\n🔍 Validator Breakdown:'));
      Object.entries(report.summary).forEach(([validator, summary]) => {
        if (validator !== 'total') {
          const status = summary.errorCount === 0 ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${status} ${validator}: ${summary.errorCount} errors, ${summary.warningCount} warnings`);
        }
      });
    }

    // Display errors
    if (report.errors.length > 0) {
      console.log(chalk.red('\n❌ Errors:'));
      report.errors.forEach((error, index) => {
        console.log(`\n  ${index + 1}. ${chalk.bold(error.message)}`);
        console.log(`     ${chalk.dim('File:')} ${error.file}`);
        
        if (error.path) {
          console.log(`     ${chalk.dim('Path:')} ${error.path}`);
        }
        
        if (error.line) {
          console.log(`     ${chalk.dim('Location:')} Line ${error.line}${error.column ? `, Column ${error.column}` : ''}`);
        }
        
        if (opts.verbose && error.snippet) {
          console.log(`     ${chalk.dim('Code:')}`);
          error.snippet.split('\n').forEach(line => {
            console.log(`       ${chalk.gray(line)}`);
          });
        }
      });
    }

    // Display warnings
    if (report.warnings.length > 0 && (opts.verbose || report.errors.length === 0)) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      report.warnings.forEach((warning, index) => {
        console.log(`\n  ${index + 1}. ${chalk.bold(warning.message)}`);
        console.log(`     ${chalk.dim('File:')} ${warning.file}`);
        
        if (warning.path) {
          console.log(`     ${chalk.dim('Path:')} ${warning.path}`);
        }
        
        if (warning.suggestion) {
          console.log(`     ${chalk.dim('Suggestion:')} ${warning.suggestion}`);
        }
      });
    }

    // Save report if requested
    if (options.output) {
      await saveReport(report, options.output, options.format);
      console.log(chalk.green(`\n📄 Report saved to: ${options.output}`));
    }

    // Show recommendations
    if (!results.valid) {
      console.log(chalk.cyan('\n💡 Recommendations:'));
      
      if (!opts.verbose) {
        console.log('  • Use --verbose for detailed error information');
      }
      
      if (!options.fix) {
        console.log('  • Use --fix to automatically correct minor issues');
      }
      
      console.log('  • Check the LMAY specification documentation');
      console.log('  • Validate incrementally during development');
    } else if (report.warnings.length > 0) {
      console.log(chalk.cyan('\n💡 Suggestions:'));
      console.log('  • Consider addressing warnings for best practices');
      console.log('  • Use --fix to automatically resolve fixable warnings');
    }

    process.exit(results.valid ? 0 : 1);

  } catch (error) {
    spinner.fail(`Validation failed: ${error.message}`);
    
    if (opts.verbose) {
      console.error(chalk.red('\n🔍 Error details:'));
      console.error(error.stack);
    }
    
    console.log(chalk.dim('\nRun with --verbose for more details'));
    process.exit(1);
  }
};

async function attemptAutoFix(warnings, verbose) {
  let fixedCount = 0;
  
  for (const warning of warnings) {
    try {
      const fixed = await fixWarning(warning);
      if (fixed) {
        fixedCount++;
        if (verbose) {
          console.log(`  ${chalk.green('✓')} Fixed: ${warning.message}`);
        }
      }
    } catch (error) {
      if (verbose) {
        console.log(`  ${chalk.red('✗')} Could not fix: ${warning.message}`);
      }
    }
  }
  
  return fixedCount;
}

async function fixWarning(warning) {
  switch (warning.type) {
    case 'trailing_whitespace':
      return await fixTrailingWhitespace(warning.file);
    
    case 'inconsistent_indentation':
      return await fixIndentation(warning.file);
    
    case 'missing_newline_at_eof':
      return await fixMissingNewline(warning.file);
    
    default:
      return false;
  }
}

async function fixTrailingWhitespace(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const fixedContent = content.replace(/[ \t]+$/gm, '');
    
    if (content !== fixedContent) {
      await fs.writeFile(filePath, fixedContent);
      return true;
    }
  } catch (error) {
    // Ignore fix errors
  }
  
  return false;
}

async function fixIndentation(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const fixedContent = content.replace(/\t/g, '  ');
    
    if (content !== fixedContent) {
      await fs.writeFile(filePath, fixedContent);
      return true;
    }
  } catch (error) {
    // Ignore fix errors
  }
  
  return false;
}

async function fixMissingNewline(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    if (!content.endsWith('\n')) {
      await fs.writeFile(filePath, content + '\n');
      return true;
    }
  } catch (error) {
    // Ignore fix errors
  }
  
  return false;
}

async function saveReport(report, outputPath, format) {
  let content;
  
  switch (format.toLowerCase()) {
    case 'json':
      content = JSON.stringify(report, null, 2);
      break;
    
    case 'sarif':
      content = generateSARIFReport(report);
      break;
    
    default: // text
      content = generateTextReport(report);
      break;
  }
  
  await fs.writeFile(outputPath, content);
}

function generateTextReport(report) {
  const lines = [];
  lines.push('LMAY Validation Report');
  lines.push('='.repeat(50));
  lines.push(`Generated: ${report.timestamp || new Date().toISOString()}`);
  lines.push(`Status: ${report.valid ? 'VALID' : 'INVALID'}`);
  lines.push(`Errors: ${report.summary.total.errorCount}`);
  lines.push(`Warnings: ${report.summary.total.warningCount}`);
  lines.push('');
  
  if (report.errors.length > 0) {
    lines.push('ERRORS:');
    lines.push('-'.repeat(20));
    report.errors.forEach((error, index) => {
      lines.push(`${index + 1}. ${error.message}`);
      lines.push(`   File: ${error.file}`);
      if (error.path) lines.push(`   Path: ${error.path}`);
      if (error.line) lines.push(`   Line: ${error.line}`);
      lines.push('');
    });
  }
  
  if (report.warnings.length > 0) {
    lines.push('WARNINGS:');
    lines.push('-'.repeat(20));
    report.warnings.forEach((warning, index) => {
      lines.push(`${index + 1}. ${warning.message}`);
      lines.push(`   File: ${warning.file}`);
      if (warning.path) lines.push(`   Path: ${warning.path}`);
      if (warning.suggestion) lines.push(`   Suggestion: ${warning.suggestion}`);
      lines.push('');
    });
  }
  
  return lines.join('\n');
}

function generateSARIFReport(report) {
  // Reuse SARIF generation from existing validator
  const { generateSARIFReport: existingSARIF } = require('../../../validator/src/cli');
  return existingSARIF(report);
}
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const generateCommand = require('./generate');
const validateCommand = require('./validate');

module.exports = async function batchCommand(command, paths, options) {
  const spinner = ora(`Initializing batch ${command} operation...`).start();

  try {
    const startTime = Date.now();
    const parallel = parseInt(options.parallel) || 4;
    const continueOnError = options.continueOnError || false;
    
    if (process.env.LMAY_VERBOSE) {
      spinner.info(`Batch operation: ${command}`);
      spinner.info(`Paths: ${paths.length}`);
      spinner.info(`Parallel processes: ${parallel}`);
      spinner.info(`Continue on error: ${continueOnError}`);
    }

    // Validate command
    if (!['generate', 'validate'].includes(command)) {
      throw new Error(`Unsupported batch command: ${command}. Use 'generate' or 'validate'`);
    }

    // Resolve and validate paths
    spinner.text = 'Resolving target paths...';
    const resolvedPaths = await resolveBatchPaths(paths);
    
    if (resolvedPaths.length === 0) {
      throw new Error('No valid paths found for batch processing');
    }

    spinner.succeed(`Found ${resolvedPaths.length} targets for batch processing`);

    // Process paths in batches
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < resolvedPaths.length; i += parallel) {
      const batch = resolvedPaths.slice(i, i + parallel);
      
      spinner.start(`Processing batch ${Math.floor(i / parallel) + 1}/${Math.ceil(resolvedPaths.length / parallel)}`);
      
      const batchPromises = batch.map(async (targetPath) => {
        try {
          const result = await processSingleTarget(command, targetPath, options);
          return {
            path: targetPath,
            status: 'success',
            result: result
          };
        } catch (error) {
          return {
            path: targetPath,
            status: 'error',
            error: error.message,
            stack: error.stack
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

      // Display batch results
      for (const result of batchResults) {
        if (result.status === 'success') {
          console.log(`  ${chalk.green('✓')} ${path.basename(result.path)}`);
        } else {
          console.log(`  ${chalk.red('✗')} ${path.basename(result.path)}: ${result.error}`);
          
          if (!continueOnError) {
            spinner.fail(`Batch processing stopped due to error in: ${result.path}`);
            if (process.env.LMAY_VERBOSE) {
              console.error(chalk.red('\n🔍 Error details:'));
              console.error(result.stack);
            }
            process.exit(1);
          }
        }
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Display final results
    if (errorCount === 0) {
      spinner.succeed(`Batch processing completed successfully!`);
    } else if (successCount > 0) {
      spinner.warn(`Batch processing completed with some errors`);
    } else {
      spinner.fail(`Batch processing failed for all targets`);
    }

    console.log(chalk.cyan('\n📊 Batch Results Summary:'));
    console.log(`  ${chalk.blue('→')} Command: ${command}`);
    console.log(`  ${chalk.blue('→')} Total targets: ${resolvedPaths.length}`);
    console.log(`  ${chalk.blue('→')} Successful: ${chalk.green(successCount)}`);
    console.log(`  ${chalk.blue('→')} Failed: ${chalk.red(errorCount)}`);
    console.log(`  ${chalk.blue('→')} Duration: ${duration}s`);

    // Save batch report if requested
    if (options.output) {
      await saveBatchReport(results, options.output, command);
      console.log(chalk.green(`\n📄 Batch report saved to: ${options.output}`));
    }

    // Display detailed errors if verbose
    if (process.env.LMAY_VERBOSE && errorCount > 0) {
      console.log(chalk.red('\n❌ Detailed Errors:'));
      results.filter(r => r.status === 'error').forEach((result, index) => {
        console.log(`\n  ${index + 1}. ${chalk.bold(result.path)}`);
        console.log(`     ${chalk.dim('Error:')} ${result.error}`);
      });
    }

    process.exit(errorCount === 0 ? 0 : 1);

  } catch (error) {
    spinner.fail(`Batch processing failed: ${error.message}`);
    
    if (process.env.LMAY_VERBOSE) {
      console.error(chalk.red('\n🔍 Error details:'));
      console.error(error.stack);
    }
    
    process.exit(1);
  }
};

async function resolveBatchPaths(patterns) {
  const paths = [];
  
  for (const pattern of patterns) {
    try {
      const resolvedPattern = path.resolve(pattern);
      
      // Check if it's a direct path
      if (await fs.pathExists(resolvedPattern)) {
        const stat = await fs.stat(resolvedPattern);
        if (stat.isDirectory()) {
          paths.push(resolvedPattern);
        } else if (resolvedPattern.endsWith('.lmay')) {
          paths.push(resolvedPattern);
        }
        continue;
      }
      
      // Handle glob patterns (simplified - for full glob support, we'd use a library like 'glob')
      if (pattern.includes('*')) {
        const globPaths = await expandGlobPattern(pattern);
        paths.push(...globPaths);
      }
      
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not resolve pattern '${pattern}': ${error.message}`));
    }
  }
  
  // Remove duplicates
  return [...new Set(paths)];
}

async function expandGlobPattern(pattern) {
  // Simplified glob expansion - in a real implementation, use the 'glob' package
  const paths = [];
  const basePath = pattern.replace(/\/\*.*$/, '');
  
  try {
    if (await fs.pathExists(basePath)) {
      const entries = await fs.readdir(basePath);
      
      for (const entry of entries) {
        const fullPath = path.join(basePath, entry);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory() && pattern.includes('*/')) {
          paths.push(fullPath);
        } else if (pattern.endsWith('*.lmay') && entry.endsWith('.lmay')) {
          paths.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Ignore glob expansion errors
  }
  
  return paths;
}

async function processSingleTarget(command, targetPath, options) {
  // Create a mock command object with global options
  const mockCommand = {
    optsWithGlobals: () => ({
      verbose: process.env.LMAY_VERBOSE === 'true'
    })
  };

  switch (command) {
    case 'generate':
      // For directories, generate LMAY documentation
      if ((await fs.stat(targetPath)).isDirectory()) {
        return await generateCommand(targetPath, options, mockCommand);
      } else {
        throw new Error('Generate command requires a directory path');
      }
      
    case 'validate':
      // For files, validate directly; for directories, validate root.lmay
      if ((await fs.stat(targetPath)).isFile()) {
        return await validateCommand(targetPath, options, mockCommand);
      } else {
        const rootLmayPath = path.join(targetPath, 'root.lmay');
        if (await fs.pathExists(rootLmayPath)) {
          return await validateCommand('root.lmay', { ...options, project: targetPath }, mockCommand);
        } else {
          throw new Error('No root.lmay file found in directory');
        }
      }
      
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
}

async function saveBatchReport(results, outputPath, command) {
  const report = {
    type: 'batch',
    command: command,
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length
    },
    results: results.map(result => ({
      path: result.path,
      status: result.status,
      ...(result.error && { error: result.error }),
      ...(result.result && { 
        duration: result.result.duration,
        details: result.result.summary 
      })
    }))
  };
  
  // Generate different formats based on file extension
  const ext = path.extname(outputPath).toLowerCase();
  let content;
  
  switch (ext) {
    case '.json':
      content = JSON.stringify(report, null, 2);
      break;
      
    case '.csv':
      content = generateCSVReport(report);
      break;
      
    default: // .txt or no extension
      content = generateTextBatchReport(report);
      break;
  }
  
  await fs.writeFile(outputPath, content);
}

function generateTextBatchReport(report) {
  const lines = [];
  lines.push(`LMAY Batch ${report.command.toUpperCase()} Report`);
  lines.push('='.repeat(50));
  lines.push(`Generated: ${report.timestamp}`);
  lines.push(`Command: ${report.command}`);
  lines.push(`Total targets: ${report.summary.total}`);
  lines.push(`Successful: ${report.summary.successful}`);
  lines.push(`Failed: ${report.summary.failed}`);
  lines.push('');
  
  lines.push('RESULTS:');
  lines.push('-'.repeat(20));
  
  for (const result of report.results) {
    const status = result.status === 'success' ? '✓' : '✗';
    lines.push(`${status} ${result.path}`);
    
    if (result.error) {
      lines.push(`  Error: ${result.error}`);
    }
    
    if (result.details) {
      lines.push(`  Details: ${JSON.stringify(result.details)}`);
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateCSVReport(report) {
  const lines = [];
  lines.push('Path,Status,Error,Duration');
  
  for (const result of report.results) {
    const row = [
      `"${result.path}"`,
      result.status,
      result.error ? `"${result.error.replace(/"/g, '""')}"` : '',
      result.duration || ''
    ];
    lines.push(row.join(','));
  }
  
  return lines.join('\n');
}
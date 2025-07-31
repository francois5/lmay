#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const LMAYValidator = require('./validator');

const program = new Command();

program
  .name('lmay-validate')
  .description('Valide les fichiers LMAY selon la spécification v1.0')
  .version('1.0.0');

program
  .argument('[file]', 'Fichier LMAY à valider (défaut: root.lmay)')
  .option('-p, --project <path>', 'Valider un projet complet')
  .option('-s, --strict', 'Mode strict (continue même si erreurs)')
  .option('--no-references', 'Désactiver la validation des références')
  .option('--no-hierarchy', 'Désactiver la validation de la hiérarchie')
  .option('-f, --format <format>', 'Format de sortie (text|json|sarif)', 'text')
  .option('-o, --output <file>', 'Fichier de sortie pour le rapport')
  .option('--verbose', 'Mode verbeux')
  .option('--fix', 'Tenter de corriger automatiquement les erreurs mineures')
  .action(async (file, options) => {
    try {
      await validateLMAY(file, options);
    } catch (error) {
      console.error('❌ Erreur:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Commande pour valider plusieurs fichiers
program
  .command('batch')
  .description('Valide plusieurs fichiers LMAY')
  .argument('<files...>', 'Fichiers LMAY à valider')
  .option('-f, --format <format>', 'Format de sortie', 'text')
  .option('-o, --output <file>', 'Fichier de sortie pour le rapport')
  .option('--continue-on-error', 'Continuer même en cas d\'erreur')
  .action(async (files, options) => {
    await validateBatch(files, options);
  });

async function validateLMAY(file, options) {
  const startTime = Date.now();
  
  // Déterminer le mode de validation
  const isProjectMode = options.project || (!file && fs.existsSync('root.lmay'));
  
  if (options.verbose) {
    console.log(`🔍 Mode: ${isProjectMode ? 'Projet' : 'Fichier unique'}`);
  }

  // Configurer le validateur
  const validator = new LMAYValidator({
    strict: options.strict,
    checkReferences: options.references !== false,
    checkHierarchy: options.hierarchy !== false
  });

  let results;
  
  if (isProjectMode) {
    // Validation de projet
    const projectPath = options.project || process.cwd();
    const rootFile = file || 'root.lmay';
    
    if (options.verbose) {
      console.log(`📁 Projet: ${projectPath}`);
      console.log(`📄 Fichier racine: ${rootFile}`);
    }
    
    results = await validator.validateProject(projectPath, rootFile);
  } else {
    // Validation de fichier unique
    const filePath = path.resolve(file || 'root.lmay');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable: ${filePath}`);
    }
    
    if (options.verbose) {
      console.log(`📄 Fichier: ${filePath}`);
    }
    
    results = await validator.validateFile(filePath);
  }

  // Tentative de correction automatique
  if (options.fix && results.warnings.length > 0) {
    console.log('🔧 Tentative de correction automatique...');
    const fixedCount = await attemptAutoFix(results.warnings, options.verbose);
    if (fixedCount > 0) {
      console.log(`✅ ${fixedCount} problèmes corrigés automatiquement`);
    }
  }

  // Générer le rapport
  const report = validator.generateDetailedReport();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Afficher les résultats
  await displayResults(report, options, duration);

  // Sauvegarder le rapport si demandé
  if (options.output) {
    await saveReport(report, options.output, options.format);
    console.log(`📄 Rapport sauvegardé: ${options.output}`);
  }

  // Code de sortie
  process.exit(results.valid ? 0 : 1);
}

async function validateBatch(files, options) {
  console.log(`🔍 Validation en lot de ${files.length} fichiers\n`);
  
  const results = [];
  let successCount = 0;
  
  for (const file of files) {
    try {
      console.log(`📄 Validation: ${file}`);
      
      const validator = new LMAYValidator();
      const result = await validator.validateFile(path.resolve(file));
      
      results.push({
        file,
        result,
        status: result.valid ? 'success' : 'error'
      });
      
      if (result.valid) {
        successCount++;
        console.log('  ✅ Valide');
      } else {
        console.log(`  ❌ ${result.errors.length} erreurs`);
        if (!options.continueOnError) {
          break;
        }
      }
      
    } catch (error) {
      console.log(`  💥 Erreur: ${error.message}`);
      results.push({
        file,
        error: error.message,
        status: 'error'
      });
      
      if (!options.continueOnError) {
        break;
      }
    }
    
    console.log();
  }

  // Résumé
  console.log(`\n📊 Résumé: ${successCount}/${files.length} fichiers valides`);

  // Sauvegarder le rapport batch si demandé
  if (options.output) {
    await saveBatchReport(results, options.output, options.format);
    console.log(`📄 Rapport batch sauvegardé: ${options.output}`);
  }

  process.exit(successCount === files.length ? 0 : 1);
}

async function displayResults(report, options, duration) {
  console.log('\n' + '='.repeat(60));
  
  if (report.valid) {
    console.log('✅ VALIDATION RÉUSSIE');
  } else {
    console.log('❌ VALIDATION ÉCHOUÉE');
  }
  
  console.log('='.repeat(60));
  
  // Résumé
  console.log(`📊 Résumé:`);
  console.log(`   Erreurs: ${report.summary.total.errorCount}`);
  console.log(`   Avertissements: ${report.summary.total.warningCount}`);
  console.log(`   Durée: ${duration}s`);

  // Détail par validateur
  if (options.verbose && Object.keys(report.summary).length > 1) {
    console.log('\n📋 Détail par validateur:');
    for (const [validator, summary] of Object.entries(report.summary)) {
      if (validator !== 'total') {
        console.log(`   ${validator}: ${summary.errorCount} erreurs, ${summary.warningCount} avertissements`);
      }
    }
  }

  // Afficher les erreurs
  if (report.errors.length > 0) {
    console.log('\n❌ ERREURS:');
    for (const error of report.errors) {
      displayError(error, options.verbose);
    }
  }

  // Afficher les avertissements
  if (report.warnings.length > 0 && (options.verbose || report.errors.length === 0)) {
    console.log('\n⚠️  AVERTISSEMENTS:');
    for (const warning of report.warnings) {
      displayWarning(warning, options.verbose);
    }
  }

  // Conseils
  if (!report.valid) {
    console.log('\n💡 Conseils:');
    console.log('   • Utilisez --verbose pour plus de détails');
    console.log('   • Utilisez --fix pour corriger automatiquement certains problèmes');
    console.log('   • Consultez la documentation LMAY v1.0');
  }
}

function displayError(error, verbose) {
  console.log(`\n   🚫 ${error.message}`);
  console.log(`      Fichier: ${error.file}`);
  
  if (error.path) {
    console.log(`      Chemin: ${error.path}`);
  }
  
  if (error.line) {
    console.log(`      Ligne: ${error.line}${error.column ? `, Colonne: ${error.column}` : ''}`);
  }
  
  if (verbose && error.snippet) {
    console.log(`      Code:\n${error.snippet.split('\n').map(line => `        ${line}`).join('\n')}`);
  }
}

function displayWarning(warning, verbose) {
  console.log(`\n   ⚠️  ${warning.message}`);
  console.log(`      Fichier: ${warning.file}`);
  
  if (warning.path) {
    console.log(`      Chemin: ${warning.path}`);
  }
  
  if (warning.suggestion) {
    console.log(`      Suggestion: ${warning.suggestion}`);
  }
}

async function attemptAutoFix(warnings, verbose) {
  let fixedCount = 0;
  
  for (const warning of warnings) {
    try {
      const fixed = await fixWarning(warning);
      if (fixed) {
        fixedCount++;
        if (verbose) {
          console.log(`  ✅ Corrigé: ${warning.message}`);
        }
      }
    } catch (error) {
      if (verbose) {
        console.log(`  ❌ Impossible de corriger: ${warning.message}`);
      }
    }
  }
  
  return fixedCount;
}

async function fixWarning(warning) {
  // Implémentation basique de correction automatique
  switch (warning.type) {
    case 'trailing_whitespace':
      return await fixTrailingWhitespace(warning.file);
    
    case 'inconsistent_indentation':
      return await fixIndentation(warning.file);
    
    default:
      return false;
  }
}

async function fixTrailingWhitespace(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixedContent = content.replace(/[ \t]+$/gm, '');
    
    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent);
      return true;
    }
  } catch (error) {
    // Ignorer les erreurs de correction
  }
  
  return false;
}

async function fixIndentation(filePath) {
  // Implémentation simplifiée - conversion des tabs en espaces
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixedContent = content.replace(/\t/g, '  ');
    
    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent);
      return true;
    }
  } catch (error) {
    // Ignorer les erreurs de correction
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
  
  fs.writeFileSync(outputPath, content);
}

async function saveBatchReport(results, outputPath, format) {
  const report = {
    type: 'batch',
    timestamp: new Date().toISOString(),
    total: results.length,
    successful: results.filter(r => r.status === 'success').length,
    results
  };
  
  await saveReport(report, outputPath, format);
}

function generateTextReport(report) {
  const lines = [];
  lines.push(`LMAY Validation Report`);
  lines.push(`Generated: ${report.timestamp}`);
  lines.push(`Status: ${report.valid ? 'VALID' : 'INVALID'}`);
  lines.push(`Errors: ${report.summary.total.errorCount}`);
  lines.push(`Warnings: ${report.summary.total.warningCount}`);
  lines.push('');
  
  if (report.errors.length > 0) {
    lines.push('ERRORS:');
    for (const error of report.errors) {
      lines.push(`- ${error.message} (${error.file})`);
    }
    lines.push('');
  }
  
  if (report.warnings.length > 0) {
    lines.push('WARNINGS:');
    for (const warning of report.warnings) {
      lines.push(`- ${warning.message} (${warning.file})`);
    }
  }
  
  return lines.join('\n');
}

function generateSARIFReport(report) {
  const sarif = {
    version: "2.1.0",
    "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [{
      tool: {
        driver: {
          name: "lmay-validator",
          version: "1.0.0",
          informationUri: "https://github.com/francois5/lmay",
          shortDescription: {
            text: "LMAY file system structure validator"
          },
          fullDescription: {
            text: "Validates LMAY (LMAY Markup for AI in YAML) files for file system documentation and structure analysis"
          },
          rules: generateSARIFRules()
        }
      },
      results: []
    }]
  };

  // Convertir les erreurs en résultats SARIF
  for (const error of report.errors) {
    sarif.runs[0].results.push({
      ruleId: error.type,
      level: "error",
      message: {
        text: error.message
      },
      locations: [{
        physicalLocation: {
          artifactLocation: {
            uri: error.file,
            uriBaseId: "%SRCROOT%"
          },
          ...(error.line && {
            region: {
              startLine: error.line,
              ...(error.column && { startColumn: error.column })
            }
          })
        }
      }],
      ...(error.path && {
        properties: {
          jsonPath: error.path
        }
      })
    });
  }

  // Convertir les avertissements en résultats SARIF
  for (const warning of report.warnings) {
    sarif.runs[0].results.push({
      ruleId: warning.type,
      level: "warning",
      message: {
        text: warning.message
      },
      locations: [{
        physicalLocation: {
          artifactLocation: {
            uri: warning.file,
            uriBaseId: "%SRCROOT%"
          },
          ...(warning.line && {
            region: {
              startLine: warning.line,
              ...(warning.column && { startColumn: warning.column })
            }
          })
        }
      }],
      ...(warning.suggestion && {
        fixes: [{
          description: {
            text: warning.suggestion
          }
        }]
      })
    });
  }

  return JSON.stringify(sarif, null, 2);
}

function generateSARIFRules() {
  return [
    {
      id: "file_not_found",
      shortDescription: { text: "LMAY file not found" },
      fullDescription: { text: "The specified LMAY file could not be found in the file system" },
      defaultConfiguration: { level: "error" }
    },
    {
      id: "yaml_syntax_error",
      shortDescription: { text: "YAML syntax error" },
      fullDescription: { text: "The LMAY file contains invalid YAML syntax" },
      defaultConfiguration: { level: "error" }
    },
    {
      id: "missing_required_property",
      shortDescription: { text: "Missing required property" },
      fullDescription: { text: "A required property is missing from the LMAY structure" },
      defaultConfiguration: { level: "error" }
    },
    {
      id: "referenced_path_not_found",
      shortDescription: { text: "Referenced path not found" },
      fullDescription: { text: "A path referenced in the LMAY file does not exist in the file system" },
      defaultConfiguration: { level: "error" }
    },
    {
      id: "circular_reference",
      shortDescription: { text: "Circular reference detected" },
      fullDescription: { text: "A circular reference was detected between LMAY files" },
      defaultConfiguration: { level: "error" }
    },
    {
      id: "inconsistent_indentation",
      shortDescription: { text: "Inconsistent indentation" },
      fullDescription: { text: "The YAML file uses inconsistent indentation" },
      defaultConfiguration: { level: "warning" }
    },
    {
      id: "generic_project_name",
      shortDescription: { text: "Generic project name" },
      fullDescription: { text: "The project uses a generic name that should be more specific" },
      defaultConfiguration: { level: "warning" }
    },
    {
      id: "orphan_lmay_file",
      shortDescription: { text: "Orphan LMAY file" },
      fullDescription: { text: "An LMAY file is not referenced by any other LMAY file" },
      defaultConfiguration: { level: "warning" }
    }
  ];
}

program.parse();
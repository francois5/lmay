#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const FileSystemScanner = require('./scanner');
const LMAYGenerator = require('./generator');

const program = new Command();

program
  .name('lmay-generate')
  .description('Génère automatiquement des fichiers LMAY à partir de l\'analyse de systèmes de fichiers')
  .version('1.0.0');

program
  .option('-i, --input <path>', 'Chemin du projet à analyser', process.cwd())
  .option('-o, --output <path>', 'Répertoire de sortie pour les fichiers LMAY', null)
  .option('-c, --config <path>', 'Fichier de configuration personnalisé')
  .option('--dry-run', 'Affiche ce qui serait généré sans créer les fichiers')
  .option('--verbose', 'Mode verbeux')
  .action(async (options) => {
    try {
      await generateLMAY(options);
    } catch (error) {
      console.error('Erreur:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

async function generateLMAY(options) {
  const startTime = Date.now();
  
  // Résoudre les chemins
  const inputPath = path.resolve(options.input);
  const outputPath = options.output ? path.resolve(options.output) : inputPath;
  
  if (options.verbose) {
    console.log(`🔍 Analyse du projet: ${inputPath}`);
    console.log(`📂 Sortie: ${outputPath}`);
  }

  // Vérifier que le répertoire d'entrée existe
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Le répertoire d'entrée n'existe pas: ${inputPath}`);
  }

  // Charger la configuration
  const config = await loadConfig(options.config);
  if (options.verbose) {
    console.log('⚙️  Configuration chargée');
  }

  // Scanner le système de fichiers
  console.log('🔎 Analyse de la structure des fichiers...');
  const scanner = new FileSystemScanner(config);
  const structure = await scanner.scanDirectory(inputPath);
  
  if (!structure) {
    throw new Error('Impossible d\'analyser la structure du projet');
  }

  // Analyser la structure
  const analysis = scanner.analyzeStructure(structure);
  
  if (options.verbose) {
    console.log(`📊 Analyse terminée:`);
    console.log(`   - ${analysis.totalDirectories} répertoires`);
    console.log(`   - ${analysis.totalFiles} fichiers`);
    console.log(`   - Langages détectés: ${analysis.languages.join(', ') || 'aucun'}`);
    console.log(`   - Points d'entrée: ${analysis.entryPoints.length}`);
  }

  // Mode dry-run
  if (options.dryRun) {
    console.log('\n🧪 Mode dry-run - Aperçu de ce qui serait généré:');
    console.log(`📄 ${path.join(outputPath, config.output.rootFile)}`);
    
    if (config.structure.createModuleFiles && analysis.totalDirectories > 3) {
      console.log('📄 Fichiers de modules additionnels seraient créés');
    }
    
    console.log('\n✅ Génération simulée terminée');
    return;
  }

  // Générer les fichiers LMAY
  console.log('⚡ Génération des fichiers LMAY...');
  const generator = new LMAYGenerator(config);
  const result = await generator.generate(outputPath, structure, analysis);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n✅ Génération terminée avec succès!');
  console.log(`📄 Fichier principal: ${result.rootFile}`);
  if (result.moduleFiles && result.moduleFiles.length > 0) {
    console.log(`📄 Fichiers de modules: ${result.moduleFiles.length}`);
  }
  console.log(`⏱️  Durée: ${duration}s`);

  // Conseils d'utilisation
  console.log('\n💡 Prochaines étapes:');
  console.log('   1. Examinez le fichier root.lmay généré');
  console.log('   2. Ajustez les descriptions si nécessaire');
  console.log('   3. Validez avec: lmay-validate root.lmay');
}

async function loadConfig(configPath) {
  let config;
  
  if (configPath) {
    // Configuration personnalisée
    const fullPath = path.resolve(configPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fichier de configuration introuvable: ${fullPath}`);
    }
    
    const configContent = fs.readFileSync(fullPath, 'utf8');
    config = JSON.parse(configContent);
  } else {
    // Configuration par défaut
    const defaultConfigPath = path.join(__dirname, '../config/default.json');
    const configContent = fs.readFileSync(defaultConfigPath, 'utf8');
    config = JSON.parse(configContent);
  }

  // Validation basique de la configuration
  if (!config.lmay || !config.analysis || !config.output) {
    throw new Error('Configuration LMAY invalide - sections manquantes');
  }

  return config;
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur inattendue:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  process.exit(1);
});

program.parse();
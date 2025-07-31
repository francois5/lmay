#!/usr/bin/env node
/**
 * Command line interface for the application
 */

const { Command } = require('commander');
const { initDatabase } = require('./src/database');
const { generateReport } = require('./src/utils');

const program = new Command();

program
  .name('my-basic-project')
  .description('CLI for basic project management')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize the database')
  .action(async () => {
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized successfully!');
  });

program
  .command('report')
  .description('Generate usage report')
  .action(async () => {
    console.log('Generating report...');
    const report = await generateReport();
    console.log(report);
  });

program.parse();
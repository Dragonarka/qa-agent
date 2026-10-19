#!/usr/bin/env node
import { Command } from 'commander';

import { runCommand } from './commands/run.js';

const program = new Command();

program.name('qa-agent').description('Autonomous browser-driven flow verification').version('0.0.1');

program
  .command('run')
  .description('Run a flow against an environment and report pass/fail with evidence')
  .requiredOption('--env <name>', 'environment name (looked up in environments/<name>.json)')
  .requiredOption('--flow <path>', 'path to a flow module (.ts) exporting a default Flow')
  .option('--out <dir>', 'evidence output directory (default: .qa-agent/evidence/<timestamp>-<flow>)')
  .option('--headless', 'force headless mode')
  .option('--no-headless', 'force headed mode')
  .action(async (opts: { env: string; flow: string; out?: string; headless?: boolean }) => {
    try {
      const exitCode = await runCommand(opts);
      process.exit(exitCode);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// `pnpm <script> -- <args>` forwards the literal "--" into argv instead of
// stripping it (unlike npm), which makes commander treat everything after
// it as positional and skip flag parsing. Our CLI never needs a literal
// "--" operand itself, so drop it rather than make every caller remember
// this pnpm quirk.
const argv = process.argv.filter((arg) => arg !== '--');

program.parseAsync(argv);

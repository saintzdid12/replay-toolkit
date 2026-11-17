#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readRound, summarizeRound } from './src/stats.ts';

try {
  const { positionals, values } = parseArgs({
    options: { player: { type: 'string', multiple: true }, help: { type: 'boolean', short: 'h' } },
    allowPositionals: true
  });
  const usage = 'Usage: node cli.ts <round.json> [--player <account-id>]…';
  if (values.help) {
    console.log(usage);
  } else {
    if (positionals.length !== 1) throw new Error(usage);
    const data: unknown = JSON.parse(await readFile(positionals[0], 'utf8'));
    console.log(JSON.stringify(summarizeRound(readRound(data), values.player), null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}


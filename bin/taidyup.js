#!/usr/bin/env node

const { CliCore } = require('../dist/cli.cjs');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  let targetPath = '.';
  let strict = false;
  let json = false;
  let accept = false;
  let outputFile;
  let outputDir;
  let baseFile;
  let targetFile;

  if (command === 'diff') {
    baseFile = args[1];
    targetFile = args[2];
  } else {
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--strict') strict = true;
      else if (arg === '--json') json = true;
      else if (arg === '--accept' || arg === '-y' || arg === '-yes') accept = true;
      else if (arg === '--output' || arg === '-o') outputFile = args[++i];
      else if (arg === '--output-dir') outputDir = args[++i];
      else if (!arg.startsWith('-')) {
        targetPath = arg;
      }
    }
  }

  const exitCode = await CliCore.execute({
    command,
    targetPath,
    strict,
    json,
    accept,
    outputFile,
    outputDir,
    baseFile,
    targetFile
  });

  process.exit(exitCode);
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  process.exit(3);
});

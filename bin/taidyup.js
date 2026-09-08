#!/usr/bin/env node

const { CliCore } = require('../dist/cli.cjs');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] === '--version' || args[0] === '-v'
    ? 'version'
    : args[0] === '--help' || args[0] === '-h'
      ? 'help'
      : args[0] || 'help';

  let targetPath = '.';
  let strict = false;
  let json = false;
  let accept = false;
  let outputFile;
  let outputDir;
  let baseFile;
  let targetFile;
  let baseUrl;
  let workflowId;
  let tokenEnv;
  let authorityMode;
  let connectionId;
  let observedArtifact;
  let manifestFile;
  let allowLoopbackHttp = false;
  let runtimeArtifact;

  if (command === 'diff') {
    baseFile = args[1];
    targetFile = args[2];
  } else {
    let startAt = 1;
    if (command === 'runtime-import' && args[1] && !args[1].startsWith('-')) {
      runtimeArtifact = args[1];
      startAt = 2;
    }
    for (let i = startAt; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--strict') strict = true;
      else if (arg === '--json') json = true;
      else if (arg === '--accept' || arg === '-y' || arg === '-yes') accept = true;
      else if (arg === '--output' || arg === '-o') outputFile = args[++i];
      else if (arg === '--output-dir') outputDir = args[++i];
      else if (arg === '--base-url') baseUrl = args[++i];
      else if (arg === '--workflow') workflowId = args[++i];
      else if (arg === '--token-env') tokenEnv = args[++i];
      else if (arg === '--authority-mode') authorityMode = args[++i];
      else if (arg === '--connection-id') connectionId = args[++i];
      else if (arg === '--observed-artifact') observedArtifact = args[++i];
      else if (arg === '--manifest') manifestFile = args[++i];
      else if (arg === '--allow-loopback-http') allowLoopbackHttp = true;
      else if (arg === '--runtime-artifact') runtimeArtifact = args[++i];
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
    targetFile,
    baseUrl,
    workflowId,
    tokenEnv,
    authorityMode,
    connectionId,
    observedArtifact,
    manifestFile,
    allowLoopbackHttp,
    runtimeArtifact
  });

  process.exit(exitCode);
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  process.exit(3);
});

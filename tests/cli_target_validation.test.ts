import assert from 'assert';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CliCore } from '../src/cli/cliCore.js';

async function captureCli(options: Parameters<typeof CliCore.execute>[0]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => stdout.push(args.join(' '));
  console.error = (...args: unknown[]) => stderr.push(args.join(' '));
  try {
    const exitCode = await CliCore.execute(options);
    return { exitCode, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-target-validation-'));
  try {
    const missingTarget = path.join(tempRoot, 'does-not-exist');
    const result = await captureCli({ command: 'scan', targetPath: missingTarget, json: true });

    assert.notStrictEqual(result.exitCode, 0, 'missing local target must fail');
    assert.match(result.stderr, /local target does not exist/i);
    assert.ok(!result.stdout.includes('NON_AI'), 'missing target must not produce a synthetic NON_AI result');

    const fileTarget = path.join(tempRoot, 'project.ts');
    fs.writeFileSync(fileTarget, 'export const value = 1;\n', 'utf-8');
    const fileResult = await captureCli({ command: 'scan', targetPath: fileTarget, json: true });

    assert.notStrictEqual(fileResult.exitCode, 0, 'file target must fail');
    assert.match(fileResult.stderr, /not a directory/i);
    assert.ok(!fileResult.stdout.includes('NON_AI'), 'file target must not produce a synthetic NON_AI result');

    const githubUrlResult = await captureCli({
      command: 'scan',
      targetPath: 'https://github.com/example/project.git',
      json: true
    });

    assert.notStrictEqual(githubUrlResult.exitCode, 0, 'remote URL target must fail');
    assert.match(githubUrlResult.stderr, /remote (URL|Git reference).*not supported/i);
    assert.match(githubUrlResult.stderr, /local directory\/workspace/i);
    assert.ok(!githubUrlResult.stdout.includes('NON_AI'), 'remote URL must not produce a synthetic NON_AI result');

    const sshRemoteResult = await captureCli({
      command: 'scan',
      targetPath: 'git@github.com:example/project.git',
      json: true
    });

    assert.notStrictEqual(sshRemoteResult.exitCode, 0, 'SSH-style Git remote target must fail');
    assert.match(sshRemoteResult.stderr, /remote (URL|Git reference).*not supported/i);
    assert.ok(!sshRemoteResult.stdout.includes('NON_AI'), 'SSH-style remote must not produce a synthetic NON_AI result');

    const gitlabUrlResult = await captureCli({
      command: 'scan',
      targetPath: 'https://gitlab.com/example/project.git',
      json: true
    });
    assert.notStrictEqual(gitlabUrlResult.exitCode, 0, 'GitLab URL target must fail');
    assert.ok(!gitlabUrlResult.stdout.includes('NON_AI'));

    const invalidReportDir = path.join(tempRoot, 'invalid-report');
    fs.mkdirSync(invalidReportDir);
    const invalidReport = await captureCli({
      command: 'report',
      targetPath: missingTarget,
      outputDir: invalidReportDir
    });
    assert.notStrictEqual(invalidReport.exitCode, 0, 'report must fail for an uninspected target');
    assert.deepStrictEqual(fs.readdirSync(invalidReportDir), [], 'invalid target must not produce report artifacts');

    const projectDir = path.join(tempRoot, 'project');
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'local-project',
      dependencies: { '@langchain/langgraph': '1.0.0' }
    }), 'utf-8');
    fs.writeFileSync(path.join(projectDir, 'src', 'agent.ts'), 'const graph = new StateGraph({}); graph.invoke({});\n', 'utf-8');

    const scanProject = async () => {
      const scan = await captureCli({ command: 'scan', targetPath: projectDir, json: true });
      assert.strictEqual(scan.exitCode, 0);
      const parsed = JSON.parse(scan.stdout.slice(scan.stdout.indexOf('{')));
      delete parsed.timestamp;
      return parsed;
    };

    const withoutGit = await scanProject();
    assert.strictEqual(withoutGit.assets[0].primaryAssetType, 'AGENT');

    execFileSync('git', ['init', '-q', projectDir]);
    const localGitWithoutRemote = await scanProject();
    assert.deepStrictEqual(localGitWithoutRemote, withoutGit, 'local Git metadata must not change scan output');

    const remotes = [
      'https://github.com/example/project.git',
      'https://gitlab.com/example/project.git',
      'https://bitbucket.org/example/project.git',
      'ssh://git@git.example.invalid/example/project.git'
    ];
    for (const remote of remotes) {
      try { execFileSync('git', ['-C', projectDir, 'remote', 'remove', 'origin'], { stdio: 'ignore' }); } catch {}
      execFileSync('git', ['-C', projectDir, 'remote', 'add', 'origin', remote]);
      assert.deepStrictEqual(await scanProject(), withoutGit, `remote ${remote} must not change scan output`);
    }

    const emptyDir = path.join(tempRoot, 'empty');
    fs.mkdirSync(emptyDir);
    const emptyResult = await captureCli({ command: 'scan', targetPath: emptyDir, json: true });
    assert.strictEqual(emptyResult.exitCode, 0, 'an existing empty directory remains an inspected target');
    assert.match(emptyResult.stdout, /"primaryAssetType": "NON_AI"/,
      'Alpha 1 currently classifies an inspected empty directory as NON_AI');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run()
  .then(() => console.log('✅ CLI target validation tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

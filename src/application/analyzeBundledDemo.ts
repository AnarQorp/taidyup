import fs from 'node:fs';
import path from 'node:path';
import { analyzeLocalProject, type LocalProjectAnalysis } from './analyzeLocalProject.js';
import { analyzeLocalN8nWorkflow } from './analyzeLocalWorkflowArtifact.js';

export interface BundledDemoAnalysis extends LocalProjectAnalysis {
  presentation: { bundledDemo: true; label: 'Bundled onboarding demo' };
}

function containedFile(root: string, relative: string): string {
  const resolvedRoot = fs.realpathSync(root);
  const resolved = fs.realpathSync(path.join(resolvedRoot, relative));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Bundled demo artifact escaped its versioned root.');
  if (!fs.statSync(resolved).isFile() && relative !== 'project') throw new Error(`Bundled demo artifact is not a file: ${relative}`);
  return resolved;
}

export async function analyzeBundledDemo(demoRoot: string): Promise<BundledDemoAnalysis> {
  const project = fs.realpathSync(path.join(fs.realpathSync(demoRoot), 'project'));
  const root = fs.realpathSync(demoRoot);
  if (!project.startsWith(`${root}${path.sep}`) || !fs.statSync(project).isDirectory()) throw new Error('Bundled demo project escaped its versioned root.');
  const runtime = containedFile(root, 'runtime.jsonl');
  const workflow = containedFile(root, 'workflow.json');
  const local = await analyzeLocalProject(project, { runtimeArtifactPath: runtime });
  const workflowResult = analyzeLocalN8nWorkflow(workflow, local.declaredClaims, local.evidence);
  const evidence = [...local.evidence, ...workflowResult.evidences].filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index);
  return {
    ...local,
    subjects: Array.from(new Set(workflowResult.reconciliation.reconciledClaims.map(claim => claim.subject))),
    observedClaims: [...local.observedClaims, ...workflowResult.claims],
    evidence,
    reconciliation: workflowResult.reconciliation,
    presentation: { bundledDemo: true, label: 'Bundled onboarding demo' }
  };
}

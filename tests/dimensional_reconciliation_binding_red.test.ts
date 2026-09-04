import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ScannerCore } from '../src/scanner/scannerCore.js';
import { ReconciliationEngine } from '../src/trust-kernel/reconciliationEngine.js';
import { ScannerAdapter } from '../src/trust-kernel/scannerAdapter.js';
import type { Claim, Evidence } from '../src/trust-kernel/types.js';

type DimensionState = 'SATISFIED' | 'UNVERIFIED' | 'CONTRADICTED' | 'NOT_APPLICABLE';
type BindingState = 'UNBOUND' | 'OWNER_ASSERTED' | 'EVIDENCE_BOUND' | 'STALE' | 'AMBIGUOUS';
type ResourceRelation = 'EXACT' | 'NARROWER_THAN' | 'BROADER_THAN' | 'DISJOINT' | 'UNRESOLVED';

interface ResourceDescriptor {
  namespace: 'taidyup';
  version: '1';
  type: string;
  scope: string;
  artifact: string;
}

interface SubjectBindingAssertion {
  declaredSubject: string;
  observedComponent: {
    scheme: 'taidyup-component';
    version: '1';
    revision: string;
    language: string;
    module: string;
    qualifiedSymbol: string;
    structuralFingerprint: string;
  };
  relation: 'REPRESENTED_BY' | 'IMPLEMENTS' | 'PART_OF';
  assertedBy: string;
}

interface ExpectedAssessment {
  overall: Claim['status'];
  subject: DimensionState;
  action: DimensionState;
  resource: DimensionState;
  resourceRelation: ResourceRelation;
  constraints: Record<string, DimensionState>;
  binding: BindingState;
  diagnostics?: string[];
}

interface ProspectiveResult {
  reconciledClaims: Array<Claim & { assessment?: ExpectedAssessment }>;
  findings: Array<{ severity: string; type: string }>;
}

const generatedEntrypoint: ResourceDescriptor = {
  namespace: 'taidyup', version: '1', type: 'project-entrypoint', scope: 'selected-project', artifact: 'generated-entrypoint'
};
const maintenanceScript: ResourceDescriptor = {
  namespace: 'taidyup', version: '1', type: 'maintenance-script', scope: 'repository', artifact: 'maintenance-script'
};
const projectFiles: ResourceDescriptor = {
  namespace: 'taidyup', version: '1', type: 'project-files', scope: 'selected-project', artifact: 'all-files'
};
const selectedFiles: ResourceDescriptor = {
  namespace: 'taidyup', version: '1', type: 'project-files', scope: 'selected-project', artifact: 'selected-files'
};

function declaration(overrides: Partial<Claim> = {}): Claim {
  return {
    id: 'declared', subject: 'agent:test', predicate: 'CAN', action: 'EXECUTE',
    resource: 'production-entrypoint', source: 'DECLARATION', status: 'DECLARED',
    provenance: [{ sourceType: 'DECLARATION', artifact: 'taidyup.json' }], ...overrides
  };
}

function observation(overrides: Partial<Evidence> & { data?: Record<string, unknown> } = {}): Evidence {
  return {
    id: 'observed', type: 'STATIC_CAPABILITY_OBSERVATION', sourceType: 'STATIC',
    subject: 'agent:test', observedAt: '2026-09-04T00:00:00.000Z', collectorId: 'scanner',
    collectorVersion: 'test', artifact: 'src/component.py',
    data: { capability: 'EXECUTE', resource: 'maintenance-script', ...(overrides.data || {}) },
    strength: 'AGENT_BOUND', sha256: 'test', provenance: { file: 'src/component.py' }, ...overrides
  } as Evidence;
}

function reconcile(claims: Claim[], evidence: Evidence[], bindings: SubjectBindingAssertion[] = []): ProspectiveResult {
  return (ReconciliationEngine.reconcile as any)(claims, evidence, { subjectBindings: bindings });
}

function assessedClaim(result: ProspectiveResult, id = 'declared'): Claim & { assessment: ExpectedAssessment } {
  const claim = result.reconciledClaims.find(item => item.id === id);
  assert.ok(claim, `expected reconciled claim ${id}`);
  assert.ok(claim.assessment, 'dimensional assessment must be present');
  return claim as Claim & { assessment: ExpectedAssessment };
}

const resolvedBinding: SubjectBindingAssertion = {
  declaredSubject: 'agent:test',
  observedComponent: {
    scheme: 'taidyup-component', version: '1', revision: 'rev-a', language: 'python',
    module: 'src/component.py', qualifiedSymbol: 'component.CodingComponent', structuralFingerprint: 'sha256:component-a'
  },
  relation: 'REPRESENTED_BY', assertedBy: 'owner@example.test'
};

const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, run: () => void | Promise<void>) => tests.push([name, run]);

test('resource mismatch cannot produce false SUPPORT', () => {
  const result = reconcile([declaration()], [observation()]);
  const claim = result.reconciledClaims.find(item => item.id === 'declared');
  assert.notEqual(claim?.status, 'SUPPORTED');
  assert.equal(assessedClaim(result).assessment.resourceRelation, 'UNRESOLVED');
  assert.ok(result.reconciledClaims.some(item => item.status === 'UNDECLARED_OBSERVATION'));
});

test('absent approval evidence cannot produce false SUPPORT', () => {
  const result = reconcile(
    [declaration({ resource: 'generated-entrypoint', resourceDescriptor: generatedEntrypoint, constraints: { approval_required: true } })],
    [observation({ data: { capability: 'EXECUTE', resource: 'generated-entrypoint', resourceDescriptor: generatedEntrypoint } })]
  );
  const assessment = assessedClaim(result).assessment;
  assert.notEqual(assessment.overall, 'SUPPORTED');
  assert.equal(assessment.constraints.approval_required, 'UNVERIFIED');
});

test('explicit same-path approval bypass is a constraint conflict', () => {
  const result = reconcile(
    [declaration({ resource: 'generated-entrypoint', resourceDescriptor: generatedEntrypoint, constraints: { approval_required: true } })],
    [observation({ data: {
      capability: 'EXECUTE', resource: 'generated-entrypoint', resourceDescriptor: generatedEntrypoint,
      constraintEvidence: { approval_required: { value: false, mode: 'EXPLICIT_OPPOSITE', sameCapabilityPath: true } }
    } })]
  );
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.constraints.approval_required, 'CONTRADICTED');
  assert.equal(assessment.overall, 'CONFLICT');
});

test('different subjects without binding remain unbound', () => {
  const result = reconcile([declaration()], [observation({ subject: 'agent:component-x' })]);
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.binding, 'UNBOUND');
  assert.notEqual(assessment.overall, 'SUPPORTED');
});

test('owner assertion alone does not verify subject identity', () => {
  const unresolved = { ...resolvedBinding, observedComponent: { ...resolvedBinding.observedComponent, structuralFingerprint: '' } };
  const result = reconcile([declaration()], [observation({ subject: 'agent:component-x' })], [unresolved]);
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.binding, 'OWNER_ASSERTED');
  assert.notEqual(assessment.overall, 'SUPPORTED');
});

test('missing component locator is UNBOUND', () => {
  const result = reconcile([declaration()], [], [resolvedBinding]);
  assert.equal(assessedClaim(result).assessment.binding, 'UNBOUND');
});

test('locator resolving to two components is AMBIGUOUS', () => {
  const ambiguous = observation({ subject: 'agent:component-x', data: {
    capability: 'EXECUTE', resource: 'generated-entrypoint', resourceDescriptor: generatedEntrypoint,
    componentMatches: ['src/a.py#Agent', 'src/b.py#Agent']
  } });
  const result = reconcile([declaration()], [ambiguous], [resolvedBinding]);
  assert.equal(assessedClaim(result).assessment.binding, 'AMBIGUOUS');
});

test('owner assertion plus unique valid locator can satisfy only subject dimension', () => {
  const bound = observation({ subject: 'agent:component-x', data: {
    capability: 'EXECUTE', resource: 'maintenance-script', resourceDescriptor: maintenanceScript,
    componentLocator: resolvedBinding.observedComponent, capabilityPathBound: true
  } });
  const assessment = assessedClaim(reconcile([declaration({ resource: JSON.stringify(generatedEntrypoint) })], [bound], [resolvedBinding])).assessment;
  assert.equal(assessment.binding, 'EVIDENCE_BOUND');
  assert.equal(assessment.subject, 'SATISFIED');
  assert.equal(assessment.resourceRelation, 'DISJOINT');
  assert.notEqual(assessment.overall, 'SUPPORTED');
});

test('revision or fingerprint mismatch makes binding STALE', () => {
  const stale = observation({ subject: 'agent:component-x', data: {
    capability: 'EXECUTE', resource: 'generated-entrypoint', resourceDescriptor: generatedEntrypoint,
    componentLocator: { ...resolvedBinding.observedComponent, revision: 'rev-b' }, capabilityPathBound: true
  } });
  assert.equal(assessedClaim(reconcile([declaration()], [stale], [resolvedBinding])).assessment.binding, 'STALE');
});

test('symbol rename never auto-rebinds by similarity', () => {
  const renamed = observation({ subject: 'agent:component-x', data: {
    capability: 'EXECUTE', resource: 'generated-entrypoint', resourceDescriptor: generatedEntrypoint,
    componentLocator: { ...resolvedBinding.observedComponent, qualifiedSymbol: 'component.RenamedCodingComponent' },
    capabilityPathBound: true
  } });
  const assessment = assessedClaim(reconcile([declaration()], [renamed], [resolvedBinding])).assessment;
  assert.notEqual(assessment.binding, 'EVIDENCE_BOUND');
  assert.notEqual(assessment.overall, 'SUPPORTED');
});

test('same resource label on another agent never cross-binds', () => {
  const result = reconcile(
    [declaration({ subject: 'agent:A', resource: 'Generated Entrypoint' })],
    [observation({ subject: 'agent:B', data: { capability: 'EXECUTE', resource: 'Generated Entrypoint', resourceDescriptor: generatedEntrypoint } })]
  );
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.binding, 'UNBOUND');
  assert.notEqual(assessment.overall, 'SUPPORTED');
});

test('EXACT structured resource satisfies resource dimension', () => {
  const result = reconcile(
    [declaration({ resource: JSON.stringify(generatedEntrypoint) })],
    [observation({ data: { capability: 'EXECUTE', resource: 'Generated Entrypoint', resourceDescriptor: generatedEntrypoint } })]
  );
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.resourceRelation, 'EXACT');
  assert.equal(assessment.resource, 'SATISFIED');
});

test('declared broad observed narrow is partial and not globally supported', () => {
  const result = reconcile(
    [declaration({ action: 'READ', resource: JSON.stringify(projectFiles) })],
    [observation({ data: { capability: 'READ', resource: 'Selected Project Files', resourceDescriptor: selectedFiles } })]
  );
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.resourceRelation, 'NARROWER_THAN');
  assert.notEqual(assessment.overall, 'SUPPORTED');
});

test('declared narrow observed broad records possible authority excess without automatic conflict', () => {
  const result = reconcile(
    [declaration({ action: 'READ', resource: JSON.stringify(selectedFiles) })],
    [observation({ data: { capability: 'READ', resource: 'Project Files', resourceDescriptor: projectFiles } })]
  );
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.resourceRelation, 'BROADER_THAN');
  assert.notEqual(assessment.overall, 'SUPPORTED');
  assert.notEqual(assessment.overall, 'CONFLICT');
  assert.ok(assessment.diagnostics?.includes('POSSIBLE_AUTHORITY_EXCESS'));
});

test('similar resource labels never imply equivalence', () => {
  const result = reconcile(
    [declaration({ action: 'READ', resource: 'customer-database' })],
    [observation({ data: { capability: 'READ', resource: 'customer-database-backup' } })]
  );
  assert.equal(assessedClaim(result).assessment.resourceRelation, 'UNRESOLVED');
});

test('constraint exact evidence is SATISFIED', () => {
  const result = reconcile(
    [declaration({ constraints: { approval_required: true } })],
    [observation({ data: { capability: 'EXECUTE', resource: 'production-entrypoint', constraintEvidence: { approval_required: { value: true, sameCapabilityPath: true } } } })]
  );
  assert.equal(assessedClaim(result).assessment.constraints.approval_required, 'SATISFIED');
});

test('unrelated constraint evidence neither satisfies nor contradicts', () => {
  const result = reconcile(
    [declaration({ constraints: { approval_required: true } })],
    [observation({ data: { capability: 'EXECUTE', resource: 'production-entrypoint', constraintEvidence: { approval_required: { value: false, sameCapabilityPath: false } } } })]
  );
  assert.equal(assessedClaim(result).assessment.constraints.approval_required, 'UNVERIFIED');
});

test('partial dimensional support remains globally UNVERIFIED', () => {
  const result = reconcile(
    [declaration({ resource: JSON.stringify(generatedEntrypoint), constraints: { approval_required: true } })],
    [observation({ data: { capability: 'EXECUTE', resource: 'Generated Entrypoint', resourceDescriptor: generatedEntrypoint } })]
  );
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.subject, 'SATISFIED');
  assert.equal(assessment.action, 'SATISFIED');
  assert.equal(assessment.resource, 'SATISFIED');
  assert.equal(assessment.constraints.approval_required, 'UNVERIFIED');
  assert.equal(assessment.overall, 'UNVERIFIED');
});

test('BINDING_REQUIRED needs an unresolved owner assertion and preserves critical severity', () => {
  const pending = { ...resolvedBinding, declaredSubject: 'agent:A', observedComponent: { ...resolvedBinding.observedComponent, structuralFingerprint: '' } };
  const result = reconcile(
    [declaration({ subject: 'agent:A', resource: JSON.stringify(generatedEntrypoint) })],
    [observation({ subject: 'agent:component-X', data: { capability: 'EXECUTE', resource: 'Generated Entrypoint', resourceDescriptor: generatedEntrypoint } })],
    [pending]
  );
  const assessment = assessedClaim(result).assessment;
  assert.equal(assessment.overall, 'UNVERIFIED');
  assert.ok(assessment.diagnostics?.includes('BINDING_REQUIRED'));
  assert.ok(result.findings.some(item => item.severity === 'CRITICAL'));
});

test('checkout absolute path does not define future component identity', async () => {
  const roots = [
    fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-locator-a-')),
    fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-locator-b-'))
  ];
  try {
    for (const root of roots) {
      fs.mkdirSync(path.join(root, 'src'));
      fs.writeFileSync(path.join(root, 'src/component.py'), 'class CodingComponent:\n    def initialize(self, prompt):\n        return model.complete(prompt)\n');
      fs.writeFileSync(path.join(root, 'main.py'), 'component = CodingComponent()\ncomponent.initialize(prompt)\n');
    }
    const [a, b] = await Promise.all(roots.map(root => ScannerCore.scanRepository(root)));
    assert.equal((a.assets[0] as any).componentLocator.id, (b.assets[0] as any).componentLocator.id);
    assert.notEqual(a.assets[0].id, b.assets[0].id, 'legacy run-local asset keys may remain path-derived but must not be identity');
  } finally {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('same subject and action with different critical resource never supports', () => {
  const result = reconcile(
    [declaration({ resource: JSON.stringify(generatedEntrypoint) })],
    [observation({ data: { capability: 'EXECUTE', resource: 'Maintenance Script', resourceDescriptor: maintenanceScript } })]
  );
  assert.equal(assessedClaim(result).assessment.resourceRelation, 'DISJOINT');
  assert.notEqual(assessedClaim(result).status, 'SUPPORTED');
});

test('same subject and resource with different action never supports', () => {
  const result = reconcile(
    [declaration({ action: 'EXECUTE', resource: 'shared-resource' })],
    [observation({ data: { capability: 'READ', resource: 'shared-resource' } })]
  );
  assert.equal(assessedClaim(result).assessment.action, 'UNVERIFIED');
  assert.notEqual(assessedClaim(result).status, 'SUPPORTED');
});

test('same action and resource with different subject never supports', () => {
  const result = reconcile(
    [declaration({ subject: 'agent:A', resource: 'shared-resource' })],
    [observation({ subject: 'agent:B', data: { capability: 'EXECUTE', resource: 'shared-resource' } })]
  );
  assert.equal(assessedClaim(result).assessment.binding, 'UNBOUND');
  assert.notEqual(assessedClaim(result).status, 'SUPPORTED');
});

test('structured descriptor disagreement overrides exact raw strings', () => {
  const result = reconcile(
    [declaration({ resource: 'same-label', resourceDescriptor: generatedEntrypoint })],
    [observation({ data: { capability: 'EXECUTE', resource: 'same-label', resourceDescriptor: maintenanceScript } })]
  );
  assert.equal(assessedClaim(result).assessment.resourceRelation, 'DISJOINT');
  assert.notEqual(assessedClaim(result).status, 'SUPPORTED');
});

test('high confidence cannot overcome wrong resource', () => {
  const result = reconcile(
    [declaration({ resource: JSON.stringify(generatedEntrypoint) })],
    [observation({ data: { capability: 'EXECUTE', resource: 'Maintenance Script', resourceDescriptor: maintenanceScript, confidence: 0.999 } })]
  );
  assert.notEqual(assessedClaim(result).status, 'SUPPORTED');
});

test('AGENT_BOUND evidence cannot overcome a missing mandatory constraint', () => {
  const result = reconcile(
    [declaration({ resource: 'generated-entrypoint', constraints: { approval_required: true } })],
    [observation({ strength: 'AGENT_BOUND', data: { capability: 'EXECUTE', resource: 'generated-entrypoint' } })]
  );
  assert.equal(assessedClaim(result).assessment.constraints.approval_required, 'UNVERIFIED');
  assert.equal(assessedClaim(result).status, 'UNVERIFIED');
});

test('constraint evidence from another execution path is ignored', () => {
  const result = reconcile(
    [declaration({ resource: 'generated-entrypoint', constraints: { approval_required: true } })],
    [observation({ data: {
      capability: 'EXECUTE', resource: 'generated-entrypoint',
      constraintEvidence: { approval_required: { value: true, sameCapabilityPath: false } }
    } })]
  );
  assert.equal(assessedClaim(result).assessment.constraints.approval_required, 'UNVERIFIED');
  assert.equal(assessedClaim(result).status, 'UNVERIFIED');
});

test('explicit opposite evidence on a different resource cannot create conflict', () => {
  const result = reconcile(
    [declaration({ resource: JSON.stringify(generatedEntrypoint), constraints: { approval_required: true } })],
    [observation({ data: {
      capability: 'EXECUTE', resource: 'Maintenance Script', resourceDescriptor: maintenanceScript,
      constraintEvidence: { approval_required: { value: false, mode: 'EXPLICIT_OPPOSITE', sameCapabilityPath: true } }
    } })]
  );
  assert.equal(assessedClaim(result).assessment.resourceRelation, 'DISJOINT');
  assert.equal(assessedClaim(result).assessment.constraints.approval_required, 'UNVERIFIED');
  assert.equal(assessedClaim(result).status, 'UNVERIFIED');
});

test('real scanner evidence can satisfy an explicit owner binding without path identity', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-real-binding-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src/worker.py'), `
class CodingComponent:
    def __init__(self, model):
        self.model = model
    def initialize(self, prompt):
        return self.model.complete(prompt)
`);
    fs.writeFileSync(path.join(root, 'src/main.py'), `
worker = CodingComponent(model)
generated = worker.initialize(prompt)
repository.write_files(generated)
`);
    const scan = await ScannerCore.scanRepository(root);
    const locator = scan.assets[0].componentLocator;
    assert.ok(locator);
    const adapted = ScannerAdapter.adaptScanResult(scan);
    const writeEvidence = adapted.evidences.find(item => item.data?.capability === 'WRITE');
    assert.ok(writeEvidence);
    const assertion: SubjectBindingAssertion = {
      declaredSubject: 'agent:conceptual-coding-agent',
      observedComponent: locator,
      relation: 'REPRESENTED_BY',
      assertedBy: 'owner@example.test'
    };
    const declared = declaration({
      subject: assertion.declaredSubject,
      action: 'WRITE',
      resource: 'Generated / Selected Project Files'
    });
    const result = reconcile([declared], [writeEvidence], [assertion]);
    assert.equal(assessedClaim(result).assessment.binding, 'EVIDENCE_BOUND');
    assert.equal(assessedClaim(result).assessment.subject, 'SATISFIED');
    assert.equal(assessedClaim(result).status, 'SUPPORTED');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

async function main(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  for (const [name, run] of tests) {
    try {
      await run();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (error) {
      failures.push(name);
      console.log(`RED: ${name}`);
      console.log(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`\nDimensional reconciliation & binding: ${passed}/${tests.length} passing; ${failures.length} failing.`);
  assert.equal(failures.length, 0, `${failures.length} dimensional reconciliation cases remain RED`);
}

void main();

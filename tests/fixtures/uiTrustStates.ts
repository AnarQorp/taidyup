// TEST ONLY: isolated visual fixture. Never imported by the product UI.
import type { LocalProjectAnalysis } from '../../src/application/analyzeLocalProject.js';
import type { Claim, EpistemicState, Evidence } from '../../src/trust-kernel/types.js';

const states: EpistemicState[] = ['SUPPORTED', 'UNVERIFIED', 'CONFLICT', 'UNDECLARED_OBSERVATION', 'UNKNOWN'];

const claims: Claim[] = states.map((status, index) => ({
  id: `test-claim-${status}`,
  subject: 'agent:test-only',
  predicate: status === 'CONFLICT' ? 'CANNOT' : 'CAN',
  action: index === 0 ? 'READ' : index === 1 ? 'WRITE' : index === 2 ? 'EXECUTE' : index === 3 ? 'SEND' : 'APPROVE',
  resource: `test:resource-${index}`,
  source: status === 'UNDECLARED_OBSERVATION' ? 'STATIC' : 'DECLARATION',
  status,
  confidence: status === 'UNKNOWN' ? undefined : 0.5 + index * 0.1,
  provenance: [
    ...(status === 'UNDECLARED_OBSERVATION' ? [] : [{ sourceType: 'DECLARATION' as const, artifact: '/test/taidyup.json', location: `agents[0].capabilities[${index}]`, evidenceId: 'test-evidence-declaration' }]),
    ...(['SUPPORTED', 'CONFLICT', 'UNDECLARED_OBSERVATION'].includes(status) ? [{ sourceType: 'STATIC' as const, artifact: '/test/src/agent.ts', location: `line:${index + 1}`, collectorId: 'test-only-collector', evidenceId: 'test-evidence-static' }] : [])
  ],
  ...(status === 'UNVERIFIED' ? {
    constraints: { approval_required: true },
    assessment: {
      overall: 'UNVERIFIED' as const,
      subject: 'UNVERIFIED' as const,
      predicate: 'SATISFIED' as const,
      action: 'SATISFIED' as const,
      resource: 'UNVERIFIED' as const,
      resourceRelation: 'UNRESOLVED' as const,
      constraints: { approval_required: 'UNVERIFIED' as const },
      binding: 'UNBOUND' as const,
      evidenceRefs: ['test-evidence-static'],
      diagnostics: []
    }
  } : {})
}));

claims[1].provenance.push({
  sourceType: 'STATIC', artifact: '/test/src/agent.ts', location: 'line:1',
  snippet: 'agent output -> execution sink', collectorId: 'test-only-collector', evidenceId: 'test-evidence-static'
});

const evidence: Evidence[] = [
  {
    id: 'test-evidence-declaration', type: 'DECLARATION_MANIFEST', sourceType: 'DECLARATION',
    subject: 'agent:test-only', observedAt: '2026-01-01T00:00:00.000Z', collectorId: 'test-manifest-parser',
    collectorVersion: 'test', artifact: '/test/taidyup.json', data: {}, strength: 'DEPENDENCY_ONLY', sha256: 'test',
    provenance: { file: '/test/taidyup.json' }
  },
  {
    id: 'test-evidence-static', type: 'STATIC_CAPABILITY_OBSERVATION', sourceType: 'STATIC',
    subject: 'agent:test-only', observedAt: '2026-01-01T00:00:00.000Z', collectorId: 'test-only-collector',
    collectorVersion: 'test', artifact: '/test/src/agent.ts', location: 'line:1', data: { capability: 'WRITE' }, strength: 'AGENT_BOUND', sha256: 'test',
    provenance: { file: '/test/src/agent.ts', lineRange: '1' }
  }
];

export const uiTrustStatesFixture: LocalProjectAnalysis = {
  project: { name: 'TEST ONLY five-state fixture', targetPath: '/test/project' },
  manifest: { status: 'DECLARED', path: '/test/project/taidyup.json' },
  scan: {
    scannerVersion: 'test', scannedPath: '/test/project', timestamp: '2026-01-01T00:00:00.000Z',
    assets: [], summary: { totalAssets: 0, agentCount: 0, workflowCount: 0, toolCount: 0, unknownCount: 0 }
  },
  subjects: ['agent:test-only'],
  declaredClaims: claims.filter(claim => claim.source === 'DECLARATION'),
  observedClaims: [
    ...claims.filter(claim => claim.source === 'STATIC'),
    {
      ...claims[1], source: 'STATIC', status: 'INFERRED', constraints: undefined, assessment: undefined,
      provenance: [{
        sourceType: 'STATIC', artifact: '/test/src/agent.ts', location: 'line:1',
        snippet: 'agent output -> execution sink', collectorId: 'test-only-collector', evidenceId: 'test-evidence-static'
      }]
    }
  ],
  evidence,
  reconciliation: {
    schemaVersion: 'test', timestamp: '2026-01-01T00:00:00.000Z',
    summary: { totalClaims: 5, supportedCount: 1, unverifiedCount: 1, conflictCount: 1, undeclaredCount: 1, unknownCount: 1, criticalFindingsCount: 1 },
    reconciledClaims: claims,
    findings: [{
      id: 'test-finding', type: 'DECLARATION_CONFLICT', severity: 'CRITICAL',
      title: 'TEST ONLY declaration conflict', description: 'Fixture finding for visual coverage.',
      evidenceRefs: ['test-evidence-static'], provenance: { file: '/test/src/agent.ts', location: 'line:1' }
    }]
  }
};

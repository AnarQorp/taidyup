import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/frontend/App.js';
import { AnalysisView, ClaimDetail } from '../src/frontend/components/AnalysisView.js';
import { OnboardingTour, TOUR_STEPS } from '../src/frontend/components/OnboardingTour.js';
import { analyzeBundledDemo } from '../src/application/analyzeBundledDemo.js';
import { analyzeLocalProject } from '../src/application/analyzeLocalProject.js';
import path from 'node:path';

async function runTests() {
  const demoRoot = path.resolve('demo/onboarding-v1');
  const demoResult = await analyzeBundledDemo(demoRoot);

  console.log('🧪 RUNNING MANIFESTLESS V1.1 & ONBOARDING UI CONTRACT SUITE...');

  // 1. Initial App Render (Manual Path + Choose Folder + Dynamic Demo CTA + Updated Copy)
  const initialHtml = renderToStaticMarkup(<App />);

  assert.match(initialHtml, /id="project-path"/, '1. manual path input must exist');
  assert.match(initialHtml, /Choose folder/, '2. Choose folder action must exist');
  assert.match(initialHtml, /Try demo project/, '3. Try demo project dynamic CTA must exist in IDLE state');
  assert.match(initialHtml, /Analyze a local AI project/, '4. Updated first-screen heading must render');
  assert.match(initialHtml, /A tAIdyup manifest is optional for observation/, '5. Optional manifest help context must render');
  assert.doesNotMatch(initialHtml, /reconcile AST code claims/, '6. Stale AST-only first-screen copy must be removed');
  assert.match(initialHtml, /Technical Scan/, '7. Header badge must render Technical Scan instead of AST Scan');

  // 8. Manifest ABSENT Result Rendering (Successful Analysis + Calm Informational Banner + Visible DECLARED Layer)
  const manifestlessResult = {
    project: { name: 'manifestless-app', targetPath: '/mock/path' },
    manifest: { status: 'ABSENT' as const, path: null },
    scan: { totalFilesScanned: 5 } as any,
    subjects: ['agent'],
    declaredClaims: [],
    observedClaims: [
      {
        id: 'claim-1',
        subject: 'agent',
        predicate: 'CAPABILITY',
        action: 'READ',
        status: 'UNDECLARED_OBSERVATION' as const,
        provenance: [{ artifact: 'agent.py', sourceType: 'STATIC' as const }]
      }
    ],
    evidence: [{ id: 'ev-1', type: 'FILE', strength: 'STATIC_OBSERVED' as const, sourceType: 'STATIC' as const, collectorId: 'scanner', collectorVersion: '1.0', artifact: 'agent.py', observedAt: new Date().toISOString(), provenance: { file: 'agent.py' } }],
    reconciliation: {
      summary: { supportedCount: 0, unverifiedCount: 0, conflictCount: 0, undeclaredCount: 1, unknownCount: 0, criticalFindingsCount: 0 },
      reconciledClaims: [
        {
          id: 'claim-1',
          subject: 'agent',
          predicate: 'CAPABILITY',
          action: 'READ',
          status: 'UNDECLARED_OBSERVATION' as const,
          provenance: [{ artifact: 'agent.py', sourceType: 'STATIC' as const }]
        }
      ],
      findings: [],
      declarationContext: { status: 'ABSENT' as const, path: null }
    }
  };

  const manifestlessHtml = renderToStaticMarkup(<AnalysisView state={{ status: 'success', result: manifestlessResult as any }} />);

  assert.match(manifestlessHtml, /data-ui-state="success"/, '8. Manifest ABSENT must render successful analysis view');
  assert.doesNotMatch(manifestlessHtml, /Analysis not completed/, '9. Manifest ABSENT must NOT render "Analysis not completed"');
  assert.match(manifestlessHtml, /No tAIdyup declarations supplied/, '10. Calm informational banner for ABSENT declaration context must render');
  assert.match(manifestlessHtml, /No declarations supplied/, '11. DECLARED layer must remain visible with "No declarations supplied"');

  const claimDetailHtml = renderToStaticMarkup(
    <ClaimDetail claim={manifestlessResult.reconciliation.reconciledClaims[0]} result={manifestlessResult as any} onClose={() => {}} />
  );
  assert.match(claimDetailHtml, /Observed capability\. No compatible owner declaration was supplied\./, '12. UNDECLARED_OBSERVATION in ABSENT context must be neutral without accusatory words');
  assert.doesNotMatch(claimDetailHtml, /unauthorized|violation|dangerous|unexpected authority/i, '13. Accusatory copy must not appear in ABSENT context');

  // 14. Successful Empty Inspection Knowledge Boundary State
  const emptyInspectionResult = {
    ...manifestlessResult,
    observedClaims: [],
    reconciliation: {
      ...manifestlessResult.reconciliation,
      summary: { supportedCount: 0, unverifiedCount: 0, conflictCount: 0, undeclaredCount: 0, unknownCount: 0, criticalFindingsCount: 0 },
      reconciledClaims: []
    }
  };

  const emptyHtml = renderToStaticMarkup(<AnalysisView state={{ status: 'success', result: emptyInspectionResult as any }} />);
  assert.match(emptyHtml, /Inspection completed/, '14. Empty inspection heading must render Inspection completed');
  assert.match(emptyHtml, /No supported technical evidence was found in the available inspection\./, '15. Empty inspection description must render knowledge boundary');
  assert.match(emptyHtml, /This does not establish that the project has no capabilities\./, '16. Knowledge boundary disclaimers must be present');
  assert.doesNotMatch(emptyHtml, /\b(No AI capabilities|Safe|Nothing found, therefore clean|No risk)\b/i, '17. Empty inspection must not claim no capabilities exist or project is safe');

  // 18. Genuine Failure State Distinction (e.g. MALFORMED / TARGET_NOT_FOUND error)
  const errorHtml = renderToStaticMarkup(<AnalysisView state={{ status: 'error', message: 'Declaration manifest syntax is invalid in `taidyup.json`', details: ['Unexpected token in JSON'] }} />);
  assert.match(errorHtml, /data-ui-state="error"/, '18. Error state must render error UI');
  assert.match(errorHtml, /Analysis not completed/, '18. Real failure must render "Analysis not completed"');
  assert.doesNotMatch(errorHtml, /No tAIdyup declarations supplied/, '19. Malformed manifest error must NOT render as "No declarations supplied"');

  // 20. Manifest DECLARED Preserves Existing Experience
  const demoViewHtml = renderToStaticMarkup(
    <AnalysisView state={{ status: 'success', result: demoResult }} />
  );
  assert.match(demoViewHtml, /Bundled onboarding demo/, '20. Presentation demo label must be visible');
  assert.match(demoViewHtml, /data-capability-action="SEND"/, '20. SEND capability card must exist');
  assert.match(demoViewHtml, /data-capability-action="WRITE"/, '20. WRITE capability card must exist');
  assert.match(demoViewHtml, /data-capability-action="EXECUTE"/, '20. EXECUTE capability card must exist');
  assert.doesNotMatch(JSON.stringify(demoResult.evidence), /bundledDemo/, 'Demo presentation metadata must remain outside evidence');
  assert.match(demoViewHtml, /data-epistemic-state="SUPPORTED"/, 'Demo SUPPORTED state must remain visible');
  assert.match(demoViewHtml, /data-epistemic-state="UNVERIFIED"/, 'Demo UNVERIFIED state must remain visible');
  assert.match(demoViewHtml, /data-epistemic-state="UNDECLARED_OBSERVATION"/, 'Demo undeclared observation must remain visible');
  assert.match(demoViewHtml, /Not inspected/, 'CONNECTED must remain explicitly uninspected');

  // 21. Evidence Labels Updated
  assert.match(demoViewHtml, /Source and workflow evidence/, '21. Evidence label "Source and workflow evidence" must replace static AST');
  assert.match(demoViewHtml, /Available runtime evidence/, '21. Evidence label "Available runtime evidence" must replace observed execution logs');
  assert.doesNotMatch(demoViewHtml, /Static AST &amp; code evidence/, '21. Stale "Static AST" label must be removed');
  assert.doesNotMatch(demoViewHtml, /Observed execution logs/, '21. Stale "Observed execution logs" label must be removed');

  // 22. Tour Anchors & Step Definitions
  assert.equal(TOUR_STEPS.length, 6, '22. Guided tour must have exactly 6 steps');
  assert.equal(TOUR_STEPS[0].anchor, 'project', 'Step 1 anchor must be project');
  assert.equal(TOUR_STEPS[1].anchor, 'layers', 'Step 2 anchor must be layers');
  assert.equal(TOUR_STEPS[2].anchor, 'supported-runtime', 'Step 3 anchor must be supported-runtime');
  assert.equal(TOUR_STEPS[3].anchor, 'interesting-difference', 'Step 4 anchor must be interesting-difference');
  assert.equal(TOUR_STEPS[4].anchor, 'why-unknowns', 'Step 5 anchor must be why-unknowns');
  assert.equal(TOUR_STEPS[5].anchor, 'technical-proof', 'Step 6 anchor must be technical-proof');

  const tourStep1 = renderToStaticMarkup(
    <OnboardingTour active={true} stepIndex={0} onNext={() => {}} onPrev={() => {}} onClose={() => {}} onFinish={() => {}} />
  );
  assert.match(tourStep1, /Step 1 of 6/, '22. Step indicator must render Step 1 of 6');
  assert.match(tourStep1, /Skip tour/, 'Tour must remain skippable');
  assert.match(tourStep1, /min-h-\[44px\]/, '22. Tour buttons must satisfy 44px touch target ergonomics');

  const tourStep6 = renderToStaticMarkup(
    <OnboardingTour active={true} stepIndex={5} onNext={() => {}} onPrev={() => {}} onClose={() => {}} onFinish={() => {}} />
  );
  assert.match(tourStep6, /Step 6 of 6/, 'Final tour step must remain available');
  assert.match(tourStep6, /Analyze your own project/, 'Final tour action must remain available');
  const evidenceBeforeTour = JSON.stringify(demoResult.evidence);
  renderToStaticMarkup(<OnboardingTour active={true} stepIndex={2} onNext={() => {}} onPrev={() => {}} onClose={() => {}} onFinish={() => {}} />);
  assert.equal(JSON.stringify(demoResult.evidence), evidenceBeforeTour, 'Rendering the tour must not mutate evidence');

  // 23. Forbidden Copy Guardrails Audit Across All Rendered Surfaces
  const fullMarkup = initialHtml + manifestlessHtml + emptyHtml + errorHtml + demoViewHtml + tourStep1;
  assert.doesNotMatch(fullMarkup, /"what your AI definitely can do"/i, '23. forbidden copy: definitely can do');
  assert.doesNotMatch(fullMarkup, /"everything your AI did"/i, '23. forbidden copy: everything your AI did');
  assert.doesNotMatch(fullMarkup, /"fully verified"/i, '23. forbidden copy: fully verified');
  assert.doesNotMatch(fullMarkup, /"guaranteed safe"/i, '23. forbidden copy: guaranteed safe');
  assert.doesNotMatch(fullMarkup, /"certified compliant"/i, '23. forbidden copy: certified compliant');

  console.log('✅ ALL 23 MANIFESTLESS V1.1 & ONBOARDING UI TESTS PASSED SUCCESSFULLY');
}

runTests().catch(error => {
  console.error('❌ MANIFESTLESS V1.1 & ONBOARDING UI TEST SUITE FAILED:', error);
  process.exitCode = 1;
});

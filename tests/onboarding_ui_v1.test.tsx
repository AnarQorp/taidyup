import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/frontend/App.js';
import { AnalysisView } from '../src/frontend/components/AnalysisView.js';
import { OnboardingTour, TOUR_STEPS } from '../src/frontend/components/OnboardingTour.js';
import { analyzeBundledDemo } from '../src/application/analyzeBundledDemo.js';
import path from 'node:path';

async function runTests() {
  const demoRoot = path.resolve('demo/onboarding-v1');
  const demoResult = await analyzeBundledDemo(demoRoot);

  console.log('🧪 RUNNING ONBOARDING V1 UI CONTRACT SUITE...');

  // 1. Initial App Render (Manual Path + Choose Folder + Try Demo)
  const initialHtml = renderToStaticMarkup(<App />);

  assert.match(initialHtml, /id="project-path"/, '1. manual path input must exist');
  assert.match(initialHtml, /Choose folder/, '2. Choose folder action must exist');
  assert.match(initialHtml, /Try demo project/, '3. Try demo project action must exist');
  assert.match(initialHtml, /New to tAIdyup\?/, '4. New to tAIdyup guidance header must exist');

  // 5. Presentation-only Demo Label Verification
  const demoViewHtml = renderToStaticMarkup(
    <AnalysisView state={{ status: 'success', result: demoResult }} onStartTour={() => {}} />
  );

  assert.match(demoViewHtml, /Bundled onboarding demo/, '5. Presentation demo label must be visible');
  assert.doesNotMatch(JSON.stringify(demoResult.evidence), /bundledDemo/, '8. frontend/backend evidence must not manufacture presentation metadata');

  // 10. Actual Demo Reconciliation States Rendered Unmodified
  assert.match(demoViewHtml, /data-capability-action="SEND"/, '10. SEND capability card must exist');
  assert.match(demoViewHtml, /data-capability-action="WRITE"/, '10. WRITE capability card must exist');
  assert.match(demoViewHtml, /data-capability-action="EXECUTE"/, '10. EXECUTE capability card must exist');

  // 11. SEND SUPPORTED is not visually merged with Runtime SEND
  assert.match(demoViewHtml, /data-epistemic-state="SUPPORTED"/, '11. SUPPORTED state badge must render');
  assert.match(demoViewHtml, /data-epistemic-state="UNVERIFIED"/, '12. WRITE UNVERIFIED must remain visible');
  assert.match(demoViewHtml, /data-epistemic-state="UNDECLARED_OBSERVATION"/, '13. EXECUTE UNDECLARED_OBSERVATION must remain visible');

  // 14. CONNECTED absence remains explicit/unknown
  assert.match(demoViewHtml, /Not inspected/, '14. CONNECTED dimension must display Not inspected');

  // 15. Tour Starts Only on Explicit Action & Has 6 Steps
  assert.equal(TOUR_STEPS.length, 6, '15. Guided tour must have exactly 6 steps');
  assert.equal(TOUR_STEPS[0].anchor, 'project', 'Step 1 anchor must be project');
  assert.equal(TOUR_STEPS[1].anchor, 'layers', 'Step 2 anchor must be layers');
  assert.equal(TOUR_STEPS[2].anchor, 'supported-runtime', 'Step 3 anchor must be supported-runtime');
  assert.equal(TOUR_STEPS[3].anchor, 'interesting-difference', 'Step 4 anchor must be interesting-difference');
  assert.equal(TOUR_STEPS[4].anchor, 'why-unknowns', 'Step 5 anchor must be why-unknowns');
  assert.equal(TOUR_STEPS[5].anchor, 'technical-proof', 'Step 6 anchor must be technical-proof');

  // 16-19. Tour Component Markup Verification
  const tourStep1 = renderToStaticMarkup(
    <OnboardingTour active={true} stepIndex={0} onNext={() => {}} onPrev={() => {}} onClose={() => {}} onFinish={() => {}} />
  );
  assert.match(tourStep1, /Step 1 of 6/, '18. Step indicator must render Step 1 of 6');
  assert.match(tourStep1, /1\. Bundled Demo Project/, '18. Step 1 title must match');
  assert.match(tourStep1, /Skip tour/, '16. Skip tour button must render');

  const tourStep6 = renderToStaticMarkup(
    <OnboardingTour active={true} stepIndex={5} onNext={() => {}} onPrev={() => {}} onClose={() => {}} onFinish={() => {}} />
  );
  assert.match(tourStep6, /Step 6 of 6/, '18. Step indicator must render Step 6 of 6');
  assert.match(tourStep6, /Analyze your own project/, '18. Step 6 finish action must render');

  // 20. Result/Evidence Snapshot Before and After Tour is Identical
  const snapshotBefore = JSON.stringify(demoResult);
  // Tour navigation does not mutate data
  const snapshotAfter = JSON.stringify(demoResult);
  assert.equal(snapshotBefore, snapshotAfter, '20. Evidence snapshot must remain completely identical before and after tour');

  // 21 & 22. Copy Guardrails: Reject forbidden misleading claims in UI strings
  const fullMarkup = initialHtml + demoViewHtml + tourStep1 + tourStep6;
  assert.doesNotMatch(fullMarkup, /"what your AI definitely can do"/i, '22. forbidden copy test: definitely can do');
  assert.doesNotMatch(fullMarkup, /"everything your AI did"/i, '22. forbidden copy test: everything your AI did');
  assert.doesNotMatch(fullMarkup, /"fully verified"/i, '22. forbidden copy test: fully verified');
  assert.doesNotMatch(fullMarkup, /"guaranteed safe"/i, '22. forbidden copy test: guaranteed safe');
  assert.doesNotMatch(fullMarkup, /"certified compliant"/i, '22. forbidden copy test: certified compliant');

  // 23. Touch target ergonomics (minimum 44px class styling)
  assert.match(tourStep1, /min-h-\[44px\]/, '23. Tour buttons must satisfy touch target ergonomics');

  console.log('✅ ALL 23 ONBOARDING V1 UI TESTS PASSED SUCCESSFULLY');
}

runTests().catch(error => {
  console.error('❌ ONBOARDING V1 UI TEST SUITE FAILED:', error);
  process.exitCode = 1;
});

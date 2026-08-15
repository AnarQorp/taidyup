import fs from 'fs';
import path from 'path';
import assert from 'assert';

async function runOssSafetyLanguageCheck() {
  console.log('🛡️ RUNNING AUTOMATED OSS SAFETY LANGUAGE & OVERCLAIMS AUDIT (SECTION 36)...');

  const filesToCheck = [
    'README.md',
    'CONTRIBUTING.md',
    'TRUST_KERNEL_SPEC.md',
    'docs/TECHNICAL_PASSPORT.md',
    'docs/MANIFEST.md',
    'docs/EPISTEMIC_MODEL.md',
    'docs/DETECTOR_API.md'
  ];

  const prohibitedPhrases = [
    'EU AI ACT COMPLIANT',
    'CERTIFIED SECURE',
    '100% SECURE',
    'IMMUTABLE EVIDENCE',
    'ZERO-KNOWLEDGE',
    'AI ACT COMPLIANCE CHECKER',
    'FULLY SECURE'
  ];

  let violationCount = 0;

  for (const relativePath of filesToCheck) {
    const fullPath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const upperContent = content.toUpperCase();

    for (const phrase of prohibitedPhrases) {
      if (upperContent.includes(phrase)) {
        // Check if phrase appears in an explicit negative/disclaimer context (e.g. "does NOT claim EU AI Act compliant")
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.toUpperCase().includes(phrase)) {
            const lineIdx = lines.indexOf(line);
            const blockContext = lines.slice(Math.max(0, lineIdx - 3), lineIdx + 1).join('\n').toLowerCase();
            const isNegativeDisclaimer = blockContext.includes('not') || blockContext.includes('prohibited') || blockContext.includes('never');
            if (!isNegativeDisclaimer) {
              console.error(`❌ Safety Language Violation in \`${relativePath}\`: Found prohibited overclaim "${phrase}" on line: "${line.trim()}"`);
              violationCount++;
            }
          }
        }
      }
    }
  }

  console.log(`\n🏆 SAFETY LANGUAGE AUDIT COMPLETED: ${violationCount} violations found (Target: 0)\n`);
  assert.strictEqual(violationCount, 0, 'Documentation must contain ZERO unqualified prohibited overclaims');
}

runOssSafetyLanguageCheck().catch(err => {
  console.error('❌ Safety Language Check Failed:', err);
  process.exit(1);
});

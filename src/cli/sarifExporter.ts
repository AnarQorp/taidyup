import { ReconciledTrustState } from '../trust-kernel/types.js';

export class SarifExporter {
  /**
   * Exports tAIdyup Technical Findings to OASIS SARIF v2.1.0 format.
   */
  public static exportToSarif(projectName: string, state: ReconciledTrustState): any {
    const rules = [
      {
        id: 'TA001',
        name: 'DeclarationConflict',
        shortDescription: { text: 'Manifest declaration contradicts observed code binding' },
        fullDescription: { text: 'The developer manifest declared a prohibition or missing capability that static code analysis observed as an active agent-bound execution in source code.' },
        defaultConfiguration: { level: 'error' }
      },
      {
        id: 'TA002',
        name: 'UndeclaredCriticalCapability',
        shortDescription: { text: 'Undeclared critical capability observed in code' },
        fullDescription: { text: 'Static code analysis observed an active agent-bound critical capability (e.g. EXECUTE, DELETE, SEND) that was not declared in manifest.' },
        defaultConfiguration: { level: 'error' }
      },
      {
        id: 'TA003',
        name: 'UnverifiedCriticalClaim',
        shortDescription: { text: 'Declared critical capability lacks code evidence' },
        fullDescription: { text: 'A critical capability declared in manifest could not be supported by observable AGENT_BOUND code evidence.' },
        defaultConfiguration: { level: 'warning' }
      },
      {
        id: 'TA004',
        name: 'MissingOversightEvidence',
        shortDescription: { text: 'Human oversight declared but not observed in code' },
        fullDescription: { text: 'The manifest declared human approval requirement for an action, but static analysis could not observe human oversight implementation in code.' },
        defaultConfiguration: { level: 'warning' }
      }
    ];

    const results = state.findings.map(finding => {
      let ruleId = 'TA001';
      let level = 'warning';

      if (finding.type === 'DECLARATION_CONFLICT') { ruleId = 'TA001'; level = 'error'; }
      else if (finding.type === 'UNDECLARED_CRITICAL_CAPABILITY') { ruleId = 'TA002'; level = 'error'; }
      else if (finding.type === 'UNVERIFIED_CRITICAL_CLAIM') { ruleId = 'TA003'; level = 'warning'; }
      else if (finding.type === 'MISSING_OVERSIGHT_EVIDENCE') { ruleId = 'TA004'; level = 'warning'; }

      return {
        ruleId,
        level,
        message: {
          text: `[${finding.type}] ${finding.title}: ${finding.description}`
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: finding.provenance.file
              }
            }
          }
        ]
      };
    });

    return {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'tAIdyup',
              version: '0.1.0-alpha.1',
              informationUri: 'https://github.com/AnarQorp/taidyup',
              rules
            }
          },
          results
        }
      ]
    };
  }
}

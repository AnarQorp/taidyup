import { ReconciledTrustState } from '../trust-kernel/types.js';
import packageMetadata from '../../package.json';

export class SarifExporter {
  /**
   * Exports tAIdyup Technical Findings to OASIS SARIF v2.1.0 format.
   */
  public static exportToSarif(projectName: string, state: ReconciledTrustState): any {
    const rules = [
      {
        id: 'TA001',
        name: 'DeclarationConflict',
        shortDescription: { text: 'Owner declaration contradicts compatible technical evidence' },
        fullDescription: { text: 'An owner declaration contradicts compatible agent-bound technical evidence. This finding does not establish authorization, execution, safety, or compliance.' },
        defaultConfiguration: { level: 'error' }
      },
      {
        id: 'TA002',
        name: 'UndeclaredCriticalCapability',
        shortDescription: { text: 'Critical capability observation lacks a compatible declaration' },
        fullDescription: { text: 'Technical evidence reports an agent-bound critical capability path (e.g. EXECUTE, DELETE, SEND) without a compatible declaration. The declaration source may be absent or may not cover it; this does not establish authorization or runtime execution.' },
        defaultConfiguration: { level: 'error' }
      },
      {
        id: 'TA003',
        name: 'UnverifiedCriticalClaim',
        shortDescription: { text: 'Declared critical capability lacks sufficient technical evidence' },
        fullDescription: { text: 'A critical capability in an owner declaration could not be supported by compatible agent-bound evidence in the available inspection.' },
        defaultConfiguration: { level: 'warning' }
      },
      {
        id: 'TA004',
        name: 'MissingOversightEvidence',
        shortDescription: { text: 'Declared human oversight lacks compatible technical evidence' },
        fullDescription: { text: 'An owner declaration requires human approval, but the available compatible evidence does not establish that constraint for the same capability path.' },
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
              version: packageMetadata.version,
              informationUri: 'https://github.com/AnarQorp/taidyup',
              rules
            }
          },
          ...(state.declarationContext
            ? { properties: { declarationContext: state.declarationContext } }
            : {}),
          results
        }
      ]
    };
  }
}

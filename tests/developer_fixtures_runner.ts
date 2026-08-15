import fs from 'fs';
import path from 'path';
import { ManifestParser } from '../src/trust-kernel/manifestParser.js';
import { ReconciliationEngine } from '../src/trust-kernel/reconciliationEngine.js';
import { ReportGenerator } from '../src/trust-kernel/reportGenerator.js';
import { Evidence, Claim } from '../src/trust-kernel/types.js';

interface DeveloperFixture {
  id: string;
  name: string;
  description: string;
  manifest: any;
  staticEvidences: Evidence[];
}

async function runDeveloperFixtures() {
  console.log('📦 RUNNING REALISTIC DEVELOPER INTEGRATION FIXTURES (5 REALISTIC SCENARIOS)...');

  const fixtures: DeveloperFixture[] = [
    {
      id: 'fix-001',
      name: 'Customer Support Agent',
      description: 'Tier-1 Zendesk & Gmail assistant with declared human approval requirement.',
      manifest: {
        version: '1.0',
        project: 'customer-support-app',
        agents: [{
          id: 'support-agent',
          name: 'Tier-1 Support Assistant',
          purpose: 'Answers Zendesk tickets and sends customer emails',
          owner: { name: 'Support Ops', email: 'support-ops@company.com' },
          capabilities: [
            { action: 'READ', resource: 'zendesk:tickets' },
            { action: 'SEND', resource: 'email:gmail', constraints: { approval_required: 'true' } }
          ],
          oversight: { human_in_the_loop: true, approval_required: 'always' }
        }]
      },
      staticEvidences: [
        {
          id: 'ev-fix-1-1',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:support-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/support_agent.ts',
          data: { capability: 'READ', resource: 'zendesk:tickets' },
          strength: 'AGENT_BOUND',
          sha256: 'hash1',
          provenance: { file: 'src/support_agent.ts' }
        },
        {
          id: 'ev-fix-1-2',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:support-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/email_tool.ts',
          data: { capability: 'SEND', resource: 'email:gmail', hasOversight: false },
          strength: 'AGENT_BOUND',
          sha256: 'hash2',
          provenance: { file: 'src/email_tool.ts' }
        }
      ]
    },
    {
      id: 'fix-002',
      name: 'Invoice Processing Agent',
      description: 'Financial agent reading invoices and creating Stripe charges.',
      manifest: {
        version: '1.0',
        project: 'finance-app',
        agents: [{
          id: 'invoice-agent',
          name: 'Invoice Processor',
          purpose: 'Processes incoming invoices and creates Stripe payments',
          owner: { name: 'Finance Team', email: 'fin@company.com' },
          capabilities: [
            { action: 'READ', resource: 'postgres:invoices' },
            { action: 'PURCHASE', resource: 'api:stripe', constraints: { max_amount: '500 EUR' } }
          ]
        }]
      },
      staticEvidences: [
        {
          id: 'ev-fix-2-1',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:invoice-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/invoice_agent.py',
          data: { capability: 'READ', resource: 'postgres:invoices' },
          strength: 'AGENT_BOUND',
          sha256: 'hash3',
          provenance: { file: 'src/invoice_agent.py' }
        },
        {
          id: 'ev-fix-2-2',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:invoice-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/stripe_tool.py',
          data: { capability: 'PURCHASE', resource: 'api:stripe' },
          strength: 'AGENT_BOUND',
          sha256: 'hash4',
          provenance: { file: 'src/stripe_tool.py' }
        }
      ]
    },
    {
      id: 'fix-003',
      name: 'Research Scraper Agent',
      description: 'Academic literature research agent searching bioRxiv & PubMed.',
      manifest: {
        version: '1.0',
        project: 'research-app',
        agents: [{
          id: 'research-agent',
          name: 'Literature Searcher',
          purpose: 'Searches literature databases for open-access papers',
          owner: { name: 'R&D Team', email: 'rd@company.com' },
          capabilities: [
            { action: 'READ', resource: 'api:pubmed' }
          ]
        }]
      },
      staticEvidences: [
        {
          id: 'ev-fix-3-1',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:research-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/pubmed.ts',
          data: { capability: 'READ', resource: 'api:pubmed' },
          strength: 'AGENT_BOUND',
          sha256: 'hash5',
          provenance: { file: 'src/pubmed.ts' }
        }
      ]
    },
    {
      id: 'fix-004',
      name: 'MCP Enabled Assistant',
      description: 'Assistant using Model Context Protocol tools.',
      manifest: {
        version: '1.0',
        project: 'mcp-assistant-app',
        agents: [{
          id: 'mcp-agent',
          name: 'MCP Assistant',
          purpose: 'Interacts with local desktop tools via MCP',
          owner: { name: 'Dev Tools Team', email: 'devtools@company.com' },
          capabilities: [
            { action: 'READ', resource: 'mcp:filesystem' },
            { action: 'WRITE', resource: 'mcp:filesystem' }
          ]
        }]
      },
      staticEvidences: [
        {
          id: 'ev-fix-4-1',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:mcp-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/mcp_client.ts',
          data: { capability: 'READ', resource: 'mcp:filesystem' },
          strength: 'AGENT_BOUND',
          sha256: 'hash6',
          provenance: { file: 'src/mcp_client.ts' }
        },
        {
          id: 'ev-fix-4-2',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:mcp-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/mcp_client.ts',
          data: { capability: 'WRITE', resource: 'mcp:filesystem' },
          strength: 'AGENT_BOUND',
          sha256: 'hash7',
          provenance: { file: 'src/mcp_client.ts' }
        }
      ]
    },
    {
      id: 'fix-005',
      name: 'Automation Agent with Undeclared Shell Execution',
      description: 'Workflow automation agent containing an undeclared bound shell execution tool.',
      manifest: {
        version: '1.0',
        project: 'automation-app',
        agents: [{
          id: 'auto-agent',
          name: 'Workflow Automator',
          purpose: 'Listens for webhooks and posts Slack notifications',
          owner: { name: 'Ops Team', email: 'ops@company.com' },
          capabilities: [
            { action: 'READ', resource: 'webhook:incoming' },
            { action: 'SEND', resource: 'slack:notification' }
          ]
        }]
      },
      staticEvidences: [
        {
          id: 'ev-fix-5-1',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:auto-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/webhook.ts',
          data: { capability: 'READ', resource: 'webhook:incoming' },
          strength: 'AGENT_BOUND',
          sha256: 'hash8',
          provenance: { file: 'src/webhook.ts' }
        },
        {
          id: 'ev-fix-5-2',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:auto-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/slack.ts',
          data: { capability: 'SEND', resource: 'slack:notification' },
          strength: 'AGENT_BOUND',
          sha256: 'hash9',
          provenance: { file: 'src/slack.ts' }
        },
        {
          id: 'ev-fix-5-3',
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: 'agent:auto-agent',
          observedAt: new Date().toISOString(),
          collectorId: 'scanner',
          collectorVersion: '4.0.0',
          artifact: 'src/tools/shell_exec.ts',
          data: { capability: 'EXECUTE', resource: 'system:bash' }, // UNDECLARED CRITICAL EXECUTE!
          strength: 'AGENT_BOUND',
          sha256: 'hash10',
          provenance: { file: 'src/tools/shell_exec.ts' }
        }
      ]
    }
  ];

  const results: any[] = [];

  for (const fixture of fixtures) {
    const parseRes = ManifestParser.parseManifest(fixture.manifest);
    const reconcileRes = ReconciliationEngine.reconcile(parseRes.claims, [...parseRes.evidences, ...fixture.staticEvidences]);
    const markdownReport = ReportGenerator.generateMarkdownReport(fixture.name, reconcileRes);

    console.log(`   ✅ Fixture "${fixture.name}": ${reconcileRes.summary.supportedCount} Supported, ${reconcileRes.summary.unverifiedCount} Unverified, ${reconcileRes.summary.conflictCount} Conflicts, ${reconcileRes.summary.undeclaredCount} Undeclared`);

    results.push({
      fixture_id: fixture.id,
      name: fixture.name,
      description: fixture.description,
      reconciliation: reconcileRes,
      markdownReport
    });
  }

  fs.writeFileSync(path.join(process.cwd(), 'DEVELOPER_FIXTURE_RESULTS.json'), JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n📄 DEVELOPER_FIXTURE_RESULTS.json written successfully.\n');
}

runDeveloperFixtures().catch(err => {
  console.error('❌ Developer Fixtures Failed:', err);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDb } from './db.js';
import { EvidenceEngineV2 } from './services/evidenceEngine.js';
import { RegulatoryApplicabilityEngine } from './services/applicabilityEngine.js';
import { GitHubConnectorV2 } from './connectors/githubConnector.js';

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend assets from dist in production
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

// Ensure initial organization & connector seed
async function ensureSeedData() {
  const db = await getDb();
  await db.run(
    `INSERT OR IGNORE INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)`,
    ['org-acme-es', 'Acme Automation S.L. [ES]', 'ES', 'Industrial & Software Automation']
  );

  await db.run(
    `INSERT OR IGNORE INTO connectors (id, org_id, type, name, status, permissions_scope, config_json)
     VALUES (?, ?, 'github', 'GitHub Repository Connector [Read-Only]', 'active', 'read-only', ?)`,
    ['conn-github-01', 'org-acme-es', JSON.stringify({ repo: 'acme-org/customer-support-agent' })]
  );
}

// REST API Endpoints

// 1. Dashboard Metrics (Trust Readiness & Regulatory Readiness V2)
app.get('/api/organizations/:orgId/dashboard', async (req, res) => {
  try {
    const { orgId } = req.params;
    const db = await getDb();

    const org = await db.get('SELECT * FROM organizations WHERE id = ?', [orgId]);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const agents = await db.all('SELECT * FROM agents WHERE org_id = ?', [orgId]);
    const evidenceList = await db.all('SELECT * FROM evidence WHERE org_id = ?', [orgId]);
    const findingsList = await db.all('SELECT * FROM findings WHERE org_id = ? AND status = "open"', [orgId]);
    const tasksList = await db.all('SELECT * FROM tasks WHERE org_id = ? AND status = "pending"', [orgId]);
    const connectors = await db.all('SELECT * FROM connectors WHERE org_id = ?', [orgId]);
    const recentActivity = await db.all(
      `SELECT cr.* FROM connector_runs cr
       JOIN connectors c ON cr.connector_id = c.id
       WHERE c.org_id = ? ORDER BY cr.started_at DESC LIMIT 5`,
      [orgId]
    );

    // Compute overall Trust Governance Status across discovered agents
    let trustGovernanceStatus = 'UNKNOWN';
    if (agents.length > 0) {
      const evalResList = await Promise.all(agents.map(a => RegulatoryApplicabilityEngine.evaluateReadiness(a.id)));
      const hasCriticalGaps = evalResList.some(r => r.trustGovernanceStatus === 'CRITICAL_GAPS');
      const hasIncomplete = evalResList.some(r => r.trustGovernanceStatus === 'GOVERNANCE_INCOMPLETE');
      trustGovernanceStatus = hasCriticalGaps ? 'CRITICAL_GAPS' : hasIncomplete ? 'GOVERNANCE_INCOMPLETE' : 'GOVERNED';
    }

    res.json({
      organization: org,
      metrics: {
        activeAgents: agents.length,
        technicalEvidences: evidenceList.length,
        openFindings: findingsList.length,
        pendingTasks: tasksList.length,
        trustGovernanceStatus
      },
      connectors,
      recentActivity
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Trigger Read-Only GitHub Discovery Scan V2
app.post('/api/connectors/github/scan', async (req, res) => {
  try {
    const { orgId, repoPathOrUrl } = req.body;
    const targetPath = repoPathOrUrl || process.cwd();

    const db = await getDb();
    let connector = await db.get<any>('SELECT * FROM connectors WHERE org_id = ? AND type = "github"', [orgId]);
    if (!connector) {
      const connId = `conn-gh-${Date.now()}`;
      await db.run(
        `INSERT INTO connectors (id, org_id, type, name, status, permissions_scope)
         VALUES (?, ?, 'github', 'GitHub Read-Only Connector V2', 'active', 'read-only')`,
        [connId, orgId]
      );
      connector = { id: connId };
    }

    const result = await GitHubConnectorV2.runDiscovery(orgId, connector.id, targetPath);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. List Agents Registry V2
app.get('/api/agents', async (req, res) => {
  try {
    const db = await getDb();
    const agents = await db.all('SELECT * FROM agents ORDER BY updated_at DESC');

    const agentsFormatted = await Promise.all(
      agents.map(async (a) => {
        const app = await db.get('SELECT * FROM regulatory_applicability WHERE agent_id = ?', [a.id]);
        const readiness = await RegulatoryApplicabilityEngine.evaluateReadiness(a.id);

        return {
          ...a,
          protocols: JSON.parse(a.protocols_json || '[]'),
          tools: JSON.parse(a.tools_json || '[]'),
          resources: JSON.parse(a.resources_json || '[]'),
          credentialsReferenced: JSON.parse(a.credentials_referenced_json || '[]'),
          capabilities: JSON.parse(a.capabilities_json || '[]'),
          provenance: JSON.parse(a.provenance_json || '{}'),
          regulatoryApplicability: app || { overall_status: 'REVIEW_REQUIRED' },
          readiness
        };
      })
    );

    res.json(agentsFormatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Agent Passport V2 Detail
app.get('/api/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const agent = await db.get('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const app = await db.get('SELECT * FROM regulatory_applicability WHERE agent_id = ?', [id]);
    const evidenceList = await db.all('SELECT * FROM evidence WHERE agent_id = ? ORDER BY created_at DESC', [id]);
    const readiness = await RegulatoryApplicabilityEngine.evaluateReadiness(id);

    const tools = JSON.parse(agent.tools_json || '[]');
    const capabilities = JSON.parse(agent.capabilities_json || '[]');
    const credentials = JSON.parse(agent.credentials_referenced_json || '[]');

    // Build Authority Map Edges for Visual UI
    const authorityMap = {
      organization: 'Acme Automation S.L. [ES]',
      owner: { name: agent.owner_name, role: agent.owner_role },
      agent: { id: agent.id, name: agent.name, model: agent.model, framework: agent.framework },
      tools,
      capabilities,
      credentialsReferenced: credentials,
      provenance: JSON.parse(agent.provenance_json || '{}')
    };

    res.json({
      passport: {
        ...agent,
        protocols: JSON.parse(agent.protocols_json || '[]'),
        tools,
        resources: JSON.parse(agent.resources_json || '[]'),
        credentialsReferenced: credentials,
        capabilities,
        provenance: JSON.parse(agent.provenance_json || '{}')
      },
      authorityMap,
      regulatoryApplicability: app || { overall_status: 'REVIEW_REQUIRED' },
      readiness,
      evidenceHistory: evidenceList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update Regulatory Applicability
app.post('/api/agents/:id/applicability', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await RegulatoryApplicabilityEngine.updateApplicability({
      agentId: id,
      ...req.body
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Evidence Engine V2 Log
app.get('/api/evidence', async (req, res) => {
  try {
    const db = await getDb();
    const evidenceList = await db.all('SELECT * FROM evidence ORDER BY created_at DESC');
    res.json(evidenceList);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Verify Integrity of a Specific Evidence Entry
app.get('/api/evidence/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const isValid = await EvidenceEngineV2.verifyIntegrity(id);
    res.json({ evidenceId: id, integrityVerified: isValid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route serving SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
ensureSeedData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 tAIdyup Backend V2 running at http://localhost:${PORT}`);
  });
});

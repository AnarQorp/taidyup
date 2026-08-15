import { getDb } from '../db.js';
import crypto from 'crypto';

export interface FindingRecord {
  id: string;
  org_id: string;
  agent_id: string;
  evidence_id: string | null;
  control_id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_remediation' | 'resolved' | 'accepted_risk';
  created_at: string;
}

export interface TaskRecord {
  id: string;
  org_id: string;
  finding_id: string;
  agent_id: string;
  title: string;
  remediation_action: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

export class ComplianceEngine {
  /**
   * Evaluates evidence against controls and generates technical findings and actionable tasks.
   */
  static async evaluateEvidence(
    orgId: string,
    agentId: string,
    controlId: string,
    evidenceId: string,
    findingRule: {
      isFinding: boolean;
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      remediationAction: string;
    }
  ): Promise<{ finding: FindingRecord | null; task: TaskRecord | null }> {
    if (!findingRule.isFinding) {
      return { finding: null, task: null };
    }

    const db = await getDb();
    const findingId = `fnd-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const taskId = `tsk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const finding: FindingRecord = {
      id: findingId,
      org_id: orgId,
      agent_id: agentId,
      evidence_id: evidenceId,
      control_id: controlId,
      title: findingRule.title,
      description: findingRule.description,
      severity: findingRule.severity,
      status: 'open',
      created_at: new Date().toISOString()
    };

    await db.run(
      `INSERT INTO findings (id, org_id, agent_id, evidence_id, control_id, title, description, severity, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finding.id,
        finding.org_id,
        finding.agent_id,
        finding.evidence_id,
        finding.control_id,
        finding.title,
        finding.description,
        finding.severity,
        finding.status,
        finding.created_at
      ]
    );

    const task: TaskRecord = {
      id: taskId,
      org_id: orgId,
      finding_id: findingId,
      agent_id: agentId,
      title: `Remediación: ${findingRule.title}`,
      remediation_action: findingRule.remediationAction,
      priority: findingRule.severity === 'critical' || findingRule.severity === 'high' ? 'high' : 'medium',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    await db.run(
      `INSERT INTO tasks (id, org_id, finding_id, agent_id, title, remediation_action, priority, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.org_id,
        task.finding_id,
        task.agent_id,
        task.title,
        task.remediation_action,
        task.priority,
        task.status,
        task.created_at
      ]
    );

    return { finding, task };
  }
}

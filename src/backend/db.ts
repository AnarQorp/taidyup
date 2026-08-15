import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'taidyup.sqlite');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await initDbV2(dbInstance);
  return dbInstance;
}

async function initDbV2(db: Database<sqlite3.Database, sqlite3.Statement>) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'ES',
      sector TEXT NOT NULL DEFAULT 'Technology / Automation',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'github'
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      permissions_scope TEXT NOT NULL DEFAULT 'read-only',
      config_json TEXT NOT NULL DEFAULT '{}',
      last_scan_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS connector_runs (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL,
      target_resource TEXT NOT NULL,
      status TEXT NOT NULL,
      items_scanned INTEGER DEFAULT 0,
      evidence_collected INTEGER DEFAULT 0,
      error_message TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (connector_id) REFERENCES connectors(id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_role TEXT NOT NULL,
      purpose TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'UNKNOWN',
      model TEXT NOT NULL DEFAULT 'UNKNOWN',
      framework TEXT NOT NULL DEFAULT 'UNKNOWN',
      protocols_json TEXT NOT NULL DEFAULT '[]',
      tools_json TEXT NOT NULL DEFAULT '[]', -- [{ id, name, category, evidence_ref }]
      resources_json TEXT NOT NULL DEFAULT '[]',
      credentials_referenced_json TEXT NOT NULL DEFAULT '[]', -- ['OPENAI_API_KEY', ...]
      capabilities_json TEXT NOT NULL DEFAULT '[]', -- [{ capability: 'READ'|'WRITE'|..., target: string, constraint: string }]
      human_oversight_type TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'human-in-the-loop', 'kill-switch', 'UNKNOWN'
      revocation_mechanism TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'manual_pr_cancel', 'token_revocation', 'UNKNOWN'
      autonomy_level TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'LOW_AUTONOMY', 'MEDIUM_AUTONOMY', 'HIGH_AUTONOMY', 'UNKNOWN'
      technical_exposure TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED', -- 'LOW_TECHNICAL_EXPOSURE', 'MEDIUM_TECHNICAL_EXPOSURE', 'HIGH_TECHNICAL_EXPOSURE', 'REVIEW_REQUIRED'
      provenance_json TEXT NOT NULL DEFAULT '{}', -- { signal: string, sources: string[], confidence: number }
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS regulatory_applicability (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      operator_role TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'provider', 'deployer', 'importer', 'distributor', 'UNKNOWN'
      intended_purpose TEXT NOT NULL DEFAULT 'UNKNOWN',
      affected_persons TEXT NOT NULL DEFAULT 'UNKNOWN',
      context_of_use TEXT NOT NULL DEFAULT 'UNKNOWN',
      prohibited_practice_screening TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'PASSED', 'TRIGGERED', 'UNKNOWN'
      high_risk_relevance TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'HIGH_RISK_ANNEX_I', 'HIGH_RISK_ANNEX_III', 'NOT_HIGH_RISK', 'UNKNOWN'
      transparency_applicability TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'ART50_APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN'
      gpai_relevance TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'ART51_55_APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN'
      overall_status TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED', -- 'DETERMINED', 'REVIEW_REQUIRED', 'UNKNOWN'
      official_eu_checker_url TEXT,
      official_eu_checker_import_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      normative_source TEXT NOT NULL,
      article_ref TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS controls (
      id TEXT PRIMARY KEY,
      requirement_id TEXT NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      control_type TEXT NOT NULL DEFAULT 'technical',
      default_severity TEXT NOT NULL DEFAULT 'medium',
      FOREIGN KEY (requirement_id) REFERENCES requirements(id)
    );

    CREATE TABLE IF NOT EXISTS regulatory_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authority TEXT NOT NULL,
      authority_type TEXT NOT NULL, -- 'OFFICIAL_EU', 'MEMBER_STATE_AUTHORITY', 'STANDARDS_BODY', 'PRIVATE_ORGANIZATION', 'RESEARCH_SOURCE', 'UNKNOWN'
      jurisdiction TEXT NOT NULL DEFAULT 'EU',
      source_type TEXT NOT NULL, -- 'PRIMARY_LAW', 'DELEGATED_ACT', 'OFFICIAL_TOOL', 'RESEARCH', etc.
      canonical_url TEXT NOT NULL,
      canonical_domain TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
      last_verified_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      agent_id TEXT,
      control_id TEXT,
      source_connector TEXT NOT NULL,
      method TEXT NOT NULL,
      observed_resource TEXT NOT NULL,
      observed_data_json TEXT NOT NULL,
      epistemological_state TEXT NOT NULL DEFAULT 'OBSERVED', -- 'OBSERVED', 'INFERRED', 'DECLARED', 'VERIFIED'
      subject_type TEXT NOT NULL DEFAULT 'AGENT', -- 'PLATFORM', 'CONNECTOR', 'ORGANIZATION', 'HUMAN', 'AGENT', 'TOOL', 'RESOURCE', 'CREDENTIAL', 'RELATIONSHIP', 'REGULATORY_SOURCE'
      subject_id TEXT NOT NULL DEFAULT 'UNKNOWN',
      scope TEXT NOT NULL DEFAULT 'AGENT_AUTHORITY', -- 'PLATFORM_SECURITY', 'CONNECTOR_PERMISSION', 'AGENT_AUTHORITY', etc.
      evidence_strength TEXT NOT NULL DEFAULT 'DEPENDENCY_ONLY', -- 'DEPENDENCY_ONLY', 'IMPORT_OBSERVED', 'TOOL_REGISTERED', 'AGENT_BOUND', 'RUNTIME_CONFIRMED'
      collector_name TEXT NOT NULL,
      collector_version TEXT NOT NULL,
      previous_hash TEXT NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
      sha256_hash TEXT NOT NULL,
      sanitization_status text NOT NULL DEFAULT 'SANITIZED_VERIFIED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (control_id) REFERENCES controls(id)
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      evidence_id TEXT,
      control_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (control_id) REFERENCES controls(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      finding_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      title TEXT NOT NULL,
      remediation_action TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id),
      FOREIGN KEY (finding_id) REFERENCES findings(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
  `);

  // Seed default requirements & controls if empty
  const reqCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM requirements');
  if (reqCount && reqCount.count === 0) {
    await seedNormativeControls(db);
  }
}

async function seedNormativeControls(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const reqs = [
    {
      id: 'req-art10',
      code: 'EU-AI-ACT-ART10',
      title: 'Gobernanza de Datos (Solo Aplicable si es Alto Riesgo)',
      description: 'Sistemas de IA de Alto Riesgo (Art. 6): Trazabilidad de conjuntos de datos y ámbito de acceso restringido.',
      normative_source: 'EU AI Act (Reglamento UE 2024/1689)',
      article_ref: 'Artículo 10'
    },
    {
      id: 'req-art12',
      code: 'EU-AI-ACT-ART12',
      title: 'Trazabilidad y Registro de Eventos (Solo Aplicable si es Alto Riesgo)',
      description: 'Sistemas de IA de Alto Riesgo (Art. 6): Registros automáticos inmutables y auditoría de ejecución.',
      normative_source: 'EU AI Act (Reglamento UE 2024/1689)',
      article_ref: 'Artículo 12'
    },
    {
      id: 'req-art14',
      code: 'EU-AI-ACT-ART14',
      title: 'Supervisión Humana (Solo Aplicable si es Alto Riesgo)',
      description: 'Sistemas de IA de Alto Riesgo (Art. 6): Mecanismo de supervisión, interrupción o kill-switch.',
      normative_source: 'EU AI Act (Reglamento UE 2024/1689)',
      article_ref: 'Artículo 14'
    },
    {
      id: 'req-art15',
      code: 'EU-AI-ACT-ART15',
      title: 'Precisión, Robustez y Ciberseguridad (Solo Aplicable si es Alto Riesgo)',
      description: 'Sistemas de IA de Alto Riesgo (Art. 6): Resiliencia ante accesos no autorizados e inyecciones.',
      normative_source: 'EU AI Act (Reglamento UE 2024/1689)',
      article_ref: 'Artículo 15'
    },
    {
      id: 'req-art50',
      code: 'EU-AI-ACT-ART50',
      title: 'Obligación de Transparencia para Sistemas de IA que interactúan con Personas',
      description: 'Obligación de información clara al usuario final declarando que está interactuando con un sistema o agente de IA.',
      normative_source: 'EU AI Act (Reglamento UE 2024/1689)',
      article_ref: 'Artículo 50'
    }
  ];

  for (const r of reqs) {
    await db.run(
      'INSERT INTO requirements (id, code, title, description, normative_source, article_ref) VALUES (?, ?, ?, ?, ?, ?)',
      [r.id, r.code, r.title, r.description, r.normative_source, r.article_ref]
    );
  }

  const controls = [
    {
      id: 'ctl-data-01',
      requirement_id: 'req-art10',
      code: 'CTL-DATA-01',
      title: 'Verificación de Ámbito de Datos y Mínimo Acceso',
      description: 'Acceso restringido únicamente a los recursos requeridos para su propósito.',
      control_type: 'technical',
      default_severity: 'high'
    },
    {
      id: 'ctl-log-01',
      requirement_id: 'req-art12',
      code: 'CTL-LOG-01',
      title: 'Registro Integridad de Eventos (Tamper-Evident Logs)',
      description: 'Generación de trazas con hashes criptográficos de verificación.',
      control_type: 'technical',
      default_severity: 'medium'
    },
    {
      id: 'ctl-oversight-01',
      requirement_id: 'req-art14',
      code: 'CTL-OVERSIGHT-01',
      title: 'Supervisión Humana y Mecanismo de Revocación/Kill-Switch',
      description: 'Mecanismo auditable de interrupción y supervisión humana.',
      control_type: 'governance',
      default_severity: 'high'
    },
    {
      id: 'ctl-sec-01',
      requirement_id: 'req-art15',
      code: 'CTL-SEC-01',
      title: 'Principio de Menor Privilegio y Sanitización de Credenciales',
      description: 'Ausencia de secretos expuestos y alcance de tokens exclusivamente en lectura.',
      control_type: 'technical',
      default_severity: 'critical'
    },
    {
      id: 'ctl-trans-01',
      requirement_id: 'req-art50',
      code: 'CTL-TRANS-01',
      title: 'Declaración de Pasaporte e Indicador de Transparencia de Agente',
      description: 'Pasaporte de identidad visible con modelo, proveedor y límites.',
      control_type: 'governance',
      default_severity: 'medium'
    }
  ];

  for (const c of controls) {
    await db.run(
      'INSERT INTO controls (id, requirement_id, code, title, description, control_type, default_severity) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [c.id, c.requirement_id, c.code, c.title, c.description, c.control_type, c.default_severity]
    );
  }
}

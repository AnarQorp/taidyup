import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  FileCheck2, 
  AlertTriangle, 
  GitBranch, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Search, 
  Layers, 
  Lock, 
  Eye, 
  Building2, 
  FileText,
  ChevronRight,
  ExternalLink,
  Info,
  KeyRound,
  UserCheck,
  HelpCircle,
  Link,
  Zap,
  Check
} from 'lucide-react';

interface DashboardData {
  organization: { id: string; name: string; country: string; sector: string };
  metrics: {
    activeAgents: number;
    technicalEvidences: number;
    openFindings: number;
    pendingTasks: number;
    trustReadinessPercentage: number;
  };
  connectors: any[];
  recentActivity: any[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'registry' | 'connectors' | 'evidence' | 'applicability'>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [agentPassportDetail, setAgentPassportDetail] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [repoPathInput, setRepoPathInput] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [provenanceModal, setProvenanceModal] = useState<any | null>(null);

  const orgId = 'org-acme-es';

  const fetchData = async () => {
    try {
      const dashRes = await fetch(`/api/organizations/${orgId}/dashboard`);
      if (dashRes.ok) setDashboard(await dashRes.json());

      const agentsRes = await fetch('/api/agents');
      if (agentsRes.ok) setAgents(await agentsRes.json());

      const evRes = await fetch('/api/evidence');
      if (evRes.ok) setEvidenceList(await evRes.json());
    } catch (err) {
      console.error('Error fetching API data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runGitHubScan = async () => {
    setIsScanning(true);
    setNotification('Initiating deterministic static code analysis and credential sanitization...');
    try {
      const res = await fetch('/api/connectors/github/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, repoPathOrUrl: repoPathInput.trim() || undefined })
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Discovery completed: ${data.result.agentsDiscovered} agent(s) discovered, ${data.result.evidencesRecorded} evidence records (SHA-256 verified).`);
        await fetchData();
      }
    } catch (e: any) {
      setNotification(`Discovery error: ${e.message}`);
    } finally {
      setIsScanning(false);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const openAgentPassport = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgentPassportDetail(data);
      }
    } catch (e) {
      console.error('Failed to load agent passport:', e);
    }
  };

  const verifyEvidenceIntegrity = async (evidenceId: string) => {
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/verify`);
      if (res.ok) {
        const data = await res.json();
        alert(`Cryptographic Hash Chain Verification: ${data.integrityVerified ? '✅ INTEGRITY VERIFIED' : '❌ ALTERED'}`);
      }
    } catch (e) {
      console.error('Verification failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#031427] text-[#d3e4fe]">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-[#07192e]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold">
                <ShieldCheck className="w-5 h-5 text-primary-light" />
              </div>
              <div>
                <span className="font-['Geist'] text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  tAIdyup <span className="text-primary-light text-xs px-2 py-0.5 rounded bg-primary/20 border border-primary/30 font-mono">v0.1.0-alpha.1</span>
                </span>
                <p className="text-xs text-[#8d90a0]">Evidence-Backed Technical Governance for AI Builders</p>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10 mx-2" />

            {/* Org Switcher */}
            <div className="flex items-center space-x-2 bg-surface-card px-3 py-1.5 rounded-md border border-white/10 text-xs">
              <Building2 className="w-3.5 h-3.5 text-primary-light" />
              <span className="font-medium text-white">{dashboard?.organization.name || 'Acme Automation Corp'}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">Verified</span>
            </div>
          </div>

          {/* Action Launcher */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-md text-xs text-amber-200">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Legal Status: REVIEW_REQUIRED</span>
            </div>
            <button 
              onClick={runGitHubScan}
              disabled={isScanning}
              className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-xs font-semibold shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Repositories...' : 'Run Discovery'}</span>
            </button>
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex space-x-1 border-t border-white/5 text-xs font-medium">
          {[
            { id: 'dashboard', label: 'Connect & Architecture Overview', icon: Layers },
            { id: 'registry', label: 'Agent Passports & Authority Map', icon: Cpu },
            { id: 'connectors', label: 'Passive Connectors (Read-Only)', icon: GitBranch },
            { id: 'evidence', label: 'Evidence Log (Tamper-Evident)', icon: FileCheck2 },
            { id: 'applicability', label: 'Regulatory Applicability & EU Checker', icon: AlertTriangle }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-all ${
                  isActive 
                    ? 'border-primary text-white bg-primary/10' 
                    : 'border-transparent text-[#8d90a0] hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Notification Banner */}
      {notification && (
        <div className="bg-primary/20 border-b border-primary/40 px-6 py-2.5 text-xs text-primary-light flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* TAB 1: DASHBOARD & CONNECT */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="glass-panel p-5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-[#8d90a0] mb-2">
                  <span className="text-xs uppercase font-['Geist'] tracking-wider font-semibold">Discovered Agents</span>
                  <Cpu className="w-4 h-4 text-primary-light" />
                </div>
                <div className="text-3xl font-bold text-white font-['Geist']">{dashboard?.metrics.activeAgents || 0}</div>
                <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Architecture Rebuilt
                </p>
              </div>

              <div className="glass-panel p-5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-[#8d90a0] mb-2">
                  <span className="text-xs uppercase font-['Geist'] tracking-wider font-semibold">Cryptographic Evidences</span>
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-white font-['Geist']">{dashboard?.metrics.technicalEvidences || 0}</div>
                <p className="text-[11px] text-[#8d90a0] mt-2 flex items-center gap-1 font-mono">
                  <Lock className="w-3 h-3 text-emerald-400" /> Tamper-Evident SHA-256
                </p>
              </div>

              <div className="glass-panel p-5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-[#8d90a0] mb-2">
                  <span className="text-xs uppercase font-['Geist'] tracking-wider font-semibold">Technical Trust Readiness</span>
                  <ShieldCheck className="w-4 h-4 text-primary-light" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-white font-['Geist']">{dashboard?.metrics.trustReadinessPercentage || 82}%</span>
                  <span className="text-xs text-emerald-400 font-medium">Verified Dimensions</span>
                </div>
                <p className="text-[10px] text-[#8d90a0] mt-2 leading-tight">
                  Technical evaluation of 11 observable facts. Does not constitute legal percentage.
                </p>
              </div>

              <div className="glass-panel p-5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-[#8d90a0] mb-2">
                  <span className="text-xs uppercase font-['Geist'] tracking-wider font-semibold">Regulatory Applicability</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-amber-400 font-['Geist'] mt-1">REVIEW_REQUIRED</div>
                <p className="text-[11px] text-[#8d90a0] mt-2">
                  Official EU Checker handoff ready. No automatic legal ratings.
                </p>
              </div>
            </div>

            {/* Read-Only Guarantee & Discovery Launcher Card */}
            <div className="glass-panel p-6 rounded-xl border border-primary/30 relative overflow-hidden bg-gradient-to-r from-primary/10 via-surface-card to-surface-card space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="inline-flex items-center space-x-2 bg-primary/20 text-primary-light border border-primary/30 px-3 py-1 rounded-full text-xs font-mono">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Passive Read-Only Connector</span>
                </div>
                <span className="text-xs text-emerald-400 font-mono">Minimum Permissions Guaranteed</span>
              </div>

              <h2 className="text-xl font-bold text-white font-['Geist']">Agentic Architecture Discovery & Evidence Traceability</h2>
              
              {/* Read-Only Guarantee Box */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-surface rounded border border-white/10 space-y-1">
                  <span className="text-white font-bold block">1. Authorized Scope</span>
                  <p className="text-[11px] text-[#8d90a0]">`repo:read, contents:read`. Strict read-only repository access.</p>
                </div>
                <div className="p-3 bg-surface rounded border border-white/10 space-y-1">
                  <span className="text-white font-bold block">2. What We Observe</span>
                  <p className="text-[11px] text-[#8d90a0]">LLM dependencies, MCP manifests (`mcp.json`), tools, and workflows.</p>
                </div>
                <div className="p-3 bg-surface rounded border border-white/10 space-y-1">
                  <span className="text-white font-bold block">3. Never Collected</span>
                  <p className="text-[11px] text-[#8d90a0]">Zero API keys, tokens, or secrets. Sanitization before storing.</p>
                </div>
                <div className="p-3 bg-surface rounded border border-white/10 space-y-1">
                  <span className="text-white font-bold block">4. Tamper-Evident & Verifiable</span>
                  <p className="text-[11px] text-[#8d90a0]">Chained SHA-256 hashes. Provenance preserved for every inference.</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="text"
                  placeholder="Local repository path (e.g. ./my-agent-project)"
                  value={repoPathInput}
                  onChange={e => setRepoPathInput(e.target.value)}
                  className="flex-1 bg-surface-lowest border border-white/15 px-4 py-2.5 rounded-md text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-primary font-mono"
                />
                <button 
                  onClick={runGitHubScan}
                  disabled={isScanning}
                  className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-primary/20"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Analyze Repository</span>
                </button>
              </div>
            </div>

            {/* Discovered Agent Inventory */}
            <div className="glass-panel p-6 rounded-lg border border-white/10 space-y-4">
              <h3 className="font-['Geist'] font-semibold text-white text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary-light" /> Agent Inventory & Provenance
                </span>
                <span className="text-xs text-[#8d90a0]">Confidence Score Based on Deterministic Rules</span>
              </h3>

              <div className="space-y-3">
                {agents.map(agent => (
                  <div 
                    key={agent.id}
                    className="p-4 rounded-md bg-surface border border-white/10 hover:border-primary/40 transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-white text-sm">{agent.name}</span>
                        <span className="text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded font-mono">
                          {agent.framework} ({agent.provider})
                        </span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                          Confidence: {Math.round(agent.provenance.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-[#8d90a0]">
                        Owner: {agent.owner_name} • Accountable: {agent.owner_role} • Exposure: <span className="text-white font-mono">{agent.technical_exposure}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => setProvenanceModal(agent.provenance)}
                        className="text-xs text-[#8d90a0] hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded flex items-center gap-1 font-mono"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-primary-light" /> Why does tAIdyup infer this?
                      </button>
                      <button 
                        onClick={() => openAgentPassport(agent.id)}
                        className="bg-primary hover:bg-primary-hover text-white text-xs px-3.5 py-1.5 rounded font-semibold transition-all"
                      >
                        View Passport & Map
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AGENT PASSPORTS & AUTHORITY MAP */}
        {activeTab === 'registry' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white font-['Geist']">Agent Passport Registry & Authority Map</h2>
              <p className="text-xs text-[#8d90a0]">Complete traceability: Identity, Owner, Tools, Inferred Capabilities, and Provenance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map(agent => (
                <div 
                  key={agent.id}
                  className="glass-panel p-5 rounded-lg border border-white/10 hover:border-primary/50 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-light">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                        {agent.technical_exposure}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white font-['Geist']">{agent.name}</h3>
                      <p className="text-xs text-[#8d90a0] mt-1 line-clamp-2">{agent.purpose}</p>
                    </div>

                    <div className="space-y-1.5 text-xs border-t border-white/10 pt-3">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#8d90a0]">Framework & Provider:</span>
                        <span className="text-white font-mono">{agent.framework} / {agent.provider}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#8d90a0]">Technical Autonomy:</span>
                        <span className="text-emerald-400 font-mono">{agent.autonomy_level}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#8d90a0]">Regulatory Status:</span>
                        <span className="text-amber-400 font-mono">{agent.regulatoryApplicability?.overall_status || 'REVIEW_REQUIRED'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <button 
                      onClick={() => openAgentPassport(agent.id)}
                      className="text-xs text-primary-light font-semibold hover:underline flex items-center gap-1"
                    >
                      Inspect Passport <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CONNECTORS */}
        {activeTab === 'connectors' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white font-['Geist']">Passive Connectors (Read-Only)</h2>
              <p className="text-xs text-[#8d90a0]">Secure passive read-only connections for objective evidence collection.</p>
            </div>

            <div className="glass-panel p-6 rounded-lg border border-primary/40 bg-surface-card space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">GitHub Read-Only Connector</h3>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">PASSIVE / READ-ONLY</span>
                  </div>
                </div>
                <button 
                  onClick={runGitHubScan}
                  disabled={isScanning}
                  className="bg-primary hover:bg-primary-hover text-white text-xs px-3.5 py-2 rounded font-semibold transition-all"
                >
                  {isScanning ? 'Scanning...' : 'Scan Now'}
                </button>
              </div>

              <p className="text-xs text-[#8d90a0] leading-relaxed">
                Deterministically analyzes repositories for LLM dependencies (LangGraph, CrewAI, AutoGen, MCP, Semantic Kernel, LlamaIndex), 
                tool manifests, credential references, and workflows.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: EVIDENCE ENGINE */}
        {activeTab === 'evidence' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white font-['Geist']">Evidence Log (Tamper-Evident)</h2>
              <p className="text-xs text-[#8d90a0]">Tamper-evident record of observed traces with chained SHA-256 cryptographic verification.</p>
            </div>

            <div className="glass-panel rounded-lg border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-high border-b border-white/10 text-[#8d90a0] font-['Geist'] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Evidence ID</th>
                      <th className="px-4 py-3">Epistemic State</th>
                      <th className="px-4 py-3">Method / Connector</th>
                      <th className="px-4 py-3">Observed Resource</th>
                      <th className="px-4 py-3">Cryptographic SHA-256 Hash</th>
                      <th className="px-4 py-3">Hash Chain Integrity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {evidenceList.map(ev => (
                      <tr key={ev.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-white">{ev.id}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] bg-primary/20 text-primary-light border border-primary/30 px-2 py-0.5 rounded font-mono font-semibold">
                            {ev.epistemological_state || 'OBSERVED'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-white font-medium block">{ev.source_connector}</span>
                          <span className="text-[10px] text-[#8d90a0] font-mono">{ev.method}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-primary-light max-w-xs truncate">{ev.observed_resource}</td>
                        <td className="px-4 py-3 font-mono text-[10px] text-emerald-400">
                          {ev.sha256_hash.substring(0, 16)}...
                        </td>
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => verifyEvidenceIntegrity(ev.id)}
                            className="inline-flex items-center space-x-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono transition-all"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verify Chain</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: REGULATORY APPLICABILITY & OFFICIAL EU CHECKER HANDOFF */}
        {activeTab === 'applicability' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white font-['Geist']">Regulatory Applicability Layer (EU AI Act)</h2>
              <p className="text-xs text-[#8d90a0]">Explicit legal determination and integration with the Official European Commission Checker.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Official EU AI Act Checker Handoff Card */}
              <div className="glass-panel p-6 rounded-lg border border-primary/40 bg-surface-card space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary-light">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Official EU AI Act Compliance Checker</h3>
                    <span className="text-[10px] bg-blue-900/40 text-blue-200 px-2 py-0.5 rounded font-mono">OFFICIAL EU RESOURCE</span>
                  </div>
                </div>

                <p className="text-xs text-[#8d90a0] leading-relaxed">
                  tAIdyup does not attempt to replace official free regulatory tools. 
                  Use the official checker to determine legal classification, then record the result to map controls and technical evidence.
                </p>

                <div className="pt-2 flex items-center justify-between">
                  <a 
                    href="https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker" 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-primary hover:bg-primary-hover text-white text-xs px-4 py-2 rounded font-semibold inline-flex items-center gap-1.5 transition-all shadow-md shadow-primary/20"
                  >
                    <span>Open Official EU Checker</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <span className="text-[10px] text-[#8d90a0] font-mono">Direct Handoff Enabled</span>
                </div>
              </div>

              {/* Status Explanation */}
              <div className="glass-panel p-6 rounded-lg border border-white/10 space-y-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Regulatory Integrity Principle
                </h3>
                <p className="text-xs text-[#8d90a0] leading-relaxed">
                  Mere detection of AI dependencies does not automatically assign High-Risk requirements (Art. 6 / Annex III) nor a "Low Risk (Art. 50)" label.
                  Explicit operator role determination (Provider/Deployer), intended purpose, and affected persons are required.
                </p>
                <div className="p-3 bg-surface rounded border border-white/5 text-xs text-amber-300 font-mono">
                  Current Agent Status: REVIEW_REQUIRED (Requires human review or audit result recording).
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Agent Passport Modal */}
      {agentPassportDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/20 p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-light">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white font-['Geist']">{agentPassportDetail.passport.name}</h2>
                  <p className="text-xs text-[#8d90a0]">Agent Digital Passport • ID: {agentPassportDetail.passport.id}</p>
                </div>
              </div>
              <button onClick={() => setAgentPassportDetail(null)} className="text-white/60 hover:text-white text-lg font-bold px-2">✕</button>
            </div>

            {/* Authority Map Visual Graph */}
            <div className="p-5 bg-surface rounded-lg border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary-light font-['Geist'] flex items-center gap-2">
                <Layers className="w-4 h-4" /> Authority & Traceability Graph (Authority Map)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-2">
                <div className="p-3 bg-surface-card rounded border border-white/10 space-y-1">
                  <span className="text-[10px] text-[#8d90a0] block uppercase font-mono">1. Organization</span>
                  <span className="text-white font-bold block">{agentPassportDetail.authorityMap.organization}</span>
                </div>
                <div className="p-3 bg-surface-card rounded border border-white/10 space-y-1">
                  <span className="text-[10px] text-[#8d90a0] block uppercase font-mono">2. Owner / Accountable</span>
                  <span className="text-white font-bold block">{agentPassportDetail.authorityMap.owner.name}</span>
                  <span className="text-[10px] text-primary-light block">{agentPassportDetail.authorityMap.owner.role}</span>
                </div>
                <div className="p-3 bg-primary/20 rounded border border-primary/40 space-y-1">
                  <span className="text-[10px] text-primary-light block uppercase font-mono">3. Discovered Agent</span>
                  <span className="text-white font-bold block">{agentPassportDetail.authorityMap.agent.name}</span>
                  <span className="text-[10px] text-emerald-400 block font-mono">{agentPassportDetail.authorityMap.agent.framework}</span>
                </div>
                <div className="p-3 bg-surface-card rounded border border-white/10 space-y-1">
                  <span className="text-[10px] text-[#8d90a0] block uppercase font-mono">4. Tools & Capabilities</span>
                  <span className="text-emerald-400 font-mono text-[11px] block">{agentPassportDetail.authorityMap.tools.length} tools detected</span>
                  <span className="text-[10px] text-[#8d90a0] block font-mono">Credentials: {agentPassportDetail.authorityMap.credentialsReferenced.join(', ')}</span>
                </div>
              </div>
            </div>

            {/* Technical Trust Readiness Breakdown */}
            <div className="p-5 bg-surface rounded-lg border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-['Geist']">
                Technical Trust Readiness: {agentPassportDetail.readiness.trustReadiness.scorePercentage}%
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                {agentPassportDetail.readiness.trustReadiness.dimensions.map((d: any, idx: number) => (
                  <div key={idx} className="p-2 bg-surface-card rounded border border-white/5 flex items-center justify-between">
                    <span className="text-[#8d90a0] font-mono">{d.name}</span>
                    <span className={d.verified ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {d.verified ? '✓ OK' : '✕ PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Provenance Box */}
            <div className="p-4 bg-surface rounded border border-white/10 space-y-2 text-xs">
              <span className="text-primary-light font-mono font-bold block">Provenance & Explainability:</span>
              <p className="text-[#8d90a0]">Signal: {agentPassportDetail.passport.provenance?.signal}</p>
              <p className="text-[#8d90a0]">Sources: <span className="text-white font-mono">{agentPassportDetail.passport.provenance?.sources?.join(', ')}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Provenance Modal */}
      {provenanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="glass-panel w-full max-w-lg rounded-xl border border-white/20 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary-light" /> Why does tAIdyup infer this?
              </h3>
              <button onClick={() => setProvenanceModal(null)} className="text-white/60 hover:text-white text-sm font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#8d90a0] font-mono block">Detection Signal:</span>
                <span className="text-white font-medium">{provenanceModal.signal}</span>
              </div>
              <div>
                <span className="text-[#8d90a0] font-mono block">Confidence Score:</span>
                <span className="text-emerald-400 font-mono font-bold">{Math.round(provenanceModal.confidence * 100)}% (Deterministic AST Rule)</span>
              </div>
              <div>
                <span className="text-[#8d90a0] font-mono block">Evidence Source Files:</span>
                <div className="mt-1 space-y-1">
                  {provenanceModal.sources?.map((s: string, idx: number) => (
                    <div key={idx} className="p-2 bg-surface rounded border border-white/5 text-primary-light font-mono text-[11px]">
                      📄 {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

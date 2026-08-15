import { getDb } from '../db.js';

export type RegulatorySourceType = 
  | 'PRIMARY_LAW'
  | 'DELEGATED_ACT'
  | 'IMPLEMENTING_ACT'
  | 'OFFICIAL_GUIDANCE'
  | 'OFFICIAL_TOOL'
  | 'OFFICIAL_FAQ'
  | 'STANDARD'
  | 'SECONDARY_ANALYSIS'
  | 'RESEARCH';

export type AuthorityType = 
  | 'OFFICIAL_EU'
  | 'MEMBER_STATE_AUTHORITY'
  | 'STANDARDS_BODY'
  | 'PRIVATE_ORGANIZATION'
  | 'RESEARCH_SOURCE'
  | 'UNKNOWN';

export interface RegulatorySourceRecord {
  id: string;
  title: string;
  authority: string;
  authorityType: AuthorityType;
  jurisdiction: string;
  sourceType: RegulatorySourceType;
  canonicalUrl: string;
  canonicalDomain: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'SPOOFED_REJECTED';
}

export class RegulatorySourceRegistry {
  private static OFFICIAL_EU_DOMAINS = [
    'ec.europa.eu',
    'europa.eu',
    'eur-lex.europa.eu',
    'ai-act-service-desk.ec.europa.eu'
  ];

  /**
   * Validates if a URL actually belongs to an official EU authority domain.
   * Rejects domain spoofing (e.g. europa.eu.fake.com) and unauthorized private domains.
   */
  public static isOfficialEuDomain(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      const hostname = parsed.hostname.toLowerCase();
      
      // Strict exact match or valid subdomain of official EU domains
      return this.OFFICIAL_EU_DOMAINS.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Registers or verifies a regulatory source with domain verification.
   */
  public static async registerSource(source: RegulatorySourceRecord): Promise<RegulatorySourceRecord> {
    const isEuDomain = this.isOfficialEuDomain(source.canonicalUrl);
    
    // Strict enforcement: IF authorityType claims OFFICIAL_EU, domain MUST be verified
    if (source.authorityType === 'OFFICIAL_EU' && !isEuDomain) {
      throw new Error(`SECURITY VIOLATION: Source "${source.title}" claims OFFICIAL_EU authority but canonical domain "${source.canonicalDomain}" is NOT an official European Union domain.`);
    }

    const db = await getDb();
    await db.run(
      `INSERT INTO regulatory_sources (
        id, title, authority, authority_type, jurisdiction, source_type,
        canonical_url, canonical_domain, verification_status, last_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        verification_status = excluded.verification_status,
        last_verified_at = CURRENT_TIMESTAMP`,
      [
        source.id,
        source.title,
        source.authority,
        source.authorityType,
        source.jurisdiction,
        source.sourceType,
        source.canonicalUrl,
        source.canonicalDomain,
        source.verificationStatus
      ]
    );

    return source;
  }
}

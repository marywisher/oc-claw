/**
 * Web Allowlist Checker
 * 
 * Provides domain allowlist checking for web access (fetch and search).
 * Supports three-level access flow:
 * 1. Allowlist check
 * 2. User confirmation
 * 3. Dangerous domain rejection
 */

export type WebAccessApprovalNeeded = {
  domain: string;
  reason: "not-in-allowlist" | "dangerous-domain";
  userMessage: string;
};

/**
 * Extract domain from a URL string.
 * Returns null if URL is invalid.
 */
export function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Check if a domain is in the allowlist.
 * Supports exact matches and wildcard subdomains (*.example.com).
 */
export function isInAllowlist(domain: string | null, allowlist?: string[]): boolean {
  if (!domain || !allowlist || allowlist.length === 0) {
    return false;
  }

  const lowerDomain = domain.toLowerCase();
  
  for (const entry of allowlist) {
    const lowerEntry = entry.toLowerCase();
    
    // Exact match
    if (lowerEntry === lowerDomain) {
      return true;
    }
    
    // Wildcard match (*.example.com matches a.example.com, b.example.com, etc.)
    if (lowerEntry.startsWith("*.")) {
      const baseDomain = lowerEntry.slice(2);
      if (lowerDomain === baseDomain || lowerDomain.endsWith("." + baseDomain)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if a domain is in the dangerous domains list.
 */
export function isDangerousDomain(domain: string | null, dangerousDomains?: string[]): boolean {
  if (!domain || !dangerousDomains || dangerousDomains.length === 0) {
    return false;
  }

  const lowerDomain = domain.toLowerCase();
  
  for (const dangerous of dangerousDomains) {
    const lowerDangerous = dangerous.toLowerCase();
    if (lowerDangerous === lowerDomain) {
      return true;
    }
    if (lowerDangerous.startsWith("*.")) {
      const baseDomain = lowerDangerous.slice(2);
      if (lowerDomain === baseDomain || lowerDomain.endsWith("." + baseDomain)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check web access for a given URL.
 * Returns { ok: true } if access is allowed, or { ok: false, approval } otherwise.
 */
export function checkWebAccess(opts: {
  url: string;
  allowlist?: string[];
  dangerousDomains?: string[];
  requireConfirmation?: boolean;
}): { ok: true } | { ok: false; approval: WebAccessApprovalNeeded } {
  const domain = extractDomainFromUrl(opts.url);
  
  if (!domain) {
    // Invalid URL - let downstream handle the error
    return { ok: true };
  }

  // Check dangerous domains first (highest priority)
  if (isDangerousDomain(domain, opts.dangerousDomains)) {
    return {
      ok: false,
      approval: {
        domain,
        reason: "dangerous-domain",
        userMessage: `This website is blocked for security reasons: ${domain}`,
      },
    };
  }

  // Check allowlist
  if (isInAllowlist(domain, opts.allowlist)) {
    return { ok: true };
  }

  // If no allowlist or domain not in allowlist, require confirmation
  if (opts.requireConfirmation !== false) {
    return {
      ok: false,
      approval: {
        domain,
        reason: "not-in-allowlist",
        userMessage: `Allow visiting ${domain}? [Allow Once] [Always Allow] [Deny]`,
      },
    };
  }

  // If confirmation not required, allow by default
  return { ok: true };
}

/**
 * Default list of safe domains (optional curated list).
 * Users should define their own allowlist in config.
 */
export const DEFAULT_SAFE_DOMAINS: string[] = [
  "wikipedia.org",
  "*.wikipedia.org",
  "github.com",
  "*.github.com",
  "stackoverflow.com",
  "*.stackoverflow.com",
  "docs.openclaw.ai",
  "openclaw.ai",
];

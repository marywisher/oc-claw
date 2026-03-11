import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import { normalizeChatChannelId } from "../channels/registry.js";
import { listRouteBindings } from "../config/bindings.js";
import type { OpenClawConfig } from "../config/config.js";
import type { AgentRouteBinding } from "../config/types.agents.js";
import { normalizeAccountId, normalizeAgentId } from "./session-key.js";

function normalizeBindingChannelId(raw?: string | null): string | null {
  const normalized = normalizeChatChannelId(raw);
  if (normalized) {
    return normalized;
  }
  const fallback = (raw ?? "").trim().toLowerCase();
  return fallback || null;
}

/**
 * Extract keyword from message start (e.g., "@assistant" from "@assistant hello").
 * Returns the keyword (without leading @) or null if no keyword found.
 */
export function extractKeywordFromMessage(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("@")) {
    return null;
  }
  const match = trimmed.match(/^@(\w+)/);
  if (!match || !match[1]) {
    return null;
  }
  return match[1];
}

/**
 * Route message to agent based on keyword prefix.
 * If message starts with @keyword, routes to agent mapped to that keyword.
 * Falls back to default agent (usually "assistant") otherwise.
 */
export function resolveAgentByKeywordRoute(
  cfg: OpenClawConfig,
  message: string,
): string {
  const keyword = extractKeywordFromMessage(message);
  if (!keyword) {
    // No keyword; return configured default or hardcoded "assistant"
    return normalizeAgentId(cfg.agents?.defaults?.routing?.defaultAgentId ?? "assistant");
  }

  // Search for matching keyword pattern in routing config
  const keywords = cfg.agents?.defaults?.routing?.keywords ?? [];
  for (const kw of keywords) {
    const pattern = kw.pattern.trim();
    let isMatch = false;

    // Support regex patterns (prefix with "/")
    if (pattern.startsWith("/")) {
      try {
        const regexPattern = pattern.slice(1);
        const regex = new RegExp(`^${regexPattern}$`);
        isMatch = regex.test(keyword);
      } catch {
        // Invalid regex; skip
      }
    } else {
      // Exact string match (case-insensitive)
      isMatch = pattern.toLowerCase() === keyword.toLowerCase();
    }

    if (isMatch) {
      return normalizeAgentId(kw.agentId);
    }
  }

  // No matching keyword; return default
  return normalizeAgentId(cfg.agents?.defaults?.routing?.defaultAgentId ?? "assistant");
}

export function listBindings(cfg: OpenClawConfig): AgentRouteBinding[] {
  return listRouteBindings(cfg);
}

function resolveNormalizedBindingMatch(binding: AgentRouteBinding): {
  agentId: string;
  accountId: string;
  channelId: string;
} | null {
  if (!binding || typeof binding !== "object") {
    return null;
  }
  const match = binding.match;
  if (!match || typeof match !== "object") {
    return null;
  }
  const channelId = normalizeBindingChannelId(match.channel);
  if (!channelId) {
    return null;
  }
  const accountId = typeof match.accountId === "string" ? match.accountId.trim() : "";
  if (!accountId || accountId === "*") {
    return null;
  }
  return {
    agentId: normalizeAgentId(binding.agentId),
    accountId: normalizeAccountId(accountId),
    channelId,
  };
}

export function listBoundAccountIds(cfg: OpenClawConfig, channelId: string): string[] {
  const normalizedChannel = normalizeBindingChannelId(channelId);
  if (!normalizedChannel) {
    return [];
  }
  const ids = new Set<string>();
  for (const binding of listBindings(cfg)) {
    const resolved = resolveNormalizedBindingMatch(binding);
    if (!resolved || resolved.channelId !== normalizedChannel) {
      continue;
    }
    ids.add(resolved.accountId);
  }
  return Array.from(ids).toSorted((a, b) => a.localeCompare(b));
}

export function resolveDefaultAgentBoundAccountId(
  cfg: OpenClawConfig,
  channelId: string,
): string | null {
  const normalizedChannel = normalizeBindingChannelId(channelId);
  if (!normalizedChannel) {
    return null;
  }
  const defaultAgentId = normalizeAgentId(resolveDefaultAgentId(cfg));
  for (const binding of listBindings(cfg)) {
    const resolved = resolveNormalizedBindingMatch(binding);
    if (
      !resolved ||
      resolved.channelId !== normalizedChannel ||
      resolved.agentId !== defaultAgentId
    ) {
      continue;
    }
    return resolved.accountId;
  }
  return null;
}

export function buildChannelAccountBindings(cfg: OpenClawConfig) {
  const map = new Map<string, Map<string, string[]>>();
  for (const binding of listBindings(cfg)) {
    const resolved = resolveNormalizedBindingMatch(binding);
    if (!resolved) {
      continue;
    }
    const byAgent = map.get(resolved.channelId) ?? new Map<string, string[]>();
    const list = byAgent.get(resolved.agentId) ?? [];
    if (!list.includes(resolved.accountId)) {
      list.push(resolved.accountId);
    }
    byAgent.set(resolved.agentId, list);
    map.set(resolved.channelId, byAgent);
  }
  return map;
}

export function resolvePreferredAccountId(params: {
  accountIds: string[];
  defaultAccountId: string;
  boundAccounts: string[];
}): string {
  if (params.boundAccounts.length > 0) {
    return params.boundAccounts[0];
  }
  return params.defaultAccountId;
}

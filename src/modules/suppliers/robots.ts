import type { PoliteClient } from "./http";

interface Rule {
  allow: boolean;
  pattern: string;
}

/**
 * The rules a site's robots.txt sets for us (the `*` group). Adapters that
 * cover many stores check this at the start of every run, so a store that
 * changes its mind is respected the same day.
 */
export class RobotsPolicy {
  private constructor(private readonly rules: Rule[]) {}

  static parse(robotsTxt: string): RobotsPolicy {
    const rules: Rule[] = [];
    let inOurGroup = false;
    let readingAgents = false;

    for (const raw of robotsTxt.split(/\r?\n/)) {
      const line = raw.split("#")[0].trim();
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();

      if (key === "user-agent") {
        if (!readingAgents) inOurGroup = false;
        readingAgents = true;
        if (value === "*") inOurGroup = true;
      } else {
        readingAgents = false;
        if (inOurGroup && value && (key === "allow" || key === "disallow")) {
          rules.push({ allow: key === "allow", pattern: value });
        }
      }
    }
    return new RobotsPolicy(rules);
  }

  static async fetch(origin: string, client: PoliteClient): Promise<RobotsPolicy> {
    const { status, text } = await client.get(`${origin}/robots.txt`);
    // No robots.txt means no restrictions; any other failure means we do not know, so we stop.
    if (status === 404) return new RobotsPolicy([]);
    if (status !== 200) throw new Error(`robots.txt unavailable (HTTP ${status}) for ${origin}`);
    return RobotsPolicy.parse(text);
  }

  /** Longest matching rule wins; Allow wins a tie. No match means allowed. */
  allows(path: string): boolean {
    let best: Rule | null = null;
    for (const rule of this.rules) {
      if (!toRegExp(rule.pattern).test(path)) continue;
      if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
        best = rule;
      }
    }
    return best ? best.allow : true;
  }
}

function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

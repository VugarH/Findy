/**
 * The scheduled jobs, started from the admin panel. They run on GitHub
 * Actions (a daily run takes ~35 minutes, far longer than a Vercel request
 * may), so "Run now" asks GitHub to start the workflow and lists its runs.
 *
 *   GITHUB_REPO            "owner/name", e.g. "VugarH/Findy"
 *   GITHUB_ACTIONS_TOKEN   fine-grained token for that repository with
 *                          "Actions: Read and write" (see docs/DEPLOY.md)
 */

export const JOBS = {
  daily: { workflow: "daily-deals.yml", acceptsStores: true },
  follows: { workflow: "follows.yml", acceptsStores: false },
} as const;
export type JobName = keyof typeof JOBS;
export const isJobName = (value: string): value is JobName => value in JOBS;

export type JobRunState = "queued" | "running" | "success" | "failure" | "cancelled";

export interface JobRun {
  id: number;
  state: JobRunState;
  startedAt: Date;
  /** "schedule" (the daily timer) or "workflow_dispatch" (started by hand or from here). */
  trigger: string;
  url: string;
}

const API = "https://api.github.com";
const repo = () => process.env.GITHUB_REPO?.trim() || null;
const token = () => process.env.GITHUB_ACTIONS_TOKEN?.trim() || null;

export const jobsConfigured = (): boolean => repo() !== null && token() !== null;

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}/repos/${repo()}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

/** Store ids as the daily job takes them ("superstep,allbeauty"), or null when the text is not a list of ids. */
export function parseStoreList(text: string): string | null {
  const ids = text
    .split(/[\s,]+/)
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (ids.some((id) => !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(id))) return null;
  return [...new Set(ids)].join(",");
}

/** Asks GitHub to start a job now. Throws with GitHub's answer when it refuses. */
export async function startJob(job: JobName, stores = ""): Promise<void> {
  const inputs = JOBS[job].acceptsStores && stores ? { only: stores } : undefined;
  const response = await github(`/actions/workflows/${JOBS[job].workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", ...(inputs ? { inputs } : {}) }),
  });
  if (response.status !== 204) throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

function stateOf(run: { status: string; conclusion: string | null }): JobRunState {
  if (run.status === "queued" || run.status === "waiting" || run.status === "pending" || run.status === "requested") return "queued";
  if (run.status !== "completed") return "running";
  if (run.conclusion === "success") return "success";
  if (run.conclusion === "cancelled" || run.conclusion === "skipped") return "cancelled";
  return "failure";
}

/** The job's latest runs on GitHub, newest first; empty when GitHub cannot be reached. */
export async function recentJobRuns(job: JobName, count = 3): Promise<JobRun[]> {
  if (!jobsConfigured()) return [];
  try {
    const response = await github(`/actions/workflows/${JOBS[job].workflow}/runs?per_page=${count}`);
    if (!response.ok) return [];
    const body = (await response.json()) as {
      workflow_runs: { id: number; status: string; conclusion: string | null; run_started_at: string; event: string; html_url: string }[];
    };
    return body.workflow_runs.map((run) => ({
      id: run.id,
      state: stateOf(run),
      startedAt: new Date(run.run_started_at),
      trigger: run.event,
      url: run.html_url,
    }));
  } catch {
    return [];
  }
}

import type { context } from "@actions/github";
import type { GitHub } from "@actions/github/lib/utils";
import type { components } from "@octokit/openapi-types";

type Context = typeof context;
type Octokit = InstanceType<typeof GitHub>;

// Modest cap to stay clear of GitHub's secondary rate limits on concurrent requests
const MAX_CONCURRENT_REQUESTS = 8;

async function mapWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, items.length) }, worker));
  return results;
}

async function getWorkflowRun(context: Context, octokit: Octokit, runId: number, runAttempt?: number) {
  if (runAttempt !== undefined) {
    const res = await octokit.rest.actions.getWorkflowRunAttempt({
      ...context.repo,
      run_id: runId,
      attempt_number: runAttempt,
    });
    return res.data;
  }
  const res = await octokit.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: runId,
  });
  return res.data;
}

async function listJobsForWorkflowRun(context: Context, octokit: Octokit, runId: number, runAttempt?: number) {
  if (runAttempt !== undefined) {
    // The jobs of exactly this attempt, whatever attempts have started since.
    return await octokit.paginate(octokit.rest.actions.listJobsForWorkflowRunAttempt, {
      ...context.repo,
      run_id: runId,
      attempt_number: runAttempt,
      per_page: 100,
    });
  }
  return await octokit.paginate(octokit.rest.actions.listJobsForWorkflowRun, {
    ...context.repo,
    run_id: runId,
    filter: "latest", // risk of missing a run if re-run happens between Action trigger and this query
    per_page: 100,
  });
}

async function getJobsAnnotations(context: Context, octokit: Octokit, jobIds: number[]) {
  const annotations: Record<number, components["schemas"]["check-annotation"][]> = {};
  const results = await mapWithConcurrency(jobIds, (jobId) => listAnnotations(context, octokit, jobId));

  for (const [i, jobId] of jobIds.entries()) {
    annotations[jobId] = results[i];
  }
  return annotations;
}

async function listAnnotations(context: Context, octokit: Octokit, checkRunId: number) {
  return await octokit.paginate(octokit.rest.checks.listAnnotations, {
    ...context.repo,
    check_run_id: checkRunId,
  });
}

async function getPRsLabels(context: Context, octokit: Octokit, prNumbers: number[]) {
  const labels: Record<number, string[]> = {};
  const results = await mapWithConcurrency(prNumbers, (prNumber) => listLabelsOnIssue(context, octokit, prNumber));

  for (const [i, prNumber] of prNumbers.entries()) {
    labels[prNumber] = results[i];
  }
  return labels;
}

async function listLabelsOnIssue(context: Context, octokit: Octokit, prNumber: number) {
  return await octokit.paginate(
    octokit.rest.issues.listLabelsOnIssue,
    {
      ...context.repo,
      issue_number: prNumber,
    },
    (response) => response.data.map((issue) => issue.name)
  );
}

export { getJobsAnnotations, getPRsLabels, getWorkflowRun, listJobsForWorkflowRun, type Octokit };

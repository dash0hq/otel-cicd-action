import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import type { RequestError } from "@octokit/request-error";
import type { Attributes } from "@opentelemetry/api";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { ATTR_SERVICE_INSTANCE_ID, ATTR_SERVICE_NAMESPACE } from "@opentelemetry/semantic-conventions/incubating";
import { getJobsAnnotations, getPRsLabels, getWorkflowRun, listJobsForWorkflowRun } from "./github";
import { traceWorkflowRun } from "./trace/workflow";
import { createTracerProvider, stringToRecord } from "./tracer";

function isOctokitError(err: unknown): err is RequestError {
  return !!err && typeof err === "object" && "status" in err;
}

async function fetchGithub(token: string, runId: number, runAttempt?: number) {
  const octokit = getOctokit(token);

  core.info(`Get workflow run for ${runId}`);
  const workflowRun = await getWorkflowRun(context, octokit, runId, runAttempt);

  core.info("Get jobs");
  const jobs = await listJobsForWorkflowRun(context, octokit, runId, runAttempt);

  core.info("Get job annotations");
  const jobsId = (jobs ?? []).map((job) => job.id);
  let jobAnnotations = {};
  try {
    jobAnnotations = await getJobsAnnotations(context, octokit, jobsId);
  } catch (error) {
    if (isOctokitError(error)) {
      core.info(`Failed to get job annotations: ${error.message}`);
    } else {
      throw error;
    }
  }

  core.info("Get PRs labels");
  const prNumbers = (workflowRun.pull_requests ?? []).map((pr) => pr.number);
  let prLabels = {};
  try {
    prLabels = await getPRsLabels(context, octokit, prNumbers);
  } catch (error) {
    if (isOctokitError(error)) {
      core.info(`Failed to get PRs labels: ${error.message}`);
    } else {
      throw error;
    }
  }

  return { workflowRun, jobs, jobAnnotations, prLabels };
}

function parseRunAttempt(input: string): number | undefined {
  if (input === "") {
    return undefined;
  }
  const attempt = Number(input);
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error(`runAttempt must be a positive integer, got "${input}"`);
  }
  return attempt;
}

async function run() {
  try {
    const otlpEndpoint = core.getInput("otlpEndpoint");
    const otlpHeaders = core.getInput("otlpHeaders");
    const otelServiceName = core.getInput("otelServiceName") || process.env["OTEL_SERVICE_NAME"] || "";
    const runId = Number.parseInt(core.getInput("runId") || `${context.runId}`, 10);
    const runAttempt = parseRunAttempt(core.getInput("runAttempt"));
    const extraAttributes = stringToRecord(core.getInput("extraAttributes"));
    const ghToken = core.getInput("githubToken") || process.env["GITHUB_TOKEN"] || "";
    const otlpInsecureSkipVerify = core.getBooleanInput("otlpInsecureSkipVerify");

    if (otlpInsecureSkipVerify) {
      core.warning("TLS certificate verification is disabled for the OTLP exporter.");
    }

    core.info("Use Github API to fetch workflow data");
    const { workflowRun, jobs, jobAnnotations, prLabels } = await fetchGithub(ghToken, runId, runAttempt);

    core.info(`Create tracer provider for ${otlpEndpoint}`);
    const attributes: Attributes = {
      [ATTR_SERVICE_NAME]: otelServiceName || workflowRun.name || `${workflowRun.workflow_id}`,
      [ATTR_SERVICE_INSTANCE_ID]: [
        workflowRun.repository.full_name,
        `${workflowRun.workflow_id}`,
        `${workflowRun.id}`,
        `${workflowRun.run_attempt ?? 1}`,
      ].join("/"),
      [ATTR_SERVICE_NAMESPACE]: workflowRun.repository.full_name,
      [ATTR_SERVICE_VERSION]: workflowRun.head_sha,
      ...extraAttributes,
    };
    const provider = createTracerProvider(otlpEndpoint, otlpHeaders, attributes, otlpInsecureSkipVerify);

    core.info(`Trace workflow run for ${runId} and export to ${otlpEndpoint}`);
    const traceId = traceWorkflowRun(workflowRun, jobs, jobAnnotations, prLabels);

    core.setOutput("traceId", traceId);
    core.info(`traceId: ${traceId}`);

    core.info("Flush and shutdown tracer provider");
    await provider.forceFlush();
    await provider.shutdown();
    core.info("Provider shutdown");
  } catch (error) {
    const message = error instanceof Error ? error : JSON.stringify(error);
    core.setFailed(message);
  }
}

export { isOctokitError, parseRunAttempt, run };

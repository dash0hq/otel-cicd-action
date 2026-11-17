import * as core from "@actions/core";
import type { components } from "@octokit/openapi-types";
import { type Attributes, trace } from "@opentelemetry/api";
import {
  ATTR_CICD_PIPELINE_TASK_NAME,
  ATTR_CICD_PIPELINE_TASK_RUN_ID,
  ATTR_CICD_PIPELINE_TASK_RUN_RESULT,
  ATTR_CICD_PIPELINE_TASK_RUN_URL_FULL,
  ATTR_CICD_PIPELINE_TASK_TYPE,
  ATTR_CICD_WORKER_ID,
  ATTR_CICD_WORKER_NAME,
  CICD_PIPELINE_TASK_RUN_RESULT_VALUE_CANCELLATION,
  CICD_PIPELINE_TASK_RUN_RESULT_VALUE_FAILURE,
  CICD_PIPELINE_TASK_RUN_RESULT_VALUE_SKIP,
  CICD_PIPELINE_TASK_RUN_RESULT_VALUE_SUCCESS,
  CICD_PIPELINE_TASK_RUN_RESULT_VALUE_TIMEOUT,
  CICD_PIPELINE_TASK_TYPE_VALUE_BUILD,
  CICD_PIPELINE_TASK_TYPE_VALUE_DEPLOY,
  CICD_PIPELINE_TASK_TYPE_VALUE_TEST,
} from "@opentelemetry/semantic-conventions/incubating";
import { recordConclusion } from "./status";
import { traceStep } from "./step";

function traceJob(job: components["schemas"]["job"], annotations?: components["schemas"]["check-annotation"][]) {
  const tracer = trace.getTracer("otel-cicd-action");

  if (!job.completed_at) {
    core.info(`Job ${job.id} is not completed yet`);
    return;
  }

  const createTime = new Date(job.created_at);
  const startTime = new Date(Math.max(createTime.getTime(), new Date(job.started_at).getTime()));
  const completedTime = new Date(job.completed_at);
  const attributes = {
    ...jobToAttributes(job),
    ...annotationsToAttributes(annotations),
  };

  tracer.startActiveSpan(job.name, { attributes, startTime: createTime }, (span) => {
    recordConclusion(span, job.conclusion);

    // "Queued" span represents the time the job waited for a runner to pick it up
    if (startTime > createTime) {
      const queuedSpan = tracer.startSpan("Queued", { startTime: createTime });
      queuedSpan.end(startTime);
    }

    for (const step of job.steps ?? []) {
      traceStep(step);
    }

    // Some skipped and post jobs return completed_at dates that are older than started_at
    span.end(new Date(Math.max(startTime.getTime(), completedTime.getTime())));
  });
}

function jobToAttributes(job: components["schemas"]["job"]): Attributes {
  // Heuristic for task type
  let taskType: string | undefined;
  if (job.name.toLowerCase().includes("build")) {
    taskType = CICD_PIPELINE_TASK_TYPE_VALUE_BUILD;
  } else if (job.name.toLowerCase().includes("test")) {
    taskType = CICD_PIPELINE_TASK_TYPE_VALUE_TEST;
  } else if (job.name.toLowerCase().includes("deploy")) {
    taskType = CICD_PIPELINE_TASK_TYPE_VALUE_DEPLOY;
  }

  return {
    // OpenTelemetry semantic convention CICD Pipeline Attributes
    // https://opentelemetry.io/docs/specs/semconv/attributes-registry/cicd/
    [ATTR_CICD_PIPELINE_TASK_NAME]: job.name,
    [ATTR_CICD_PIPELINE_TASK_RUN_ID]: job.id,
    [ATTR_CICD_PIPELINE_TASK_RUN_RESULT]: toTaskResult(job.conclusion),
    [ATTR_CICD_PIPELINE_TASK_RUN_URL_FULL]: job.html_url ?? undefined,
    [ATTR_CICD_PIPELINE_TASK_TYPE]: taskType,
    [ATTR_CICD_WORKER_ID]: job.runner_id ?? undefined,
    [ATTR_CICD_WORKER_NAME]: job.runner_name ?? undefined,
    "github.job.id": job.id,
    "github.job.name": job.name,
    "github.job.run_id": job.run_id,
    "github.job.run_url": job.run_url,
    "github.job.run_attempt": job.run_attempt ?? 1,
    "github.job.node_id": job.node_id,
    "github.job.head_sha": job.head_sha,
    "github.job.url": job.url,
    "github.job.html_url": job.html_url ?? undefined,
    "github.job.status": job.status,
    "github.job.runner_id": job.runner_id ?? undefined,
    "github.job.runner_group_id": job.runner_group_id ?? undefined,
    "github.job.runner_group_name": job.runner_group_name ?? undefined,
    "github.job.runner_name": job.runner_name ?? undefined,
    "github.job.conclusion": job.conclusion ?? undefined,
    "github.job.labels": job.labels,
    "github.job.created_at": job.created_at,
    "github.job.started_at": job.started_at,
    "github.job.completed_at": job.completed_at ?? undefined,
    "github.conclusion": job.conclusion ?? undefined,
    "github.job.check_run_url": job.check_run_url,
    "github.job.workflow_name": job.workflow_name ?? undefined,
    "github.job.head_branch": job.head_branch ?? undefined,
  };
}

function toTaskResult(conclusion: components["schemas"]["job"]["conclusion"]) {
  //unmapped value: CICD_PIPELINE_TASK_RUN_RESULT_VALUE_ERROR
  switch (conclusion) {
    case "failure":
    case "action_required":
      return CICD_PIPELINE_TASK_RUN_RESULT_VALUE_FAILURE;
    case "success":
    case "neutral":
      return CICD_PIPELINE_TASK_RUN_RESULT_VALUE_SUCCESS;
    case "cancelled":
      return CICD_PIPELINE_TASK_RUN_RESULT_VALUE_CANCELLATION;
    case "skipped":
      return CICD_PIPELINE_TASK_RUN_RESULT_VALUE_SKIP;
    case "timed_out":
      return CICD_PIPELINE_TASK_RUN_RESULT_VALUE_TIMEOUT;
    default:
      return undefined;
  }
}

function annotationsToAttributes(annotations: components["schemas"]["check-annotation"][] | undefined) {
  const attributes: Attributes = {};

  for (let i = 0; annotations && i < annotations.length; i++) {
    const annotation = annotations[i];
    const prefix = `github.job.annotations.${i}`;

    attributes[`${prefix}.level`] = annotation.annotation_level ?? undefined;
    attributes[`${prefix}.message`] = annotation.message ?? undefined;
  }

  return attributes;
}

export { traceJob };

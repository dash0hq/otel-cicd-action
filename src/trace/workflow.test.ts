import type { components } from "@octokit/openapi-types";
import { context, SpanKind, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { traceWorkflowRun } from "./workflow";

function fakeWorkflowRun(overrides: Partial<components["schemas"]["workflow-run"]>) {
  return {
    name: "Test workflow",
    status: "completed",
    conclusion: "success",
    created_at: "2026-01-01T00:00:00Z",
    run_started_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:01:00Z",
    pull_requests: [],
    ...overrides,
  } as unknown as components["schemas"]["workflow-run"];
}

function fakeJob(name: string, startedAt: string) {
  return {
    id: 1,
    name,
    status: "completed",
    conclusion: "success",
    labels: [],
    steps: [],
    created_at: "2026-01-01T00:00:00Z",
    started_at: startedAt,
    completed_at: "2026-01-01T00:01:00Z",
  } as unknown as components["schemas"]["job"];
}

describe("traceWorkflowRun", () => {
  const exporter = new InMemorySpanExporter();
  let provider: BasicTracerProvider;

  beforeAll(() => {
    const contextManager = new AsyncLocalStorageContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);

    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(() => {
    exporter.reset();
  });

  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
    context.disable();
  });

  it("ends the Queued span at the earliest job start time", () => {
    // Jobs are deliberately not ordered by start time: the API does not guarantee it
    const jobs = [fakeJob("late job", "2026-01-01T00:00:10Z"), fakeJob("early job", "2026-01-01T00:00:04Z")];

    traceWorkflowRun(fakeWorkflowRun({}), jobs, {}, {});

    const queued = exporter.getFinishedSpans().find((span) => span.name === "Queued");
    expect(queued).toBeDefined();
    expect(queued?.startTime[0]).toBe(Date.parse("2026-01-01T00:00:00Z") / 1000);
    expect(queued?.endTime[0]).toBe(Date.parse("2026-01-01T00:00:04Z") / 1000);
  });

  it("does not end the Queued span before the workflow run start", () => {
    // Seen on re-run attempts: a job reported as started before the run itself
    const jobs = [fakeJob("early job", "2025-12-31T23:59:00Z")];

    traceWorkflowRun(fakeWorkflowRun({}), jobs, {}, {});

    const queued = exporter.getFinishedSpans().find((span) => span.name === "Queued");
    expect(queued?.endTime[0]).toBe(Date.parse("2026-01-01T00:00:00Z") / 1000);
  });

  it("gives the pipeline run span kind SERVER and its task runs kind INTERNAL", () => {
    const job = {
      ...fakeJob("a job", "2026-01-01T00:00:04Z"),
      steps: [
        {
          name: "a step",
          status: "completed",
          conclusion: "success",
          number: 1,
          started_at: "2026-01-01T00:00:04Z",
          completed_at: "2026-01-01T00:00:05Z",
        },
      ],
    } as unknown as components["schemas"]["job"];

    traceWorkflowRun(fakeWorkflowRun({}), [job], {}, {});

    const spans = exporter.getFinishedSpans();
    const byName = (name: string) => spans.find((span) => span.name === name);

    expect(byName("Test workflow")?.kind).toBe(SpanKind.SERVER);
    expect(byName("a job")?.kind).toBe(SpanKind.INTERNAL);
    expect(byName("a step")?.kind).toBe(SpanKind.INTERNAL);
  });

  it("does not create a Queued span when there are no jobs", () => {
    traceWorkflowRun(fakeWorkflowRun({}), [], {}, {});

    expect(exporter.getFinishedSpans().find((span) => span.name === "Queued")).toBeUndefined();
  });
});

import type { components } from "@octokit/openapi-types";
import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { traceJob } from "./job";

function fakeJob(createdAt: string, startedAt: string) {
  return {
    id: 1,
    name: "a job",
    status: "completed",
    conclusion: "success",
    labels: [],
    steps: [],
    created_at: createdAt,
    started_at: startedAt,
    completed_at: "2026-01-01T00:01:00Z",
  } as unknown as components["schemas"]["job"];
}

describe("traceJob", () => {
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

  it("creates a span from created_at->completed_at", () => {
    traceJob(fakeJob("2026-01-01T00:00:00Z", "2026-01-01T00:00:07Z"));

    const spans = exporter.getFinishedSpans();
    const job = spans.find((span) => span.name === "a job");

    expect(job?.startTime[0]).toBe(Date.parse("2026-01-01T00:00:00Z") / 1000);
    expect(job?.endTime[0]).toBe(Date.parse("2026-01-01T00:01:00Z") / 1000);
  });

  it("creates a Queued span between created_at->started_at", () => {
    traceJob(fakeJob("2026-01-01T00:00:00Z", "2026-01-01T00:00:07Z"));

    const spans = exporter.getFinishedSpans();
    const job = spans.find((span) => span.name === "a job");
    const queued = spans.find((span) => span.name === "Queued");

    expect(queued?.parentSpanContext?.spanId).toBe(job?.spanContext().spanId);
    expect(queued?.startTime[0]).toBe(Date.parse("2026-01-01T00:00:00Z") / 1000);
    expect(queued?.endTime[0]).toBe(Date.parse("2026-01-01T00:00:07Z") / 1000);
  });

  it("does not create a Queued span if created_at is equal to started_at", () => {
    traceJob(fakeJob("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"));

    const spans = exporter.getFinishedSpans();
    const byName = (name: string) => spans.find((span) => span.name === name);
    expect(byName("Queued")).toBeUndefined();
  });

  it("does not create a Queued span if created_at is greater than started_at", () => {
    traceJob(fakeJob("2026-01-01T00:00:05Z", "2026-01-01T00:00:00Z"));

    const spans = exporter.getFinishedSpans();
    const byName = (name: string) => spans.find((span) => span.name === name);
    expect(byName("Queued")).toBeUndefined();
    expect(byName("a job")?.startTime[0]).toBe(Date.parse("2026-01-01T00:00:05Z") / 1000);
  });
});

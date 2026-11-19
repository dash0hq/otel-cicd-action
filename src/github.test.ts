import { jest } from "@jest/globals";
import type { Octokit } from "./github";
import { getWorkflowRun, listJobsForWorkflowRun } from "./github";

const context = { repo: { owner: "owner", repo: "repo" } } as Parameters<typeof getWorkflowRun>[0];

function stubOctokit() {
  const actions = {
    getWorkflowRun: jest.fn(async () => ({ data: { id: 1, run_attempt: 3 } })),
    getWorkflowRunAttempt: jest.fn(async () => ({ data: { id: 1, run_attempt: 2 } })),
    listJobsForWorkflowRun: jest.fn(),
    listJobsForWorkflowRunAttempt: jest.fn(),
  };
  const paginate = jest.fn(async (method: unknown, params: Record<string, unknown>) => [{ method, params }]);
  return { octokit: { rest: { actions }, paginate } as unknown as Octokit, actions, paginate };
}

describe("getWorkflowRun", () => {
  it("reads the latest attempt by default", async () => {
    const { octokit, actions } = stubOctokit();
    const run = await getWorkflowRun(context, octokit, 1);
    expect(run.run_attempt).toBe(3);
    expect(actions.getWorkflowRun).toHaveBeenCalledWith({ owner: "owner", repo: "repo", run_id: 1 });
    expect(actions.getWorkflowRunAttempt).not.toHaveBeenCalled();
  });

  it("reads exactly the requested attempt, even when a later one exists", async () => {
    const { octokit, actions } = stubOctokit();
    const run = await getWorkflowRun(context, octokit, 1, 2);
    expect(run.run_attempt).toBe(2);
    expect(actions.getWorkflowRunAttempt).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      run_id: 1,
      attempt_number: 2,
    });
    expect(actions.getWorkflowRun).not.toHaveBeenCalled();
  });
});

describe("listJobsForWorkflowRun", () => {
  it("lists the latest jobs by default", async () => {
    const { octokit, actions, paginate } = stubOctokit();
    await listJobsForWorkflowRun(context, octokit, 1);
    expect(paginate).toHaveBeenCalledWith(actions.listJobsForWorkflowRun, {
      owner: "owner",
      repo: "repo",
      run_id: 1,
      filter: "latest",
      per_page: 100,
    });
  });

  it("lists the jobs of exactly the requested attempt", async () => {
    const { octokit, actions, paginate } = stubOctokit();
    await listJobsForWorkflowRun(context, octokit, 1, 2);
    expect(paginate).toHaveBeenCalledWith(actions.listJobsForWorkflowRunAttempt, {
      owner: "owner",
      repo: "repo",
      run_id: 1,
      attempt_number: 2,
      per_page: 100,
    });
  });
});

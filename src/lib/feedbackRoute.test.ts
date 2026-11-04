import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/feedback/route";

const report = {
  kind: "Bug",
  whatHappened: "The report button failed.",
  whatExpected: "It should open.",
  metadata: {
    path: "/bench",
    locale: "en",
    viewport: "390×844",
    userAgent: "Vitest",
    activeBetaFeatures: ["report-problem"],
    commit: "local",
  },
};

function request(cookie?: string) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(report),
  });
}

describe("feedback API", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "");
    vi.stubEnv("GITHUB_FEEDBACK_REPO", "");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects requests without the beta cookie", async () => {
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns not-configured when no GitHub token is set", async () => {
    const response = await POST(request("lang=es; beta=1"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, reason: "not-configured" });
  });

  it("creates an issue and returns its URL", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ html_url: "https://github.com/Micron2005/Element-Lab/issues/24" }, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request("beta=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      url: "https://github.com/Micron2005/Element-Lab/issues/24",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/Micron2005/Element-Lab/issues",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      labels: string[];
      title: string;
    };
    expect(body.title).toBe("[Beta] Bug: The report button failed.");
    expect(body.labels).toEqual(["beta-feedback", "Bug"]);
  });
});

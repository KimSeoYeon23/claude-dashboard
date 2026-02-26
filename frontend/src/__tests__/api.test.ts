import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportError, fetchApi, api } from "../api";

beforeEach(() => {
  vi.restoreAllMocks();
  // 쿠키 초기화
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "username=testuser",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reportError", () => {
  it("POST /api/report-error로 에러를 전송한다", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { ok: true } });

    await reportError("api_error", "테스트 에러", { stack: "Error\n  at test" });

    expect(postSpy).toHaveBeenCalledWith(
      "/api/report-error",
      expect.objectContaining({
        type: "api_error",
        message: "테스트 에러",
        stack: "Error\n  at test",
      }),
    );
  });

  it("axios 실패 시 예외를 던지지 않는다", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new Error("네트워크 에러"));

    // 에러 없이 완료되어야 함
    await expect(reportError("test", "msg")).resolves.toBeUndefined();
  });
});

describe("fetchApi", () => {
  it("성공 시 JSON 응답을 반환한다", async () => {
    const mockData = { sessions: [], total: 0 };
    vi.spyOn(api, "get").mockResolvedValue({ data: mockData });

    const result = await fetchApi<typeof mockData>("/api/sessions");
    expect(result).toEqual(mockData);
  });

  it("실패 시 에러를 throw하고 reportError를 호출한다", async () => {
    const axiosError = Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: { status: 404, data: "Not Found" },
      config: {},
      toJSON: () => ({}),
    });

    vi.spyOn(api, "get").mockRejectedValue(axiosError);
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { ok: true } });

    await expect(fetchApi("/api/nonexistent")).rejects.toThrow("API 404");

    // reportError가 호출됨
    expect(postSpy).toHaveBeenCalledWith(
      "/api/report-error",
      expect.objectContaining({
        type: "api_error",
        message: expect.stringContaining("404"),
      }),
    );
  });

  it("GET 요청으로 올바른 경로를 호출한다", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} });

    await fetchApi("/api/stats");

    expect(getSpy).toHaveBeenCalledWith("/api/stats");
  });
});

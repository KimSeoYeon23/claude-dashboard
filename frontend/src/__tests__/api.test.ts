import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportError, fetchApi } from "../api";

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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true })),
    );

    await reportError("api_error", "테스트 에러", { stack: "Error\n  at test" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/report-error?user=testuser",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      }),
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.type).toBe("api_error");
    expect(body.message).toBe("테스트 에러");
    expect(body.stack).toBe("Error\n  at test");
  });

  it("fetch 실패 시 예외를 던지지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("네트워크 에러"));

    // 에러 없이 완료되어야 함
    await expect(reportError("test", "msg")).resolves.toBeUndefined();
  });
});

describe("fetchApi", () => {
  it("성공 시 JSON 응답을 반환한다", async () => {
    const mockData = { sessions: [], total: 0 };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await fetchApi<typeof mockData>("/api/sessions");
    expect(result).toEqual(mockData);
  });

  it("실패 시 에러를 throw하고 reportError를 호출한다", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // 첫 번째 호출: fetchApi의 원래 요청 → 404
    // 두 번째 호출: reportError의 POST → 성공
    fetchSpy
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await expect(fetchApi("/api/nonexistent")).rejects.toThrow("API 404");

    // reportError가 호출됨 (두 번째 fetch)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toContain("/api/report-error");
  });

  it("username을 쿼리 파라미터로 추가한다", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await fetchApi("/api/stats");

    expect(fetchSpy.mock.calls[0][0]).toBe("/api/stats?user=testuser");
  });
});

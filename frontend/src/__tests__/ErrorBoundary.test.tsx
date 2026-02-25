import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ErrorBoundary from "../components/ErrorBoundary";

// reportError를 mock
vi.mock("../api", () => ({
  reportError: vi.fn(),
}));

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("테스트 렌더링 에러");
  return <div>정상 렌더링</div>;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("정상 렌더링 시 children을 그대로 표시한다", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("정상 렌더링")).toBeInTheDocument();
  });

  it("에러 발생 시 fallback UI를 표시한다", () => {
    // React 에러 바운더리의 console.error 억제
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("오류가 발생했습니다")).toBeInTheDocument();
    expect(screen.getByText("테스트 렌더링 에러")).toBeInTheDocument();
    expect(screen.getByText("새로고침")).toBeInTheDocument();

    spy.mockRestore();
  });

  it("에러 발생 시 reportError를 호출한다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { reportError } = await import("../api");

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(reportError).toHaveBeenCalledWith(
      "render_crash",
      "테스트 렌더링 에러",
      expect.objectContaining({
        stack: expect.any(String),
      }),
    );

    spy.mockRestore();
  });
});

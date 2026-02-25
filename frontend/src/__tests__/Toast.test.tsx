import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ToastProvider, useToast } from "../components/Toast";

// useToast를 호출하는 테스트용 헬퍼 컴포넌트
function Trigger() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("성공 메시지")}>success</button>
      <button onClick={() => toast.error("에러 메시지")}>error</button>
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Toast 시스템", () => {
  it("success toast가 표시된다", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByText("success"));
    expect(screen.getByText("성공 메시지")).toBeInTheDocument();
  });

  it("error toast가 표시된다", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByText("error"));
    expect(screen.getByText("에러 메시지")).toBeInTheDocument();
  });

  it("X 버튼 클릭 시 toast가 제거된다", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByText("success"));
    expect(screen.getByText("성공 메시지")).toBeInTheDocument();

    // X 버튼 클릭
    await userEvent.click(screen.getByText("×"));
    expect(screen.queryByText("성공 메시지")).not.toBeInTheDocument();
  });

  it("4초 후 자동으로 사라진다", async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByText("success").click();
    });

    expect(screen.getByText("성공 메시지")).toBeInTheDocument();

    // 4초 경과
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("성공 메시지")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("여러 toast가 동시에 쌓인다", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByText("success"));
    await userEvent.click(screen.getByText("error"));

    expect(screen.getByText("성공 메시지")).toBeInTheDocument();
    expect(screen.getByText("에러 메시지")).toBeInTheDocument();
  });

  it("ToastProvider 외부에서 useToast 호출 시 에러", () => {
    // 콘솔 에러 억제
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<Trigger />);
    }).toThrow("useToast must be used within ToastProvider");

    spy.mockRestore();
  });
});

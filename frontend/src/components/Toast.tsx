import { createContext, useCallback, useContext, useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";

type ToastType = "error" | "success";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (type: ToastType, message: string) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, type, message }]);
      const timer = setTimeout(() => remove(id), 4000);
      timers.current.set(id, timer);
    },
    [remove],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const ctx: ToastContextValue = {
    success: (msg) => add("success", msg),
    error: (msg) => add("error", msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container — fixed top-right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-md animate-[slideIn_0.25s_ease-out] ${
              t.type === "error"
                ? "border-red/30 bg-red/10 text-red"
                : "border-green/30 bg-green/10 text-green"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className={`ml-1 text-lg leading-none opacity-60 transition-opacity hover:opacity-100 ${
                t.type === "error" ? "text-red" : "text-green"
              }`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

import { useEffect, useState } from "react";
import { api } from "../api";

interface Settings {
  plan: string;
  reset_weekday: number;
  reset_hour: number;
  reset_tz_offset: number;
}

const PLANS = ["", "Pro", "Max 5x", "Max 20x"];
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export default function UsageSettings({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    plan: "",
    reset_weekday: -1,
    reset_hour: 14,
    reset_tz_offset: 9,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    api.get<Settings>("/api/me/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, [open]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/api/me/settings", settings);
      setMsg("저장됨");
      setOpen(false);
      onSaved?.();
    } catch {
      setMsg("저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all mx-auto"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        사용량 설정
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setOpen(false)}>
          <div
            className="w-80 rounded-2xl border border-white/10 p-5 shadow-2xl"
            style={{ background: "rgba(15, 15, 25, 0.97)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="mb-4 text-sm font-semibold text-white">사용량 설정</h4>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-gray-300">플랜</label>
              <select
                value={settings.plan}
                onChange={(e) => setSettings({ ...settings, plan: e.target.value })}
                className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none border border-white/20 focus:border-accent/60"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p} style={{ background: "#0f0f19", color: "#fff" }}>
                    {p || "서버 기본값"}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-gray-300">
                7일 리셋 요일
                <span className="ml-1 text-gray-500">(모르면 자동)</span>
              </label>
              <select
                value={settings.reset_weekday}
                onChange={(e) => setSettings({ ...settings, reset_weekday: Number(e.target.value) })}
                className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none border border-white/20 focus:border-accent/60"
              >
                <option value={-1} style={{ background: "#0f0f19", color: "#fff" }}>자동 (rolling)</option>
                {WEEKDAYS.map((d, i) => (
                  <option key={i} value={i} style={{ background: "#0f0f19", color: "#fff" }}>{d}요일</option>
                ))}
              </select>
            </div>

            {settings.reset_weekday >= 0 && (
              <div className="mb-4 flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-gray-300">리셋 시각 (현지)</label>
                  <input
                    type="number" min={0} max={23}
                    value={settings.reset_hour}
                    onChange={(e) => setSettings({ ...settings, reset_hour: Number(e.target.value) })}
                    className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none border border-white/20 focus:border-accent/60"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-gray-300">시간대 (UTC+N)</label>
                  <input
                    type="number" min={-12} max={14}
                    value={settings.reset_tz_offset}
                    onChange={(e) => setSettings({ ...settings, reset_tz_offset: Number(e.target.value) })}
                    className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none border border-white/20 focus:border-accent/60"
                  />
                </div>
              </div>
            )}

            {msg && <p className="mb-3 text-xs text-green-400">{msg}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-white/20 py-2 text-sm text-gray-300 hover:text-white hover:border-white/40 transition-colors"
              >
                취소
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

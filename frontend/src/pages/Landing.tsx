import { Link } from "react-router-dom";

const features = [
  {
    title: "Usage Stats",
    desc: "토큰 사용량, 모델별 비용, 일별 활동량을 한눈에 확인",
    icon: "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "hover:border-accent/40",
  },
  {
    title: "Session History",
    desc: "모든 Claude Code 세션의 대화 내역, 도구 호출, 수정 파일 추적",
    icon: "M13 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11l-8-8zm4 16H7v-2h10v2zm0-4H7v-2h10v2zm-5-5V4.5l6.5 6.5H12z",
    color: "text-green",
    bg: "bg-green/10",
    border: "hover:border-green/40",
  },
  {
    title: "Multi-user Sync",
    desc: "팀원 각자의 머신에서 데이터를 중앙 서버로 자동 동기화",
    icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
    color: "text-purple",
    bg: "bg-purple/10",
    border: "hover:border-purple/40",
  },
  {
    title: "Error Alerts",
    desc: "Claude 에러, 무응답, 서버 장애 시 이메일로 즉시 알림",
    icon: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
    color: "text-orange",
    bg: "bg-orange/10",
    border: "hover:border-orange/40",
  },
];

export default function Landing() {
  return (
    <div className="flex flex-col gap-16 py-8">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3 text-4xl font-bold text-text-primary">
          <span className="text-accent">&gt;_</span> Claude Code Dashboard
        </div>
        <p className="max-w-xl text-lg text-text-secondary">
          Claude Code 사용 현황을 실시간으로 모니터링하고,
          팀 전체의 AI 활용도를 한곳에서 관리하세요.
        </p>
        <div className="flex gap-3">
          <Link
            to="/setup"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            시작하기
          </Link>
          <Link
            to="/dashboard"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-tertiary"
          >
            예시 보기
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className={`rounded-xl border border-border bg-bg-card p-6 transition-colors ${f.border}`}
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${f.bg}`}>
              <svg className={`h-5 w-5 ${f.color}`} viewBox="0 0 24 24" fill="currentColor">
                <path d={f.icon} />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary">{f.title}</h3>
            <p className="mt-1 text-sm text-text-secondary">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-6">
        <h2 className="text-center text-xl font-bold text-text-primary">How it works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "등록", desc: "Setup 페이지에서 유저명을 입력하고 토큰을 발급받습니다.", bg: "bg-accent" },
            { step: "2", title: "Hook 설정", desc: "발급받은 설정을 ~/.claude/settings.json에 붙여넣기합니다.", bg: "bg-purple" },
            { step: "3", title: "자동 동기화", desc: "Claude Code 세션이 끝날 때마다 데이터가 자동으로 동기화됩니다.", bg: "bg-green" },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center gap-3 rounded-xl border border-border bg-bg-card p-6 text-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${s.bg} text-sm font-bold text-white`}>
                {s.step}
              </div>
              <h3 className="text-base font-semibold text-text-primary">{s.title}</h3>
              <p className="text-sm text-text-secondary">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-bg-card p-8 text-center">
        <p className="text-lg font-semibold text-text-primary">
          지금 바로 시작하세요
        </p>
        <p className="text-sm text-text-secondary">
          설정은 1분이면 충분합니다.
        </p>
        <Link
          to="/setup"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Setup Guide
        </Link>
      </section>
    </div>
  );
}

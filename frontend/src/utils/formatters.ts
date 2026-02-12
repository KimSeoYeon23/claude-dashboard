export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "0";
  return n.toLocaleString("ko-KR");
}

export function fmtDate(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "-";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtTokens(n: number | null | undefined): string {
  if (!n) return "0";
  if (n > 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n > 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n > 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function projectShortName(path: string | null | undefined): string {
  if (!path) return "";
  const parts = path.replace(/^-/, "").split("-");
  if (parts.length <= 2) return path;
  const idx = parts.indexOf("kimseoyeon");
  if (idx >= 0 && idx + 1 < parts.length) {
    return parts.slice(idx + 1).join("-");
  }
  return parts.slice(-2).join("-");
}

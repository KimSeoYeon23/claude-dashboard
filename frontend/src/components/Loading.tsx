export default function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center px-5 py-15 text-[15px] text-text-muted">
      <div className="mr-3 h-6 w-6 animate-spin rounded-full border-3 border-border border-t-accent" />
      {text}
    </div>
  );
}

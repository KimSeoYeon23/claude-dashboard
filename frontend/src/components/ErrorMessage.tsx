export default function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red bg-red/10 px-5 py-4 text-sm text-red">
      {message}
    </div>
  );
}

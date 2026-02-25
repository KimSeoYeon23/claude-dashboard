export default function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red/30 bg-red/5 backdrop-blur-sm px-5 py-4 text-sm text-red">
      {message}
    </div>
  );
}

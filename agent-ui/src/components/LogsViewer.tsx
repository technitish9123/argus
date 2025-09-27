// src/components/LogsViewer.tsx
export default function LogsViewer({ logs }: { logs: string[] }) {
  return (
    <div className="mt-8 bg-black text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
      {logs.length === 0 ? (
        <p className="text-gray-500">No logs yet.</p>
      ) : (
        logs.map((line, i) => <div key={i}>{line}</div>)
      )}
    </div>
  );
}

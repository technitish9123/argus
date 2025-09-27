// src/components/DeployControls.tsx
export default function DeployControls({
  running,
  onDeploy,
}: {
  running: boolean;
  onDeploy: () => void;
}) {
  return (
    <button
      onClick={onDeploy}
      disabled={running}
      className={`${
        running ? "bg-gray-500" : "bg-green-600 hover:bg-green-700"
      } text-white px-6 py-2 rounded-lg`}
    >
      {running ? "Running..." : "Deploy Strategy"}
    </button>
  );
}

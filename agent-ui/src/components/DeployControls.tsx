export default function DeployControls({
  running,
  onDeploy,
}: {
  running: boolean;
  onDeploy: () => void;
}) {
  return (
    <div className="mt-4 flex justify-end">
      <button
        onClick={onDeploy}
        disabled={running}
        className="
          px-4 py-1.5 
          text-sm font-medium
          text-gray-200
          bg-gray-800/50 
          border border-gray-700
          rounded-md 
          hover:bg-gray-700/50 
          hover:text-white
          transition
          disabled:opacity-40
        "
      >
        {running ? "Deploying..." : "Deploy Strategy"}
      </button>
    </div>
  );
}

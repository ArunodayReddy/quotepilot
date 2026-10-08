export function SimBadge({ label = "Simulated — demo pricing" }: { label?: string }) {
  return (
    <span className="sim-badge" title="These prices are simulated for demonstration purposes.">
      {label}
    </span>
  );
}

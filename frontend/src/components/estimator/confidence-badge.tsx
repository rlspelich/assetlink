interface Props {
  percentile: number | null;
  label: string | null;
}

const COLORS: Record<string, { bg: string; text: string; border: string }> = {
  very_low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  fair: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  high: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  very_high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  no_data: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

const LABELS: Record<string, string> = {
  very_low: 'Very Low',
  low: 'Low',
  fair: 'Fair',
  high: 'High',
  very_high: 'Very High',
  no_data: 'No Data',
};

export function ConfidenceBadge({ percentile, label }: Props) {
  const key = label || 'no_data';
  const colors = COLORS[key] || COLORS.no_data;
  const displayLabel = LABELS[key] || key;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
      title={percentile != null ? `${percentile}th percentile` : 'Insufficient data'}
    >
      {displayLabel}
      {percentile != null && (
        <span className="opacity-70">{percentile}%</span>
      )}
    </span>
  );
}

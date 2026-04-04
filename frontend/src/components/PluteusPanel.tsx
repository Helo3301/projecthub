import { useEffect, useState } from 'react';
import { ExternalLink, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { pluteus, type PluteusDecision } from '@/lib/api';

interface PluteusPanelProps {
  correlationId?: string;
  taskTitle?: string;
}

export default function PluteusPanel({ correlationId, taskTitle }: PluteusPanelProps) {
  const [decisions, setDecisions] = useState<PluteusDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [pluteusUrl, setPluteusUrl] = useState('');

  useEffect(() => {
    // Check if Pluteus is configured
    pluteus.status()
      .then((status) => {
        setConfigured(status.configured && status.reachable);
        if (status.url) setPluteusUrl(status.url);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!configured) return;

    setLoading(true);

    // If we have a correlation ID, fetch by that. Otherwise search by task title.
    const fetchDecisions = correlationId
      ? pluteus.decisions(correlationId)
      : taskTitle
        ? pluteus.search(taskTitle).then((results: any[]) =>
            results
              .filter((r) => r.ContentType === 'decision')
              .slice(0, 5)
              .map((r) => ({
                ID: r.ContentID,
                Title: r.Title,
                Question: '',
                ChosenOption: '',
                Tier: '',
                Confidence: '',
                AmphoraNodeID: '',
                URL: r.URL || '',
                UpdatedAt: '',
              }))
          )
        : Promise.resolve([]);

    fetchDecisions
      .then(setDecisions)
      .catch(() => setDecisions([]))
      .finally(() => setLoading(false));
  }, [configured, correlationId, taskTitle]);

  // Don't render if Pluteus isn't configured
  if (configured === false) return null;
  if (configured === null) return null; // Still checking

  return (
    <div className="mt-4 border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors text-sm"
      >
        <span className="flex items-center gap-2 text-gray-400">
          <Brain size={14} />
          Agent Decisions
          {decisions.length > 0 && (
            <span className="bg-orange-900/50 text-orange-300 text-xs px-1.5 py-0.5 rounded">
              {decisions.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>

      {expanded && (
        <div className="p-3">
          {loading && (
            <p className="text-xs text-gray-500 italic">Loading decisions...</p>
          )}

          {!loading && decisions.length === 0 && (
            <p className="text-xs text-gray-500 italic">No related decisions found</p>
          )}

          {!loading && decisions.length > 0 && (
            <div className="space-y-2">
              {decisions.map((d) => (
                <a
                  key={d.ID}
                  href={`${pluteusUrl}/decisions/${d.ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded border border-gray-700 hover:border-gray-500 hover:bg-gray-800/30 transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <ExternalLink size={12} className="text-gray-500 mt-0.5 shrink-0 group-hover:text-orange-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-300 truncate">
                        {d.Title || d.Question || `Decision #${d.ID}`}
                      </p>
                      {d.ChosenOption && (
                        <p className="text-xs text-emerald-400/70 mt-0.5 truncate">
                          Chose: {d.ChosenOption}
                        </p>
                      )}
                      {d.Tier && (
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                          {d.Tier}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

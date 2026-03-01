'use client';

import { useState } from 'react';
import { api, AISkillGapMarketResponse } from '@/lib/api';

/* ── Circular Progress ─────────────────────────────────── */
function MatchCircle({ percent }: { percent: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const color =
    percent >= 75 ? '#22c55e' : percent >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={130} height={130} className="-rotate-90">
        <circle
          cx={65}
          cy={65}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={10}
        />
        <circle
          cx={65}
          cy={65}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-2xl font-bold text-gray-900">
        {percent}%
      </span>
    </div>
  );
}

/* ── Priority badge colors ─────────────────────────────── */
function priorityColor(p: string) {
  switch (p.toLowerCase()) {
    case 'high':
      return 'bg-red-100 text-red-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-green-100 text-green-700';
  }
}

/* ── Main Component ────────────────────────────────────── */
export default function SkillGapDashboard() {
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AISkillGapMarketResponse | null>(null);

  const handleAnalyze = async () => {
    if (resumeText.trim().length < 20) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.aiSkillGapMarket(resumeText);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Market-Based Skill Gap Analysis
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Paste your resume and see how your skills match current market demand
          across all scraped jobs.
        </p>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={6}
          placeholder="Paste your resume text here..."
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || resumeText.trim().length < 20}
          className="mt-3 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Analyzing...' : 'Analyze Skill Gap'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Match % */}
          <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-medium text-gray-500 uppercase tracking-wide">
              Market Match
            </h3>
            <MatchCircle percent={result.match_percentage} />
            <p className="mt-3 text-xs text-gray-500">
              of top demanded skills you already have
            </p>
          </div>

          {/* Missing Skills */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">
              Missing Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.missing_skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                >
                  {s}
                </span>
              ))}
              {result.missing_skills.length === 0 && (
                <p className="text-sm text-green-600">All top skills covered!</p>
              )}
            </div>
          </div>

          {/* Priority List */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">
              Improvement Priority
            </h3>
            <ul className="space-y-2">
              {result.improvement_priority.slice(0, 8).map((item) => (
                <li
                  key={item.skill}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-gray-800">{item.skill}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColor(item.priority)}`}
                  >
                    {item.priority}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Roadmap */}
          <div className="md:col-span-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">
              AI Learning Roadmap
            </h3>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {result.roadmap}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

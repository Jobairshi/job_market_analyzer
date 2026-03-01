'use client';

import { useState } from 'react';
import { api, SalaryPredictResponse } from '@/lib/api';

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700">{pct}%</span>
    </div>
  );
}

export default function SalaryEstimatorCard() {
  const [skills, setSkills] = useState('');
  const [location, setLocation] = useState('');
  const [experience, setExperience] = useState('mid');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SalaryPredictResponse | null>(null);

  const handlePredict = async () => {
    const skillArr = skills
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (skillArr.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.aiPredictSalary({
        skills: skillArr,
        location: location || undefined,
        experience: experience || undefined,
        title: title || undefined,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Salary Estimator
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          ML-powered salary prediction based on skills, location, experience, and
          job title.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Skills (comma-separated)
            </label>
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="python, react, typescript"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Job Title (optional)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Senior Software Engineer"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Location (optional)
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote, San Francisco, etc."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Experience Level
            </label>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="junior">Junior (0-2 yrs)</option>
              <option value="mid">Mid (3-5 yrs)</option>
              <option value="senior">Senior (6-10 yrs)</option>
              <option value="lead">Lead / Staff (10+ yrs)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handlePredict}
          disabled={loading || skills.trim().length === 0}
          className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Predicting...' : 'Predict Salary'}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Predicted */}
          <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Predicted Salary
            </p>
            <p className="mt-3 text-3xl font-bold text-indigo-600">
              {formatUSD(result.predicted_salary)}
            </p>
          </div>

          {/* Range */}
          <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Salary Range
            </p>
            <p className="mt-3 text-xl font-semibold text-gray-800">
              {formatUSD(result.salary_range.low)} &ndash;{' '}
              {formatUSD(result.salary_range.high)}
            </p>
          </div>

          {/* Confidence */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">
              Confidence
            </p>
            <ConfidenceBar score={result.confidence_score} />
            {result.factors && (
              <ul className="mt-4 space-y-1 text-xs text-gray-600">
                {Object.entries(result.factors).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-medium">{k}:</span> {v}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

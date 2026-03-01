'use client';

/**
 * Recommend panel — AI job recommendations (from /recommend page).
 */

import { useState } from 'react';
import { api, AIRecommendResponse } from '@/lib/api';

export default function RecommendPanel() {
  const [skills, setSkills] = useState('');
  const [location, setLocation] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIRecommendResponse | null>(null);

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      setResult(await api.aiRecommend({
        resume_text: resumeText || undefined,
        preferred_skills: skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        preferred_location: location || undefined,
        top_k: 10,
      }));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Recommendations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Get personalized job recommendations based on your skills, location, and resume.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Preferred Skills</label>
          <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. python, react, docker"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <p className="mt-1 text-xs text-gray-400">Comma-separated</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Preferred Location</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Remote, San Francisco"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Resume Text <span className="text-gray-400">(optional)</span>
          </label>
          <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={3}
            placeholder="Paste your resume text here for better matching..."
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
      </div>

      <button onClick={handleSubmit} disabled={loading || (!skills && !location && !resumeText)}
        className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition">
        {loading ? 'Finding...' : 'Get Recommendations'}
      </button>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Top {result.total} Recommendations</h2>
          <div className="mt-4 space-y-3">
            {result.recommendations.map((job, idx) => {
              const scoreColor = job.final_score >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                : job.final_score >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200'
                : 'text-gray-600 bg-gray-50 border-gray-200';
              return (
                <div key={job.id ?? idx} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{idx + 1}</span>
                        <h3 className="truncate text-base font-semibold text-gray-900">{job.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{job.company} &middot; {job.location}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">Semantic: {job.semantic_similarity}%</span>
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 font-medium text-purple-700">Skill: {job.skill_overlap}%</span>
                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700">Pref: {job.preference_match}%</span>
                      </div>
                      {job.matched_skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {job.matched_skills.map((s) => (
                            <span key={s} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700 border border-green-200">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`flex flex-col items-center rounded-xl border px-3 py-2 ${scoreColor}`}>
                      <span className="text-xl font-bold">{job.final_score}%</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Match</span>
                    </div>
                  </div>
                  {job.link && (
                    <a href={job.link} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition">
                      View Job &rarr;
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

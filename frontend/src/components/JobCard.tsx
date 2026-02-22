import { Job } from '@/lib/api';

export default function JobCard({ job }: { job: Job }) {
  const tags = job.cleaned_tags?.length ? job.cleaned_tags : job.tags ?? [];

  return (
    <article className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition">
            {job.title}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500">
            {job.company ?? 'Unknown company'}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          {job.source}
        </span>
      </div>

      {/* Location */}
      {job.location && (
        <p className="mt-2 text-xs text-gray-400">
          📍 {job.location}
        </p>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 8).map((t) => (
            <span
              key={t}
              className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {t}
            </span>
          ))}
          {tags.length > 8 && (
            <span className="text-xs text-gray-400">+{tags.length - 8}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <time>
          {new Date(job.scraped_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </time>
        <a
          href={job.link}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-indigo-600 hover:underline"
        >
          View&nbsp;listing&nbsp;&rarr;
        </a>
      </div>
    </article>
  );
}

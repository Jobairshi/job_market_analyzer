import Hero from '@/components/Hero';

const features = [
  {
    title: 'Multi-Source Scraping',
    desc: 'Aggregates listings from RemoteOK, We Work Remotely, and Hacker News every 15 minutes.',
    icon: '🔍',
  },
  {
    title: 'Smart Cleaning',
    desc: 'Normalizes text, extracts skills, deduplicates records, and fills missing locations.',
    icon: '🧹',
  },
  {
    title: 'Vector Embeddings',
    desc: 'Encodes every job with a 384-dim sentence-transformer model for semantic search.',
    icon: '🧠',
  },
  {
    title: 'Interactive Dashboards',
    desc: 'Static & interactive charts powered by Matplotlib, Seaborn, and Plotly.',
    icon: '📊',
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
          Platform Highlights
        </h2>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

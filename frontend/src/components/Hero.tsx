import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-white">
      {/* Gradient blob */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg]
                     bg-gradient-to-tr from-indigo-200 to-sky-400 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72rem]"
        />
      </div>

      <div className="mx-auto max-w-3xl py-24 text-center sm:py-32 px-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          AI Job Market <span className="text-indigo-600">Intelligence</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Automated scraping, cleaning, embedding &amp; visualization of AI/ML
          job listings from RemoteOK, We Work Remotely, and Hacker News — all in
          one platform.
        </p>

        <div className="mt-10 flex items-center justify-center gap-x-4">
          <Link
            href="/jobs"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition"
          >
            Browse Jobs
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Create Account
          </Link>
        </div>
      </div>
    </section>
  );
}

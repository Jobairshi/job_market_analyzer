export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-8 mt-auto">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500 sm:px-6 lg:px-8">
        <p>
          &copy; {new Date().getFullYear()} AI Job Market Intelligence Platform
          &mdash; Built with Python, NestJS &amp; Next.js
        </p>
      </div>
    </footer>
  );
}

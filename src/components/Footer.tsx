import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-16 lg:px-10">
      <div className="mx-auto flex max-w-canvas flex-col gap-12 lg:flex-row lg:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-[0.3em]">LAGI</p>
          <p className="mt-3 max-w-sm text-sm text-graphite">LOOK CLOSER.</p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <div>
            <p className="eyebrow mb-4">EXPLORE</p>
            <ul className="flex flex-col gap-2 text-sm text-graphite">
              <li><Link to="/products" className="hover:text-ink focus-ring">Product</Link></li>
              <li><Link to="/ar" className="hover:text-ink focus-ring">AR Experience</Link></li>
              <li><Link to="/story" className="hover:text-ink focus-ring">Story</Link></li>
              <li><Link to="/about" className="hover:text-ink focus-ring">About LAGI</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">CONNECT</p>
            <ul className="flex flex-col gap-2 text-sm text-graphite">
              <li>
                <a href="https://www.instagram.com/lagi.official/" target="_blank" rel="noopener noreferrer" className="hover:text-ink focus-ring">
                  Instagram
                </a>
              </li>
              <li>
                <a href="https://smartstore.naver.com/lagi_official" target="_blank" rel="noopener noreferrer" className="hover:text-ink focus-ring">
                  Smart Store
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">DISPLAY</p>
            <ul className="flex flex-col gap-2 text-sm text-graphite">
              <li><Link to="/exhibition" className="hover:text-ink focus-ring">Exhibition Mode</Link></li>
              <li><Link to="/workspace" className="hover:text-ink focus-ring">Product Workspace</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-canvas text-xs text-stone">
        © {new Date().getFullYear()} LAGI. Product facts shown on this site are limited to information supplied by the brand.
      </div>
    </footer>
  );
}

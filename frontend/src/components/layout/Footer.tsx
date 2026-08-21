
export const Footer = () => {
  return (
    <footer className="w-full bg-slate-950 border-t border-slate-800/50 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-400">Wrench Technologies Inc.</span>
        </div>
        <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm font-medium">
          <a href="#" className="hover:text-slate-300 transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Press
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';

export const NxDomainError: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [hostname, setHostname] = useState('ais-dev-pcxelypp5magvsb6o7dw2z-852331460337.asia-east1.run.app');
  const [fullUrl, setFullUrl] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'ais-dev-pcxelypp5magvsb6o7dw2z-852331460337.asia-east1.run.app';
      setHostname(host);
      setFullUrl(window.location.href);

      // Save previous title and set to raw hostname to match authentic browser error page
      const prevTitle = document.title;
      document.title = host;

      // Detect browser color scheme
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDarkMode(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
      mediaQuery.addEventListener('change', handler);

      return () => {
        document.title = prevTitle;
        mediaQuery.removeEventListener('change', handler);
      };
    }
  }, []);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999999] overflow-y-auto select-none ${
        isDarkMode ? 'bg-[#202124] text-[#e8eaed]' : 'bg-[#ffffff] text-[#202124]'
      }`}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      <div className="max-w-[540px] mx-auto px-6 pt-[12vh] pb-16">
        
        {/* Authentic Chromium sad-page / network error icon */}
        <div className="mb-6">
          <svg 
            width="72" 
            height="72" 
            viewBox="0 0 72 72" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className={isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}
          >
            <path 
              d="M18 12C14.6863 12 12 14.6863 12 18V54C12 57.3137 14.6863 60 18 60H54C57.3137 60 60 57.3137 60 54V24L48 12H18Z" 
              stroke="currentColor" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M48 12V24H60" 
              stroke="currentColor" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            {/* Sad eyes */}
            <circle cx="28" cy="34" r="2.5" fill="currentColor" />
            <circle cx="44" cy="34" r="2.5" fill="currentColor" />
            {/* Sad mouth */}
            <path 
              d="M27 46C31 42 41 42 45 46" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 
          className={`text-[24px] font-normal leading-[1.33] mb-4 tracking-normal ${
            isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'
          }`}
        >
          This site can’t be reached
        </h1>

        {/* Explanation text */}
        <div className={`text-[13px] leading-[1.6] space-y-4 mb-8 ${
          isDarkMode ? 'text-[#9aa0a6]' : 'text-[#5f6368]'
        }`}>
          <p>
            Check if there is a typo in <span className={`font-semibold ${isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}`}>{hostname}</span>.
          </p>

          <ul className="list-disc pl-5 space-y-1">
            <li>If spelling is correct, try running Windows Network Diagnostics.</li>
          </ul>

          {/* Error code */}
          <div className="pt-2 font-mono text-[11px] tracking-wide uppercase opacity-90">
            DNS_PROBE_FINISHED_NXDOMAIN
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4 pt-2">
          {/* Authentic Chrome Reload Button */}
          <button
            onClick={handleReload}
            className={`px-4 py-2 text-[13px] font-medium rounded transition-colors cursor-pointer outline-none focus:ring-2 ${
              isDarkMode 
                ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#93bbf9] focus:ring-[#8ab4f8]/50' 
                : 'bg-[#1a73e8] text-[#ffffff] hover:bg-[#1b66c9] focus:ring-[#1a73e8]/50'
            }`}
            style={{ borderRadius: '4px' }}
          >
            Reload
          </button>

          {/* Authentic Chrome Details Expander */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`text-[13px] flex items-center gap-1.5 hover:underline outline-none cursor-pointer ${
              isDarkMode ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'
            }`}
          >
            <span>Details</span>
            <svg 
              className={`w-3.5 h-3.5 transition-transform duration-150 ${showDetails ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Collapsible Details Drawer */}
        {showDetails && (
          <div className={`mt-6 pt-4 border-t text-[12px] leading-relaxed font-sans ${
            isDarkMode ? 'border-[#3c4043] text-[#9aa0a6]' : 'border-[#dadce0] text-[#5f6368]'
          }`}>
            <p className="mb-2">
              The webpage at <strong className={isDarkMode ? 'text-[#e8eaed]' : 'text-[#202124]'}>{fullUrl || hostname}</strong> might be temporarily down or it may have moved permanently to a new web address.
            </p>
            <p className="font-mono text-[11px] opacity-75">
              Error code: DNS_PROBE_FINISHED_NXDOMAIN
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default NxDomainError;

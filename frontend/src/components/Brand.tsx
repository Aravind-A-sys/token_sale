export function DappMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="36"
      viewBox="0 0 32 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m16 2 13 7.5v16L16 34 3 25.5v-16L16 2Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="m3 9.5 13 8L29 9.5M16 17.5V34M9.5 5.8l13 8v15.8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EthereumMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1 5.5 12 12 15.7 18.5 12 12 1Z" fill="currentColor" opacity=".75" />
      <path d="M12 1v14.7l6.5-3.7L12 1Z" fill="currentColor" />
      <path d="M5.5 13.4 12 23l6.5-9.6-6.5 3.8-6.5-3.8Z" fill="currentColor" opacity=".75" />
      <path d="M12 17.2V23l6.5-9.6-6.5 3.8Z" fill="currentColor" />
    </svg>
  );
}

export function EthereumArtwork() {
  return (
    <svg className="ethereum-artwork" viewBox="0 0 320 300" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id="eth-left"
          x1="121"
          y1="60"
          x2="180"
          y2="168"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7BBA90" />
          <stop offset="1" stopColor="#3D7255" />
        </linearGradient>
        <linearGradient
          id="eth-right"
          x1="180"
          y1="50"
          x2="239"
          y2="154"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C0DCAD" />
          <stop offset="1" stopColor="#91B88A" />
        </linearGradient>
        <linearGradient
          id="eth-bottom"
          x1="180"
          y1="162"
          x2="221"
          y2="234"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#66966A" />
          <stop offset="1" stopColor="#BDDAAB" />
        </linearGradient>
        <radialGradient id="eth-glow">
          <stop stopColor="#ACC995" stopOpacity=".35" />
          <stop offset="1" stopColor="#ACC995" stopOpacity="0" />
        </radialGradient>
        <filter id="eth-shadow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <circle cx="185" cy="150" r="139" fill="url(#eth-glow)" />
      <ellipse
        cx="181"
        cy="230"
        rx="51"
        ry="11"
        fill="#2B5939"
        opacity=".18"
        filter="url(#eth-shadow)"
      />
      <ellipse
        cx="183"
        cy="163"
        rx="124"
        ry="69"
        transform="rotate(-25 183 163)"
        stroke="#A8BF9B"
        strokeOpacity=".65"
      />
      <ellipse
        cx="183"
        cy="163"
        rx="99"
        ry="113"
        transform="rotate(-25 183 163)"
        stroke="#B2C7A6"
        strokeOpacity=".45"
        strokeDasharray="3 6"
      />
      <path d="M54 228h13M60.5 221.5v13M272 58h12M278 52v12" stroke="#729663" strokeWidth="1.5" />
      <circle cx="81" cy="93" r="4" fill="#769C68" />
      <circle cx="279" cy="193" r="4.5" fill="#789565" />
      <circle cx="98" cy="242" r="2" fill="#C1D1AF" />
      <g transform="rotate(9 180 148)">
        <path d="m182 38 61 108-61 36-61-36L182 38Z" fill="#325D3F" />
        <path
          d="m176 31-59 107 59 35V31Z"
          fill="url(#eth-left)"
          stroke="#609169"
          strokeWidth=".5"
        />
        <path
          d="m176 31 59 107-59 35V31Z"
          fill="url(#eth-right)"
          stroke="#ADCDA0"
          strokeWidth=".5"
        />
        <path d="m176 112-59 26 59 35v-61Z" fill="#244F3C" opacity=".85" />
        <path d="m176 112 59 26-59 35v-61Z" fill="#547C53" />
        <path d="m121 155 61 36 61-36-61 85-61-85Z" fill="#315B3A" />
        <path d="m117 151 59 35v49l-59-84Z" fill="#447753" />
        <path d="m235 151-59 35v49l59-84Z" fill="url(#eth-bottom)" />
        <path d="M176 31v81M176 186v49" stroke="#D2E6C0" strokeOpacity=".4" />
      </g>
      <rect
        x="241"
        y="235"
        width="10"
        height="10"
        rx="2"
        transform="rotate(20 241 235)"
        fill="#D3DFC3"
      />
    </svg>
  );
}

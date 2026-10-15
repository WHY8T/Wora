type LogoProps = {
  /** Width in pixels (height follows the logo's aspect ratio). */
  size?: number;
  className?: string;
};

/** The Wora "W" mark. Draws in the current text colour. */
export function WoraLogo({ size = 24, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="186 162 228 136"
      width={size}
      height={(size * 136) / 228}
      className={className}
      role="img"
      aria-label="Wora"
    >
      <g strokeLinecap="round" strokeWidth={45} fill="none" stroke="currentColor">
        <line x1="391.5" y1="184.5" x2="337.5" y2="275.5" strokeOpacity={0.43} />
        <line x1="208.5" y1="184.5" x2="261.5" y2="275.5" />
        <line x1="285.5" y1="184.5" x2="337.5" y2="275.5" />
      </g>
      <circle cx="391.5" cy="184.5" r="22.5" fill="currentColor" />
    </svg>
  );
}

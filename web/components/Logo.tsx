type Props = {
  size?: number;
  withWord?: boolean;
  wordClass?: string;
};

export default function Logo({ size = 36, withWord = true, wordClass = 'font-serif text-[17px] leading-none text-ink' }: Props) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden className="shrink-0 drop-shadow-sm">
        <rect width="40" height="40" rx="11" fill="#5B21B6" />
        <path
          d="M9.5 28.5c1.2-8.2 6.4-14.2 13.8-13.4 4.6.5 7.2 3.8 7.7 8.2"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="9.5" cy="28.5" r="2.4" fill="white" />
        <path
          d="M31 16.2c-2.7 0-4.9 2.1-4.9 4.7 0 3.5 4.9 8.1 4.9 8.1s4.9-4.6 4.9-8.1c0-2.6-2.2-4.7-4.9-4.7Z"
          fill="#F43F5E"
        />
        <circle cx="31" cy="20.7" r="1.55" fill="white" />
      </svg>
      {withWord ? <p className={wordClass}>Routify</p> : <span className="sr-only">Routify</span>}
    </div>
  );
}

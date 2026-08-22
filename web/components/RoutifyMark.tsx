type Props = {
  size?: number;
  className?: string;
};

/** Circular route mark — same icon as Routify wordmark. */
export default function RoutifyMark({ size = 36, className = 'shrink-0 text-ink' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="20" cy="20" r="17.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12.25 11.75C12.25 11.75 27.75 11.75 27.75 20C27.75 28.25 12.25 28.25 12.25 28.25"
        stroke="currentColor"
        strokeWidth="5.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import RoutifyMark from '@/components/RoutifyMark';

type Props = {
  size?: number;
  withWord?: boolean;
  withTagline?: boolean;
  wordClass?: string;
};

export default function Logo({
  size = 36,
  withWord = true,
  withTagline = false,
  wordClass = 'font-brand text-[17px] font-extrabold leading-none tracking-tight text-ink',
}: Props) {
  return (
    <div className="flex items-center gap-2.5">
      <RoutifyMark size={size} />
      {withWord ? (
        <div className="min-w-0">
          <p className={wordClass}>Routify</p>
          {withTagline ? (
            <p className="mt-0.5 text-[10px] leading-none text-muted">Your safety our priority</p>
          ) : null}
        </div>
      ) : (
        <span className="sr-only">Routify</span>
      )}
    </div>
  );
}

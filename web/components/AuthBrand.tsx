import { Footprints, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import Logo from '@/components/Logo';

export default function AuthBrand() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-slate-200 bg-white px-12 py-14 lg:flex lg:flex-col lg:justify-between">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 16% 18%, rgba(132,204,22,0.28), transparent 40%), radial-gradient(circle at 82% 24%, rgba(244,63,94,0.12), transparent 38%), radial-gradient(circle at 70% 78%, rgba(245,158,11,0.16), transparent 42%)',
        }}
      />
      <div className="relative">
        <Logo size={40} wordClass="font-serif text-xl leading-none text-ink" />
        <h1 className="mt-16 max-w-md font-serif text-[42px] leading-[1.12] text-ink">
          The shortest walk is not always the safest one at night.
        </h1>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
          Routify helps you walk through Indian cities with three clear choices — faster, mixed, or safer streets.
        </p>
      </div>
      <ul className="relative grid max-w-lg grid-cols-3 gap-3">
        {[
          { icon: Footprints, title: 'Three walks', body: 'Fast, mixed, or the safest streets.' },
          { icon: ShieldCheck, title: 'Easy score', body: '0 to 100 so you know how it feels.' },
          { icon: SlidersHorizontal, title: 'Your rules', body: 'Skip dark or empty roads if you want.' },
        ].map((item) => (
          <li
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-800">
              <item.icon size={16} strokeWidth={1.75} />
            </span>
            <p className="mt-4 text-[16px] font-semibold tracking-tight text-ink">{item.title}</p>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

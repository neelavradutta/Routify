import AuthBrand from '@/components/AuthBrand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <AuthBrand />
      <section className="flex items-center justify-center bg-ground px-6 py-12">{children}</section>
    </main>
  );
}

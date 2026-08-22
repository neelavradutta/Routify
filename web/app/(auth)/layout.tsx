import AuthBrand from '@/components/AuthBrand';
import AuthFlow from '@/components/AuthFlow';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthFlow>
      <AuthBrand />
      <section className="flex items-center justify-center bg-ground px-6 py-12">{children}</section>
    </AuthFlow>
  );
}

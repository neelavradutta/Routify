'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthCard from '@/components/AuthCard';
import { useApp } from '@/store/useApp';

export default function LoginPage() {
  const router = useRouter();
  const { token, ready, restore } = useApp();

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (ready && token) router.replace('/');
  }, [ready, token, router]);

  return <AuthCard mode="login" />;
}

'use client';

import Login from '@/components/Login';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStytchMember, useStytchMemberSession } from '@stytch/nextjs/b2b';

export default function AuthenticatePage() {
  const { member, isInitialized } = useStytchMember();
  const { session } = useStytchMemberSession();
  const router = useRouter();

  // Log authentication state for debugging
  useEffect(() => {
    console.log('Authenticate Page - Auth State:', {
      isInitialized,
      hasMember: !!member,
      hasSession: !!session,
      memberId: member?.member_id,
      orgId: session?.organization_id
    });
  }, [isInitialized, member, session]);

  // If the Stytch SDK has an active member session, redirect to dashboard
  useEffect(() => {
    if (isInitialized && member) {
      console.log('Redirecting authenticated user to dashboard');
      router.replace('/dashboard');
    }
  }, [member, isInitialized, router]);

  return <Login />;
}

'use client';

import React, { useEffect } from 'react';
import { StytchB2B } from '@stytch/nextjs/b2b';
import { useStytchB2BClient } from '@stytch/nextjs/b2b';
import { discoveryConfig, discoveryStyles } from '@/lib/stytchConfig';
import './Login.css';

/*
 * Login configures and renders the StytchLogin component which is a prebuilt UI component for auth powered by Stytch.
 *
 * This component accepts style, config, and callbacks props. To learn more about possible options review the documentation at
 * https://stytch.com/docs/b2b/sdks/ui-config
 */

const Login = () => {
  const stytchClient = useStytchB2BClient();

  // Hook to log session tokens for debugging
  useEffect(() => {
    try {
      const tokens = stytchClient.session.getTokens();
      console.log('DEBUG - Session tokens available:', !!tokens);
      if (tokens) {
        console.log('Session token type:', typeof tokens.session_token);
        console.log('JWT token type:', typeof tokens.session_jwt);
      }
    } catch (error) {
      console.error('Error getting session tokens:', error);
    }
  }, [stytchClient.session]);

  // Configure callbacks
  const callbacks = {
    onEvent: (event: any) => {
      console.log('Stytch Event:', event);
    },
    onSuccess: (data: any) => {
      console.log('Stytch Login Success:', data);
      window.location.href = '/dashboard';
    },
    onError: (error: any) => {
      console.error('Stytch Login Error:', error);
    }
  };

  return (
    <div className="centered-login">
      <StytchB2B
        config={discoveryConfig}
        styles={discoveryStyles}
        callbacks={callbacks}
      />
    </div>
  );
};

export default Login;

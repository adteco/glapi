'use client';

import { SubmitButton } from '@/components/forms/submit-button'
import { Turnstile } from '@marsidev/react-turnstile'
import { useState, useRef } from 'react'

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState<string | null>(null); 
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!token) {
      setStatus('error');
      setMessage('Please complete the CAPTCHA');
      return;
    }

    try {
      setStatus('loading');
      const formData = new FormData(e.currentTarget);
      const payload = {
        name: formData.get('name'),
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message'),
        token,
      };
      
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setStatus('success');
      setMessage('Message sent successfully!');
      formRef.current?.reset();
      setToken(null);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  return (
    <form ref={formRef} className="max-w-xl mx-auto" onSubmit={handleSubmit}>
      {status !== 'idle' && (
        <div 
          className={`mb-4 ${status === 'error' ? 'text-red-500' : 'text-green-500'}`}
          role="alert"
        >
          {message}
        </div>
      )}
      <div className="flex flex-wrap -mx-3 mb-4">
        <div className="w-full md:w-1/2 px-3 mb-4 md:mb-0">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1" htmlFor="first-name">First Name <span className="text-red-600">*</span></label>
          <input id="first-name" type="text" name="name" className="form-input w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your first name" required />
        </div>
        <div className="w-full md:w-1/2 px-3">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1" htmlFor="last-name">Last Name <span className="text-red-600">*</span></label>
          <input id="last-name" type="text" name="last-name" className="form-input w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter your last name" required />
        </div>
      </div>
      <div className="flex flex-wrap -mx-3 mb-4">
        <div className="w-full px-3">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1" htmlFor="email">Email <span className="text-red-600">*</span></label>
          <input id="email" type="email" name="email" className="form-input w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="you@yourcompany.com" required />
        </div>
      </div>
      <div className="flex flex-wrap -mx-3 mb-4">
        <div className="w-full px-3">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1" htmlFor="subject">Subject <span className="text-red-600">*</span></label>
          <input id="subject" type="text" name="subject" className="form-input w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="How can we help you?" required />
        </div>
      </div>
      <div className="flex flex-wrap -mx-3 mb-4">
        <div className="w-full px-3">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-1" htmlFor="message">Message <span className="text-red-600">*</span></label>
          <textarea id="message" name="message" className="form-input w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="Your message" required rows={4} />
        </div>
      </div>
      <div className="flex flex-col items-center space-y-4">
        <SubmitButton disabled={status === 'loading'}>
          Send Message
        </SubmitButton>
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || ''}
          onSuccess={setToken}
          onError={() => setToken(null)}
          className="mx-auto"
        />
      </div>
    </form>
  );
}
'use client';

import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { ShieldCheck, Mail, Phone, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      alert('Thank you for your message! We\'ll get back to you soon.');
      setFormData({ name: '', email: '', company: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <ShieldCheck className="h-8 w-8 text-sky-400" />
          <span className="text-xl font-bold">GLAPI</span>
        </Link>
        
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/product" className="text-gray-300 hover:text-white transition-colors">
            Product
          </Link>
          <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/docs" className="text-gray-300 hover:text-white transition-colors">
            Docs
          </Link>
          <Link href="/contact" className="text-white font-semibold">
            Contact
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <SignInButton mode="modal">
            <button className="text-gray-300 hover:text-white transition-colors">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 transition-colors duration-200">
              Get Started
            </button>
          </SignUpButton>
        </div>
      </nav>

      {/* Header */}
      <div className="relative px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Get in Touch
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Have questions about GLAPI? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>
      </div>

      {/* Contact Form and Info */}
      <div className="relative px-6 lg:px-8 pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8">
                <h2 className="text-2xl font-semibold text-white mb-6">Send us a message</h2>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">
                      Company
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Your company name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                      Subject *
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="">Select a subject</option>
                      <option value="sales">Sales Inquiry</option>
                      <option value="support">Technical Support</option>
                      <option value="partnership">Partnership</option>
                      <option value="general">General Question</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                      placeholder="Tell us about your needs..."
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-8">
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8">
                <h3 className="text-xl font-semibold text-white mb-6">Contact Information</h3>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <Mail className="h-6 w-6 text-sky-400 mt-1" />
                    <div>
                      <h4 className="font-medium text-white">Email</h4>
                      <p className="text-gray-300">support@glapi.com</p>
                      <p className="text-gray-300">sales@glapi.com</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <Phone className="h-6 w-6 text-sky-400 mt-1" />
                    <div>
                      <h4 className="font-medium text-white">Phone</h4>
                      <p className="text-gray-300">+1 (555) 123-4567</p>
                      <p className="text-sm text-gray-400">Mon-Fri 9AM-6PM PST</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <MapPin className="h-6 w-6 text-sky-400 mt-1" />
                    <div>
                      <h4 className="font-medium text-white">Office</h4>
                      <p className="text-gray-300">
                        123 Business Center<br />
                        San Francisco, CA 94105<br />
                        United States
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4">
                    <Clock className="h-6 w-6 text-sky-400 mt-1" />
                    <div>
                      <h4 className="font-medium text-white">Business Hours</h4>
                      <p className="text-gray-300">Monday - Friday: 9:00 AM - 6:00 PM PST</p>
                      <p className="text-gray-300">Saturday - Sunday: Closed</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8">
                <h3 className="text-xl font-semibold text-white mb-4">Quick Links</h3>
                <div className="space-y-3">
                  <Link href="/docs" className="block text-sky-400 hover:text-sky-300 transition-colors">
                    API Documentation →
                  </Link>
                  <Link href="/pricing" className="block text-sky-400 hover:text-sky-300 transition-colors">
                    View Pricing Plans →
                  </Link>
                  <Link href="/security" className="block text-sky-400 hover:text-sky-300 transition-colors">
                    Security Information →
                  </Link>
                  <a href="mailto:support@glapi.com" className="block text-sky-400 hover:text-sky-300 transition-colors">
                    Technical Support →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
import type { Metadata } from 'next'
import { ContactForm } from './contact-form'

export const metadata: Metadata = {
  title: 'Contact Us - Adteco',
  description: 'Get in touch with us',
}

export default function ContactPage() {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-16">
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tighter tracking-tighter mb-4" data-aos="zoom-y-out">
              Let's <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">Connect</span>
            </h1>
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-gray-300 mb-4" data-aos="zoom-y-out" data-aos-delay="100">
              We're Here to Help
            </h2>
            <p className="text-xl text-gray-400" data-aos="fade-up" data-aos-delay="200">
              Have a question or want to work with us? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
          <ContactForm />
        </div>
      </div>
    </section>
  )
}
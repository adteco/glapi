import Image from 'next/image'

import HeroImage from '@/public/images/about-hero.jpg'

export default function HeroAbout() {
  return (
    <section className="relative">

      {/* Background image */}
      <div className="absolute inset-0">
        <Image className="w-full h-full object-cover" src={HeroImage} width={1440} height={394} priority alt="About" />
        <div className="absolute inset-0 bg-gray-900 opacity-75" aria-hidden="true"></div>
      </div>

      {/* Hero content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="h1 mb-4" data-aos="fade-up">Privacy Policy</h1>
            <p className="text-xl text-gray-400 mb-8" data-aos="fade-up" data-aos-delay="200">At Adteco, we value your privacy and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data when you use our services. We strive for transparency in our practices and aim to give you control over your information.</p>
          </div>
        </div>
      </div>

    </section>
  )
}

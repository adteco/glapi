import React from 'react';

export const metadata = {
  title: 'Security - Adteco',
  description: "Learn about Adteco's security practices.",
}

export default function SecurityPage() {
  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">

          {/* Page header */}
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-20">
            <h1 className="h1 mb-4">Security at Adteco</h1>
            <p className="text-xl text-gray-400">Our commitment to protecting your data.</p>
          </div>

          {/* Content */}
          <div className="max-w-3xl mx-auto">
            <div className="space-y-8">

              <div>
                <h2 className="h3 mb-2">Encryption</h2>
                <p className="text-gray-400 mb-4">All customer interaction with Adteco servers is encrypted through the use of SSL/TLS. Our certificates use industry-standard encryption (typically 256-bit) to protect your data in transit. Data is encrypted at rest with AES-256, block-level storage encryption where applicable.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Disaster Recovery</h2>
                <p className="text-gray-400 mb-4">Data is backed up regularly (typically daily) for recovery from disasters. Our infrastructure providers offer robust disaster recovery mechanisms. Our recovery point objective (RPO) in the event of a disaster is generally within 24 hours. Due to the nature of our services and infrastructure, specific Recovery Time Objectives (RTO) may vary.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Data Retention and Location</h2>
                <p className="text-gray-400 mb-4">Adteco stores the minimum amount of data required to provide our services effectively. Customer data necessary for service operation is retained by Adteco. Sensitive details like full credit card numbers are typically handled by PCI-compliant service partners (e.g., Stripe).</p>
                <p className="text-gray-400 mb-4">Adteco securely retains data for the duration necessary to provide the service or as required by law, unless deletion is requested by the authorized account owner or mandated by regulation. Servers housing data are primarily located within the United States.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Financial Security</h2>
                <p className="text-gray-400 mb-4">Sensitive payment details (like full credit card or bank account numbers) are generally not stored directly by Adteco systems. All sensitive payment details are transmitted directly to our payment providers (e.g., Stripe) over encrypted connections (SSL/TLS). These providers are typically PCI-DSS Level 1 compliant.</p>
                 <p className="text-gray-400 mb-4">Access to billing information within Adteco is restricted. Attempts to change payout information or other sensitive financial settings may trigger verification checks.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Password Security</h2>
                <p className="text-gray-400 mb-4">Password security is maintained through hashing and best practices like minimum password lengths and complexity requirements where applicable. Account lockout mechanisms may be employed after repeated failed login attempts.</p>
                <p className="text-gray-400 mb-4">To maximize your safety, Adteco recommends using strong, unique passwords for your account. Consider using a password manager (e.g., 1Password, LastPass) to manage your passwords securely.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Physical Security</h2>
                <p className="text-gray-400 mb-4">Adteco's production systems primarily run on major cloud computing platforms like Amazon Web Services (AWS) and Vercel. These providers maintain high standards of physical security for their data centers. Please refer to their respective security documentation for details.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Network Security</h2>
                <p className="text-gray-400 mb-4">Adteco employs various network security measures, including firewalls and intrusion detection/prevention systems where appropriate. We utilize services like Cloudflare for enhanced security and DDoS mitigation.</p>
                <p className="text-gray-400 mb-4">We conduct regular security assessments, which may include penetration testing, to identify and address potential vulnerabilities.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Vulnerability Management</h2>
                <p className="text-gray-400 mb-4">Software libraries and dependencies used by Adteco are actively monitored and kept up to date. Security fixes or patches are treated with high priority and applied promptly based on risk assessment.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Accreditation</h2>
                <p className="text-gray-400 mb-4">While Adteco itself may not hold specific certifications like SOC 2 currently, we rely on subprocessors who often maintain various security certifications (e.g., SOC 2, ISO 27001, PCI-DSS). Please review our sub-processor list for details on security accreditations held by our key partners.</p>
              </div>

              <div>
                <h2 className="h3 mb-2">Support and Development</h2>
                <p className="text-gray-400 mb-4">Application development and support activities are primarily based in the United States (MST). We strive to maintain high availability for our services. Planned maintenance, if required, will be communicated in advance whenever possible.</p>
                <p className="text-gray-400 mb-4">Support is available during standard business hours (MST). We endeavor to respond to support queries in a timely manner.</p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
} 
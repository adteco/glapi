import React from 'react';
import { Metadata } from 'next'
import HeroPrivacyPolicy from './hero-privacy-policy'
import PrivacyPolicyContent from './privacy-policy-content'

export const metadata: Metadata = {
  title: 'Privacy Policy - Adteco',
  description: 'Learn about Adteco\'s privacy practices.',
}

export default function PrivacyPolicyPage() {
  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">

          {/* Page header */}
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-16">
            <h1 className="h1 text-5xl md:text-6xl font-extrabold leading-tighter tracking-tighter mb-4" data-aos="zoom-y-out">Privacy Policy</h1>
            <p className="text-xl text-gray-400 mb-2">We take your privacy and protection of personal data very seriously.</p>
            <p className="text-sm text-gray-500">Last updated: December 12, 2024</p> {/* TODO: Update date dynamically or manually */}
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto text-gray-400">
            <div className="prose prose-lg prose-invert max-w-none">

              <h2 id="welcome">Welcome!</h2>
              <p>Welcome to Adteco! We hope you will enjoy and appreciate visiting or using our Website or using our Services. This Privacy Policy (the "Policy") tells you about who we are, what personal data we collect, and what we do with it while you visit the Website, use the Services, or otherwise interact with us. The Policy also explains your privacy and data rights under the law.</p>
              <p>Please read this Policy carefully. By using our Website or Services, you agree to be bound by this Policy.</p>
              <p>References to "you" or "your" are to you as an individual using our website or otherwise contacting us.</p>

              <h2 id="terms">Some important terms</h2>
              <ul>
                <li><strong>Data Protection Laws:</strong> Laws designed to protect your personal data and privacy where you live. These may include GDPR (Europe), CCPA (California), PIPEDA (Canada), AU Privacy Act (Australia), NZ Privacy Act (New Zealand), POPIA (South Africa), UK GDPR & DPA (United Kingdom), and others. Adteco is committed to adhering to applicable Data Protection laws.</li>
                <li><strong>Personal data:</strong> Information about an individual from which that person can be identified (e.g., name, email, online identifier). This includes "personal information" under various laws.</li>
              </ul>
              <p>Other terms may be found in our Terms of Service.</p>

              <h2 id="about-us">About us</h2>
              <p>Adteco refers to Adteco, LLC, a US-based company, and any relevant subsidiaries or affiliates within the Adteco group responsible for processing your data. Adteco, LLC is the primary controller responsible for this Website.</p>
              <p>Under GDPR and POPIA, Adteco acts as a "data controller" or "responsible party," meaning we collect personal data and determine how it's processed. When we process data because you use our services through one of our customers (e.g., as their employee or client), we act as a "data processor" on their behalf. In such cases, refer to our customer's privacy policy.</p>

              <h2 id="contacting-us">Contacting us</h2>
              <p>For privacy-related questions or to exercise your rights, contact:</p>
              <p><strong>Adteco Privacy Contact</strong><br />
              Email: <a href="mailto:privacy@adteco.com">privacy@adteco.com</a> {/* TODO: Confirm/create this email */}</p>
              <p>Mailing Address:<br />
              {/* TODO: Add Adteco's mailing address */}
              [Adteco Mailing Address Here]</p>
              <p>For questions about the Website or Services, email <a href="mailto:support@adteco.com">support@adteco.com</a>.</p>

              <h2 id="your-rights">Your legal rights</h2>
              <p>Depending on your location and applicable Data Protection Laws (like GDPR, CCPA, etc.), you may have rights including:</p>
              <ul>
                <li><strong>Access:</strong> Request a copy of your personal data.</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
                <li><strong>Erasure:</strong> Request deletion of your data under certain conditions.</li>
                <li><strong>Object to processing:</strong> Object to processing based on legitimate interests or for direct marketing.</li>
                <li><strong>Restrict processing:</strong> Request suspension of processing under certain scenarios.</li>
                <li><strong>Data portability:</strong> Request transfer of your data in a machine-readable format.</li>
                <li><strong>Withdraw consent:</strong> Withdraw consent where processing relies on it (this doesn't affect past processing).</li>
                <li><strong>Be notified:</strong> Be informed about data collection and breaches.</li>
                <li><strong>Opt-out:</strong> Opt out of marketing or the sale/sharing of your data (Adteco does not sell your personal data).</li>
                <li><strong>Non-discrimination:</strong> Not be discriminated against for exercising privacy rights.</li>
                <li><strong>Complain:</strong> Lodge a complaint with a supervisory authority.</li>
              </ul>
              <p>To exercise these rights, please contact us. We generally do not charge a fee, but may charge for unfounded, repetitive, or excessive requests. We aim to respond within one month, potentially longer for complex requests. We may need to verify your identity.</p>

              <h2 id="data-collected">The personal data we collect about you</h2>
              <p>We may collect, use, store, and transfer:</p>
              <ul>
                <li><strong>Identity Data:</strong> Name, username, title, company, location, etc.</li>
                <li><strong>Contact Data:</strong> Billing address, email, phone number.</li>
                <li><strong>Financial Data:</strong> Payment card details (processed by partners like Stripe), bank account information (if applicable).</li>
                <li><strong>Transaction Data:</strong> Details about payments and services purchased.</li>
                <li><strong>Technical Data:</strong> IP address, login data, browser type/version, device information, etc.</li>
                <li><strong>Profile Data:</strong> Username/password (hashed), preferences, feedback.</li>
                <li><strong>Usage Data:</strong> How you use our website and services.</li>
                <li><strong>Marketing and Communications Data:</strong> Marketing preferences, communication history.</li>
              </ul>

              <h2 id="how-collected">How your personal data is collected</h2>
              <ul>
                <li><strong>Direct interactions:</strong> Filling forms, creating accounts, contacting us.</li>
                <li><strong>Automated technologies:</strong> Cookies, server logs, analytics tools (see Cookie Policy).</li>
                <li><strong>Third parties:</strong> Analytics providers (Google Analytics), payment processors (Stripe), data brokers (if applicable), public sources, third-party applications you connect.</li>
              </ul>
              <p>When you visit our site, online partners may associate your activity with other information (like your email) for targeted communications. Opt-out options are available (e.g., via <a href="https://app.retention.com/optout" target="_blank" rel="noopener noreferrer">https://app.retention.com/optout</a>).</p>

              <h2 id="how-used">How we use your personal data</h2>
              <p>We use your data only when legally permitted, primarily:</p>
              <ul>
                <li><strong>To perform a contract:</strong> Provide services, manage accounts, process payments.</li>
                <li><strong>For legitimate interests:</strong> Improve services, manage our business, prevent fraud, marketing analysis, customer support (ensuring your rights are not overridden).</li>
                <li><strong>To comply with legal obligations.</strong></li>
                <li><strong>With your consent:</strong> Primarily for third-party direct marketing (you can withdraw consent).</li>
              </ul>
              <p>Specific uses include:</p>
              <ul>
                <li>Registering new customers and managing relationships.</li>
                <li>Providing and improving the Website and Services, including support.</li>
                <li>Processing transactions and managing payments (via partners).</li>
                <li>Administering and protecting our business and website (security, troubleshooting).</li>
                <li>Delivering relevant content and advertising (analyzing effectiveness).</li>
                <li>Using data analytics to improve user experience and marketing.</li>
                <li>Making service recommendations based on your usage.</li>
              </ul>
              <p>Failure to provide necessary data may prevent us from fulfilling contracts (e.g., providing services).</p>
              <p>Financial Data for billing is handled by secure Payment Processors (e.g., Stripe) and not stored on Adteco servers.</p>

              <h2 id="change-purpose">Change of purpose</h2>
              <p>We only use your data for the purposes collected, unless we reasonably consider a need for another compatible reason. We will notify you and explain the legal basis if using data for an unrelated purpose. We may process data without knowledge or consent where required/permitted by law.</p>

              <h2 id="aggregated-data">Aggregated Data</h2>
              <p>We may use aggregated, anonymized data (which doesn't identify you) for statistical purposes indefinitely (e.g., calculating usage percentages).</p>

              <h2 id="special-categories">Special Categories of Personal Data</h2>
              <p>We do not intentionally collect sensitive data (race, religion, health, etc.) or criminal conviction information. Please do not provide this. If you voluntarily provide it, you explicitly consent to its processing as permitted by law.</p>

              <h2 id="data-transfers">Who we transfer your personal data to</h2>
              <p>We may share data with:</p>
              <ul>
                <li><strong>Internal Adteco entities:</strong> For operational purposes.</li>
                <li><strong>External third parties:</strong>
                  <ul>
                    <li>Professional advisers (lawyers, auditors, insurers).</li>
                    <li>Law enforcement or regulators (if legally required).</li>
                    <li>Service providers (subprocessors) like cloud hosting (AWS, Vercel), payment processing (Stripe), CRM (HubSpot - if used), analytics (Google Analytics, PostHog), communication (Slack - if used for support), authentication (Clerk), etc. See our <a href="/subprocessors">Subprocessors page</a> for a list.</li>
                    <li>Potential buyers/partners in a business sale/merger.</li>
                  </ul>
                </li>
              </ul>
              <p>We require third parties to respect data security and process it only for specified purposes under our instruction. We do not sell your personal data.</p>
              <p>Subprocessors include:</p>
              <ul>
                <li>Email/Communication: (e.g., HubSpot, Postmark, Slack - specify if used)</li>
                <li>Infrastructure/Hosting: AWS, Vercel, Supabase, Cloudflare, Upstash, GitHub</li>
                <li>Analytics: Google Analytics, PostHog</li>
                <li>Payment: Stripe</li>
                <li>Authentication: Clerk</li>
                <li>Support: (e.g., Intercom, Zendesk - specify if used)</li>
                <li>Advertising Networks: Google, Facebook, LinkedIn (specify if used)</li>
                <li>Referral Programs: (e.g., PartnerStack - specify if used)</li>
                <li>Business Systems: NetSuite, Procore, BigCommerce, Loren Data</li>
              </ul>

              <h2 id="international-transfers">Transfer of personal data outside of your region</h2>
              <p>Sharing data within Adteco or with third parties may involve transferring data internationally (e.g., outside the EEA, UK, South Africa). We ensure similar protection by using safeguards like:</p>
              <ul>
                <li>Transferring to countries deemed adequate by relevant authorities.</li>
                <li>Using Standard Contractual Clauses (SCCs) or other approved mechanisms where adequacy decisions don't exist.</li>
                <li>Relying on binding corporate rules where applicable.</li>
              </ul>
              <p>Our primary operations and data hosting are in the US. Transfers to partners in other regions (like Canada, Australia) are done ensuring compliance with Data Protection Laws. You can request not to have data transferred internationally, but this may limit service usability.</p>

              <h2 id="marketing">Marketing and promotional material from us</h2>
              <p>We may send marketing communications if you've requested information, purchased services, or opted in. We use your data to personalize relevant offers.</p>
              <p>You can opt-out of marketing messages at any time by contacting us or using unsubscribe links. Opting out of marketing does not opt you out of essential service-related communications.</p>
              <p>Text messaging opt-in data and consent are not shared with third parties.</p>

              <h2 id="third-party-marketing">Third-party marketing and advertisements</h2>
              <p>We do not share your personal data with third parties for their marketing purposes without your explicit opt-in consent.</p>
              <p>We may use advertising networks (e.g., Google Ads, LinkedIn Ads - specify if used) to show you relevant ads based on your interaction with our site. Opt-out options are available via ad settings on those platforms or tools like WebChoices. See our Cookie Policy.</p>

              <h2 id="opting-out">Opting out</h2>
              <p>You can ask us or third parties to stop marketing communications at any time. This doesn't affect processing before withdrawal or essential service communications.</p>

              <h2 id="cookies">Tracking technology ("cookies" and other similar technologies)</h2>
              <p>We use cookies and similar tech. You can manage browser settings to refuse cookies, but some site parts may not function. See our <a href="/cookie-policy">Cookie Policy</a> for details. {/* TODO: Create /cookie-policy page */}</p>

              <h2 id="analytics-security">Limited gathering of personal data for statistical, analytical and security purposes</h2>
              <p>We use analytics tools (Google Analytics, PostHog) to understand usage patterns and improve services. Technical Data collected may also be used for security purposes (fraud detection, violation investigation).</p>

              <h2 id="email-spam">Email communications and compliance with anti-spam laws</h2>
              <p>We use email service providers (e.g., Postmark, HubSpot - specify if used) to manage lists and send communications. Data is transferred securely for these purposes. You can unsubscribe from marketing emails via links provided. Transactional emails are necessary for service use.</p>
              <p>Our email practices comply with anti-spam laws (CAN-SPAM, CASL, etc.). Contact us if you believe you received spam.</p>

              <h2 id="notifications">Push notifications and email notifications</h2>
              <p>We may send email notifications related to service functions or support (e.g., via integrated tools). Manage notification preferences where available (e.g., device settings for push, account settings for email).</p>

              <h2 id="data-security">How we protect your personal data</h2>
              <p>We implement strict technical and organizational measures to protect your data from loss, unauthorized access, or misuse. Access is limited to those with a business need-to-know, bound by confidentiality.</p>
              <p>We have procedures for suspected data breaches and will notify you and authorities as legally required.</p>
              <p>We use industry best practices (encryption like SSL/TLS) and secure third-party vendors (AWS, Vercel, Stripe for PCI-DSS compliant payments). See our <a href="/security">Security page</a> for more details.</p>

              <h2 id="supervisory-authorities">Supervisory authorities and complaints</h2>
              <p>You have the right to complain to a data protection supervisory authority in your jurisdiction (e.g., ICO in the UK, FTC in the US, or relevant EU DPA). We appreciate the chance to address concerns first, so please contact us initially.</p>

              <h2 id="data-retention">Data retention</h2>
              <p>We keep personal data only as long as necessary for the purposes collected, including legal, accounting, or reporting requirements. Retention periods consider data amount, nature, sensitivity, potential harm risk, processing purposes, and legal requirements.</p>
              <p>We may retain data longer if there's a complaint or potential litigation. You can request deletion (see 'Your legal rights'). We may anonymize data for research/statistical use indefinitely.</p>

              <h2 id="automated-decision-making">Automated decision-making</h2>
              <p>We generally do not use automated decision-making that has significant legal effects. If we implement such processes (e.g., for personalized offers), we will update this policy. You typically have rights to obtain explanations, challenge decisions, and request human intervention in such cases.</p>

              <h2 id="policy-changes">Changes to this Policy and your duty to inform us of changes</h2>
              <p>This Policy was last updated on the date at the top. We review and update it at least annually. Find the latest version here. Significant changes will be notified via the Website/Services and email (if you have an account).</p>
              <p>It's important your data is accurate. Please inform us of changes during our relationship.</p>

              <h2 id="childrens-privacy">Children's privacy statement</h2>
              <p>Our Website and Services are not intended for children under 18. We do not knowingly collect data from children under 18. If we learn we have, we will delete it.</p>

              <h2 id="third-party-links">Third party links</h2>
              <p>Our website may link to third-party sites. We don't control them and aren't responsible for their privacy practices. Read their policies when leaving our site.</p>

            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
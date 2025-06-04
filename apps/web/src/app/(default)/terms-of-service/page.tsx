import React from 'react';
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - GLAPI',
  description: 'Read the terms of service for using GLAPI.',
}

export default function TermsOfServicePage() {
  return (
    <section className="relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-12 md:pt-40 md:pb-20">

          {/* Page header */}
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-16">
            <h1 data-aos="zoom-y-out">Terms of Use</h1>
            <p className="text-xl text-gray-400 mb-2">Terms of use apply to your usage of GLAPI's services and our obligations to you.</p>
            <p className="text-sm text-gray-500">(Last modified April 8, 2024)</p> {/* TODO: Update date dynamically or manually */}
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto text-gray-400">
            <div className="prose prose-lg prose-invert max-w-none">

              <h2>1. Introduction and Definitions</h2>
              <p>Welcome to the GLAPI Website and Services. We are confident that you will find our Services useful. These Terms of Use (the "TOU") cover several different situations, so please refer to the following definitions for clarification:</p>
              <ul>
                <li><strong>Client:</strong> Refers to a client of a User of the Services. An "Active Client" is a Client who has accepted a Proposal through the Services, and may be making a payment of "Professional Services Fees" to a User via the Services.</li>
                <li><strong>GLAPI:</strong> Refers to GLAPI, LLC, a US-based company. Where the present TOU refer to "GLAPI", they may refer to GLAPI, LLC and its subsidiaries and affiliates, and / or their respective shareholders, officers, directors, employees, agents, partners, principals, representatives, successors and assigns (collectively "Representatives"), depending on the context. Any reference to "we", "our", or "us" in these TOU refers to GLAPI.</li>
                <li><strong>Fees:</strong> Means the fees for provision of the Services as described on the GLAPI Website or otherwise set out in our Portal, including but not limited to Subscription Fees, Additional Client Fees, Payment Service Fees (as applicable).</li>
                <li><strong>Payment Service Fees:</strong> Means the service fee for the processing of payments as described on the GLAPI Website or otherwise set out in your Portal.</li>
                <li><strong>Portal:</strong> Means that part of our website or any software application that sets out terms specific to the Services that we provide you, including details of any Fees.</li>
                <li><strong>Proposal:</strong> Refers to a proposal for professional services ("Professional Services") that a Logged-In User has created through the Services to send to a Client.</li>
                <li><strong>Services:</strong> Refers to the software services accessed through the Website that GLAPI has developed and / or licensed that allow you to manage various business processes, receive payments from Clients, and various related functionalities. You may purchase a "Subscription" to use the Services.</li>
                <li><strong>User:</strong> Refers to the individual who has created an account to use the Services for their own benefit and / or on behalf of a company, partnership, association or other legal entity (a "Legal Entity"). When a User has created an account to use the Services and is logged in, they may be referred to in these TOU as a "Logged-in User". The Legal Entity that the User is representing may be referred to in these TOU as a "Service Provider" or similar term depending on context.</li>
                <li><strong>Website:</strong> Is the website located at https://www.glapi.com which is owned and operated by GLAPI, and includes all subdomains and subpages, present and future.</li>
              </ul>
              <p>Please note that in these TOU, anyone (including but not limited to Users and Clients) interacting with the Website or Services may be referred to as "you" and "your".</p>
              <p>Additional definitions shall be made throughout these TOU, but they will be recognizable as they will be capitalized, bolded, and in quotation marks. The definitions found in these TOU shall also apply to our Privacy Policy.</p>

              <h2>2. Acceptance and Modifications</h2>
              <p>By interacting with the Services in any way including but not limited to: (i) clicking or tapping the acceptance button upon signing up for an account or a Subscription; or (ii) accepting a Proposal or making a payment through the Services if you are a Client, you hereby accept to be bound by the TOU without any reservations, modifications, additions or deletions. If you do not agree to all the provisions contained in the TOU, you are not authorized to use the Services. The TOU are a legal and binding agreement between you and us.</p>
              <p>If you are using the Services and accepting or agreeing to these TOU on behalf of Legal Entity, you represent and warrant that you have the authority to bind that Legal Entity to these TOU and, in such event, "you" and "your" will refer and apply to that Legal Entity, as applicable.</p>
              <p>GLAPI reserves the right, at any time and without prior notice, to modify or replace any of these TOU. Any changes to the TOU can be found on our Website. It is your responsibility to check the TOU periodically for changes. Your use of the Website or Services following the posting of any changes to the TOU constitutes acceptance of those changes. If there are any significant changes to the TOU that materially affect our relationship with you, we will use commercially reasonable efforts to notify you by sending a notice to the primary email address specified in your account, by posting a prominent notice when you log in to the Services for the first time following those changes, or by posting a prominent notice in the Services and / or on the Website.</p>
              <p>These TOU should be read in conjunction with the <a href="/privacy-policy">Privacy Policy</a> as both of these documents govern your use of the Website and Services.</p>

              <h2>3. Contacting Us</h2>
              <p>If you have any questions about these TOU, please contact us at:</p>
              <p><strong>GLAPI Legal Contact</strong><br />
              Email: <a href="mailto:legal@glapi.com">legal@glapi.com</a></p>
              <p>Mailing Address:<br />
              GLAPI<br />
              Legal Department<br />
              United States</p>
              <p>If you have any questions regarding the Services themselves, please contact us at <a href="mailto:support@glapi.com">support@glapi.com</a>.</p>

              <h2>4. Services</h2>
              <p>Details of the Services, including all features and integrations in any offering that forms part of the Services, are set out on the GLAPI Website or via the Portal. GLAPI reserves the right to upgrade, modify or remove any of its Services from time to time by creating a new release or version of any Services or replacing any offering that forms part of the Services with an alternative offering, including updates, enhancements, extensions or replacements of the functionality of such Services. Any material upgrades or changes to Services will be notified to you from time to time and will come into effect in accordance with the date set out on that notice.</p>

              <h2>5. General Code of Conduct for Use of the Website and Services</h2>
              <p>In addition to the more specific rules found elsewhere in these TOU, you agree that by interacting with the Website or Services in any way, you will:</p>
              <ul>
                <li>Not use the Website or Services in any manner that in any way violates these TOU or any other applicable policy posted on the Website or in the Services by GLAPI;</li>
                <li>Not use the Website or Services in any manner that violates any intellectual property rights of GLAPI or any third party;</li>
                <li>Not use the Website or Services in any manner to propagate spam, including but not limited to unsolicited advertising or bulk electronic mail or messages, including to link to a spam or phishing website;</li>
                <li>Not use the Website or Services in any manner to propagate software viruses, Trojan horses, worms, or any other malicious or non-malicious computer code, files, or programs that are designed or intended to disrupt, damage, limit or interfere with the proper function of any software, hardware, or telecommunications equipment in any form whether belonging to GLAPI or a third party, or to damage or obtain unauthorized access to any system, data, password or other information (whether personal data or not) of GLAPI, other Services Users, or any other third party;</li>
                <li>Not: (1) take any action that imposes or may impose (as determined by GLAPI in its sole discretion) an unreasonable or disproportionately large load on GLAPI's (or its third party providers') infrastructures; (2) interfere or attempt to interfere with the proper functioning of the Website or Services or any activities conducted on or via the Website or Services; (3) bypass any measures GLAPI may use to prevent or restrict access to the Services or any element thereof; (4) use manual or automated software, devices, or other processes to "crawl" or "spider" any page or portion of the Website or Services; or (5) harvest or scrape any content from the Website or Services in an unreasonable manner;</li>
                <li>Not take any action or use any process that removes, modifies, disables, blocks, obscures or otherwise impairs any advertising or other promotions in connection with the Website or Services;</li>
                <li>Not use the Website or Services to in any way collect information (whether personal information or not) of any third party or in violation of our Privacy Policy, except as permitted by the nature and function of the Website or Services;</li>
                <li>Not use the Website or Services to advertise or promote products or services that are not expressly approved in advance in writing by GLAPI, or as otherwise permitted by the nature of the Services;</li>
                <li>Not interfere with any third party's use or enjoyment of the Website or Services;</li>
                <li>Not do anything or encourage conduct that would constitute a criminal offense or give rise to civil liability, or is any way unlawful, illegal, fraudulent or harmful to any third party;</li>
                <li>Not attempt to do any of the foregoing prohibitions;</li>
                <li>Use the Website and Services in good faith, and in compliance with all applicable local, state or provincial, national, and international laws.</li>
              </ul>

              <h2>6. Free Trials; Accounts and Passwords</h2>
              <h3>a. Free Trial</h3>
              <p>You may begin your use of the Services with a free trial. Subject to clause 7, the free trial period of your account lasts up to fourteen days, or as otherwise agreed in writing by GLAPI during sign-up (the "Free Trial Period"). Free trials are for new Users only. GLAPI reserves the right, in its absolute discretion, to determine your free trial eligibility.</p>
              <p>If you wish to continue to use the Services following your Free Trial Period, you will be required to pay the Subscription Fees, as more fully described in the next section of these TOU.</p>
              <h3>b. Age Requirements</h3>
              <p>In order to create an account on the Services, you affirm that you are at least eighteen (18) years of age or over, or the age of majority in the jurisdiction you reside and from which you access the Services where the age of majority is greater than eighteen (18) years of age.</p>
              <h3>c. Accounts and Passwords</h3>
              <p>In order to be able to use the Services, you will be required to create an account. Accounts are available to anyone who provides the requisite information, subject to the restrictions and conditions as outlined elsewhere in these TOU.</p>
              <p>As part of the account registration, you will be asked to choose a password (or use a third-party authentication service like Clerk). It is your responsibility to maintain the security of your login credentials. You are responsible for maintaining the confidentiality of your password and account access, and are responsible for all activities that occur under your account whether by you or any third party. You agree to immediately notify us of any unauthorized use of your account or any other breach of security regarding your account.</p>
              <p>If you are a Logged-in User, it is strongly suggested that you log out of your account at the end of every session, or not leave a logged-in account unattended for any period of time. GLAPI and its Representatives will not be held liable for any losses or damages, direct or indirect, pecuniary or non-pecuniary, resulting from your failure to log out at the end of the session, an unattended logged-in session, or a third party using the Services with your Account Information and accessing your account through any means, and disclaims any responsibility in this regard.</p>
              <p>GLAPI reserves the right to suspend or terminate your account, at its sole discretion, at any time and for any reason, including but not limited to whether you have violated the letter or spirit of the TOU, as more fully described herein below.</p>
              <h3>d. Account Information</h3>
              <p>The information required to create an account to begin using the Services typically includes: email address, full name, company name (optional), phone number (optional). This information you submit as part of the sign-up process may be referred to in the present TOU or the Privacy Policy as "Account Information".</p>
              <p>By submitting Account Information, you represent and warrant that the Account Information is true and accurate to the best of your knowledge. Submitting false or misleading Account Information may result in you being banned from using the Services, at our sole discretion. GLAPI reserves the right to verify your submitted Account Information for any reason.</p>
              <p>GLAPI retains absolute discretion to refuse to approve your account for any reason, including but not limited to if we believe you have submitted false or misleading Account Information. Without limiting the generality of the Disclaimer of Warranties further in these TOU, GLAPI and / or its Representatives shall not be responsible for any losses or damages, pecuniary or otherwise, to you resulting from GLAPI's refusal to approve your account, and GLAPI disclaims any responsibility thereto.</p>
              <h3>e. Additional Users</h3>
              <p>As a Logged-in User using the Services on behalf of a Legal Entity, you may be able to add additional Users to your account or Subscription, potentially subject to additional fees depending on your plan. You acknowledge and agree that you are solely responsible for the use of the Services by these additional Users through your account or Subscription, and are responsible for any violations of these TOU by those additional Users.</p>

              <h2>7. Subscription Fees and Payment Processing</h2>
              <h3>a. Payment of Subscription Fees and Automatic Renewal; Cancelling your Subscription</h3>
              <p>The amount of the monthly or annual Subscription Fees for each plan level are available on the GLAPI Website or via the Portal and will be displayed and charged in U.S. Dollars (USD). Your currency may be converted upon payment depending on your location and / or credit card agreement. By signing up for a Subscription you agree to pay the Subscription Fees presented to you upon signing up, plus any applicable taxes.</p>
              <p>You will be charged the Subscription Fees on the date you sign up for a Subscription to the Services (the "Initial Billing Date") and the Free Trial period (if any) will immediately lapse on the Initial Billing Date. The Subscription Fees shall subsequently be charged on the monthly or yearly anniversary of the Initial Billing Date, as applicable depending on which option you have chosen. The payment period of your subscription, whether a month or a year, shall be referred to in the present TOU as a "Billing Period".</p>
              <p>Your Subscription automatically renews at the end of every Billing Period. If you wish to cancel your Subscription and avoid paying the Subscription Fees for the next Billing Period, you must do so prior to the end of the current Billing Period, no later than 24 hours prior to the end of the Billing Period, so that your credit card will not be charged again. You can cancel your Subscription by accessing the Subscription information section in your dashboard when you are a Logged-in User, or by contacting <a href="mailto:support@glapi.com">support@glapi.com</a>.</p>
              <p>If you cancel your Subscription prior to the end of the Billing Period, you shall not be entitled to any refund of any Subscription Fees already paid for that Billing Period, prorated or otherwise.</p>
              <h3>b. Billing Information and Payment Processing</h3>
              <p>In order to pay your Subscription Fees through the Services, you will be required to enter payment information such as credit card number, expiry date, and CVC. This may be referred to in these TOU or the Privacy Policy as "Billing Information".</p>
              <p>All payments are made using a secure https:// connection, and payment processing is handled through the "Third-Party Payment Processor" Stripe, though this is subject to change without notice. The Third-Party Payment Processor currently accepts certain credit cards as payment options but these are subject to change without notice. Once transactions are accepted by the Third-Party Payment Processor, they are processed in accordance with their program rules and procedures and Terms of Use. GLAPI and the Third-Party Payment Processor are unaffiliated companies and GLAPI has no influence on the operations of the Third-Party Payment Processor. GLAPI and / or its Representatives shall in no way be held responsible for any losses or damages, direct or indirect, pecuniary or otherwise, resulting from any error or failure on the part of the Third-Party Payment Processor.</p>
              <p>All Billing Information is collected by the Third-Party Payment Processor, on their own secured servers. GLAPI does not have access to your full credit card information, nor can it be responsible for any breach of information caused by faulty programming or malicious users on the servers of the Third-Party Payment Processor. Non-financial information (like transaction history) will, however, be available to GLAPI for invoice-making and record-keeping purposes.</p>
              <p>If you have a valid coupon code, it shall be applied and displayed during the payment process. In the event that an incorrect discount is applied, GLAPI reserves the right to refuse or cancel any Subscriptions listed at an incorrect discount. GLAPI reserves the right to refuse or cancel any such Subscriptions whether or not the Subscription has been confirmed and the User's credit card charged.</p>
              <h3>c. Payment of Additional Fees (Usage-Based)</h3>
              <p>Your Subscription may include usage limits (e.g., number of users, data processing volume, API calls, etc.). If you exceed these limits, you may be charged additional fees as described on the GLAPI Website or Portal ("Usage Fees"). By signing up for a Subscription, you authorize GLAPI to charge your payment method and you agree to pay such Usage Fees if applicable, plus any applicable taxes.</p>
              <h3>d. Failure of Automatic Payment</h3>
              <p>Should automatic payment of any Subscription Fees or Usage Fees fail to occur for any reason, your account may be suspended. GLAPI may issue you an electronic invoice via email indicating that you must proceed manually, within a certain deadline date, with the full payment of the Fees as indicated on the invoice. Your account may be reactivated upon receipt of the payment.</p>
              <h3>e. Modification of the Fees</h3>
              <p>GLAPI, in its sole discretion and at any time, may modify the Subscription Fees or Usage Fees on written notice to you. Any modification(s) will become effective at the end of the then-current Billing Period or as specified in the notice. GLAPI will provide you with a reasonable prior notice of any change in Fees to give you an opportunity to terminate or change your Subscription before such modification(s) becomes effective. Your continued use of the Services after the Fees modification(s) comes into effect constitutes your agreement to pay the modified Fees at the modified rates.</p>

              <h2>8. Client Terms (If Applicable)</h2>
              <p>This section applies if you are a Client using the Services, for example, to accept a Proposal or make a payment to a User (Service Provider).</p>
              <h3>a. Acceptance of Proposals; Legal Relationship</h3>
              <p>By accepting a Proposal (e.g., clicking acceptance, signing electronically): (i) you agree to pay the Service Provider the price quoted for the services outlined in the Proposal; and (ii) you agree to abide by the additional terms presented (the "Service Terms"), which are strictly between you and the Service Provider. GLAPI is not a party to the legal relationship between you and the Service Provider. The Service Provider alone is responsible for any loss, damages, claims, etc., related to the services provided or violation of the Service Terms. GLAPI disclaims any responsibility.</p>
              <h3>b. Payments Made Through the Services</h3>
              <p>Payments to Service Providers through GLAPI may use bank ACH transfer or credit card, facilitated by partners like Stripe or Plaid ("Payment Facilitators").</p>
              <p>GLAPI and Payment Facilitators are unaffiliated. GLAPI is not responsible for errors or failures by Payment Facilitators.</p>
              <p>By making a payment, you acknowledge and agree:</p>
              <ul>
                <li>You authorize GLAPI, via Payment Facilitators, to process payments on behalf of the Service Provider. GLAPI acts as an agent for the Service Provider for payment collection.</li>
                <li>You authorize the Payment Facilitator to handle the payment.</li>
                <li>GLAPI provides only collection services and is not liable for the services provided by the Service Provider.</li>
                <li>Payments will be processed according to the terms agreed with the Service Provider.</li>
                <li>"GLAPI" or similar may appear as the merchant, but GLAPI is not liable for disputed transactions related to non-supply of services by the Service Provider.</li>
                <li>You authorize GLAPI to vary payment amounts based on instructions from the Service Provider reflecting agreed variations, without needing separate notification from GLAPI.</li>
                <li>Contact the Service Provider directly to alter, stop, or cancel payment arrangements.</li>
                <li>Ensure sufficient funds for ACH debits. You are responsible for fees due to insufficient funds (including charge-backs).</li>
                <li>Unpaid debits/payments may incur fees payable to GLAPI, plus collection costs.</li>
                <li>GLAPI may re-process unsuccessful payments based on Service Provider instructions.</li>
                <li>Direct all disputes regarding service fees to the Service Provider. GLAPI acts only as an agent.</li>
                <li>Direct disputes about payments themselves to the Service Provider and your financial institution.</li>
                <li>GLAPI is not liable for refunding disputed payments. You agree to reimburse GLAPI for losses from claims against GLAPI related to disputed payments (see Indemnity section).</li>
                <li>You are subject to the dispute provisions in the next section as applicable.</li>
              </ul>

              <h2>9. Withholding Fees; Disputes (User Perspective)</h2>
              <p>This section applies to Users (Service Providers) receiving payments via GLAPI.</p>
              <h3>a. Withholding Fees</h3>
              <p>GLAPI may withhold remitting fees to you for legitimate reasons, including: (i) non-payment of your Subscription Fees; (ii) payment value appears excessive; (iii) indication of fraudulent or illegal activity. We may inform you and allow rectification, but GLAPI's final decision to release or withhold fees is binding. GLAPI is not liable for losses resulting from withholding fees under these circumstances.</p>
              <h3>b. Disputes</h3>
              <p>GLAPI plays no role in adjudicating payment disputes between you and your Client. However, GLAPI retains discretion to return paid fees to a Client if a payment is disputed. GLAPI is not liable for losses resulting from fee disputes between you and a Client.</p>

              <h2>10. Proprietary and Intellectual Property Rights; Your Data</h2>
              <h3>a. GLAPI's Rights</h3>
              <p>You acknowledge the Website and Services contain proprietary and confidential information protected by IP laws. GLAPI and/or its licensors own all right, title, and interest in the Website, Services, and content (except User Data), including all Intellectual Property Rights ("IP Rights"). All rights not specifically granted are reserved.</p>
              <p>You agree not to (and not allow third parties to): (i) copy, sell, license, distribute, modify, adapt, translate, create derivative works from, decompile, reverse engineer, or disassemble the Website or Services or their content; (ii) circumvent security measures; or (iii) remove or obscure proprietary rights notices.</p>
              <p>The content, arrangement, layout, trademarks, photos, logos, videos, audio, images, text, and code ("Computer Code") are proprietary to GLAPI (owned or licensed) and may not be used without express permission, except as permitted by functionality or these TOU. Unauthorized use may violate laws, and GLAPI may take action.</p>
              <p>This applies to third-party property, including Computer Code (source code, object code, frameworks, CSS, JS, etc.).</p>
              <h3>b. Your Data</h3>
              <p>All data you submit through the Services (text, financial info, graphics, images, etc.) and associated IP Rights ("Data") remain your property.</p>
              <p>Your access to inputted Data depends on full payment of Subscription Fees. Maintain copies of all Data inputted. GLAPI follows best practices for data backup but doesn't guarantee against data loss. GLAPI is not obligated to retain your Data after Subscription termination.</p>
              <p>GLAPI is not liable for losses from Data loss or deletion after termination.</p>
              <h3>c. Access to Your Data by Third Party Applications</h3>
              <p>If you enable third-party apps (e.g., QuickBooks, Xero, NetSuite, Procore, BigCommerce, etc.) for use with the Services, you allow providers of those apps to access your Data as needed for interoperation. GLAPI is not liable for losses from disclosure, modification, or deletion of your Data by these third-party providers.</p>
              <h3>d. Submitted Information (Feedback)</h3>
              <p>If you provide suggestions for improvements or ideas ("Feedback"), GLAPI owns all rights to the Feedback and can use it without restriction or compensation to you. You irrevocably assign all rights to the Feedback to GLAPI and waive moral rights. You agree to assist GLAPI in documenting and perfecting these rights.</p>

              <h2>11. AI-generated content</h2>
              <p>The Website and Services may offer features using artificial intelligence ("AI Services") to produce AI-generated content ("Output") based on information you provide.</p>
              <p>When using AI Services, you acknowledge and agree:</p>
              <ul>
                  <li>Output may not always be accurate, complete, or error-free.</li>
                  <li>Review and evaluate Output for accuracy and appropriateness before use.</li>
                  <li>You are responsible for ensuring your use of Output doesn't violate laws or these terms.</li>
                  <li>You assume all risks associated with using any Output.</li>
              </ul>

              <h2>12. External Links</h2>
              <p>GLAPI or Users may provide links to external websites/services not covered by these TOU. Access third-party resources at your own risk. GLAPI is not responsible for your use of, or privacy on, external sites. Check their terms and privacy policies. GLAPI makes no claim/warranty about linked content or services.</p>
              <p>GLAPI is not liable for damages arising from: (1) use of linked sites/services; (2) viruses/malware from linked sites; (3) reliance on linked content/products/services; or (4) actions of linked site operators.</p>

              <h2>13. Interruption of the Website or Services</h2>
              <p>The Website or Services may be temporarily unavailable for maintenance/modifications. GLAPI will try to minimize downtime but is not liable for losses resulting from interruptions.</p>

              <h2>14. Termination of the Website or Services or Your Access</h2>
              <p>GLAPI may, in its sole discretion, with or without cause, block your access, revoke credentials, or terminate your use of the Website/Services immediately if GLAPI believes you violated these TOU or acted improperly.</p>
              <p>You can end your access by canceling your Subscription via your dashboard or contacting <a href="mailto:support@glapi.com">support@glapi.com</a>.</p>
              <p>GLAPI may discontinue the Website/Services at any time. GLAPI is not liable for losses from termination of your access or the Services.</p>
              <p>Termination ends these TOU between you and GLAPI. Provisions meant to survive termination (IP, disclaimers, indemnity, liability limitations) will remain in effect.</p>

              <h2>15. Disclaimer of Warranties</h2>
              <p>YOUR USE OF THE WEBSITE AND SERVICES IS AT YOUR SOLE RISK. THE WEBSITE, SERVICES, AND ANY DOWNLOADED MATERIALS ARE PROVIDED "AS IS" AND "AS AVAILABLE". YOU ARE SOLELY RESPONSIBLE FOR DAMAGE TO YOUR SYSTEM OR DATA LOSS FROM DOWNLOADS/ACCESS, OR LOSSES FROM USING THE WEBSITE/SERVICES.</p>
              <p>Information provided by GLAPI is intended to be accurate but may contain errors or change. GLAPI is not liable for losses resulting from errors, omissions, or reliance on information.</p>
              <p>ADTECO EXPRESSLY DISCLAIMS ALL WARRANTIES (EXPRESS OR IMPLIED), INCLUDING: TITLE, NON-INFRINGEMENT, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND THAT THE WEBSITE/SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, ACCURATE, RELIABLE, OR FREE FROM VIRUSES/HARMFUL COMPONENTS.</p>
              <p>GLAPI does not warrant: (i) security or availability at specific times/locations; (ii) correction of defects/errors; (iii) content is free of viruses/harmful components; (iv) functionality works equally across devices; or (v) results of using the Website/Services meet your requirements.</p>
              <p>GLAPI assumes no responsibility for third-party content (including User content).</p>
              <p>Where disclaimers are not permitted, warranties are limited to the minimum legally required.</p>

              <h2>16. Limitation of Liability</h2>
              <p>IN NO CASE WILL ADTECO OR ITS REPRESENTATIVES BE LIABLE FOR INDIRECT, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOSSES, DAMAGES, LIABILITIES, COSTS, AND EXPENSES ARISING FROM (I) YOUR ACCESS, USE, MISUSE, OR INABILITY TO ACCESS/USE THE WEBSITE/SERVICES, OR (II) INTERRUPTION, SUSPENSION, OR TERMINATION OF THE WEBSITE/SERVICES, REGARDLESS OF CAUSE OF ACTION, EVEN IF ADVISED OF THE POSSIBILITY.</p>
              <p>IN NO EVENT WILL ADTECO'S AGGREGATE LIABILITY FOR CLAIMS RELATED TO YOUR USE OF THE WEBSITE/SERVICES EXCEED THE AMOUNT OF US$100 OR THE SUBSCRIPTION FEES PAID IN THE PREVIOUS 6 MONTHS, WHICHEVER IS GREATER.</p>
              <p>ADTECO IS NOT LIABLE FOR DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES (INCLUDING LOSS OF PROFITS, GOODWILL, USE, DATA) RELATED TO THE WEBSITE/SERVICES, INFORMATION THEREON, YOUR USE, ACTIVITIES ARISING FROM USE, THIRD-PARTY MATERIALS, OR DOWNLOADED MATERIALS. THIS APPLIES TO DAMAGES FROM ERRORS, OMISSIONS, FAILURES, INTERRUPTIONS, DELAYS, VIRUSES, THEFT, DESTRUCTION, OR UNAUTHORIZED ACCESS/USE OF RECORDS.</p>
              <p>Some jurisdictions don't allow limitation/exclusion of liability for incidental/consequential damages, so these limitations may not apply.</p>

              <h2>17. Indemnity</h2>
              <p>You agree to indemnify, defend, and hold harmless GLAPI and its Representatives from damages, liabilities, costs, expenses (including attorneys' fees), claims, or demands arising from: (i) your use/connection to the Website/Services; (ii) your participation in activities arising from the Website/Services; (iii) your violation of these TOU or the Privacy Policy; or (iv) your violation of third-party rights.</p>

              <h2>18. Governing Law and Applicable Jurisdiction</h2>
              <p>These TOU and your use of the Website/Services shall be governed by and construed in accordance with the laws of the State of [Your State, e.g., Colorado] and the federal laws of the United States applicable therein, without regard to conflict of law provisions. You agree that any legal action or proceeding between you and GLAPI shall be brought exclusively in the state or federal courts located in [Your County/City, e.g., Denver County, Colorado].</p> {/* TODO: Update State/County/City */} 
              <p>Notwithstanding the foregoing, GLAPI may bring action against you in your jurisdiction: (i) for injunctive relief; (ii) to obtain a judgment if a [Your State] court judgment may not be enforced there; or (iii) to enforce a [Your State] judgment obtained against you.</p>
              <p>If you acquire access/use for business purposes, you agree that statutory consumer guarantees intended for non-business consumers do not apply to the maximum extent permitted by law.</p>

              <h2>19. Miscellaneous Provisions</h2>
              <ul>
                  <li><strong>Entire Agreement:</strong> These TOU, with the Privacy Policy, constitute the entire agreement, superseding prior versions.</li>
                  <li><strong>Delays:</strong> GLAPI is not liable for failures due to causes beyond reasonable control (incl. force majeure).</li>
                  <li><strong>Severability:</strong> If any provision is found invalid, the court should give effect to the parties' intentions, and other provisions remain in effect.</li>
                  <li><strong>Waiver:</strong> Failure to enforce any right/provision doesn't waive it.</li>
                  <li><strong>Notices:</strong> Notices must be in writing via email. Notices to GLAPI: <a href="mailto:support@glapi.com">support@glapi.com</a> (or other notified address). Notices to you: email associated with your account.</li>
              </ul>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
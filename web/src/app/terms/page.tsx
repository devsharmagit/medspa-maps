import type { Metadata } from "next";

import { H2, H3, LegalPage, P, UL } from "@/components/legal/legal-page";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

const DESCRIPTION =
  "The terms that govern your use of the Medspa Maps directory, including our medical disclaimer, listing policies, and dispute resolution.";

export const metadata: Metadata = {
  title: `Terms & Conditions — ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    title: `Terms & Conditions — ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/terms",
    siteName: SITE_NAME,
  },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms &" accent="conditions" lastUpdated="September 2026">
      <P>
        Welcome to Medspa Maps. These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access
        to and use of the Medspa Maps website, directory, educational content, search tools, practice
        listings, and related features.
      </P>
      <P>
        By accessing or using Medspa Maps, you agree to these Terms. If you do not agree with these
        Terms, please do not use the website.
      </P>

      <H2>About Medspa Maps</H2>
      <P>
        Medspa Maps is an informational directory and educational resource designed to help users
        discover and compare med spas, providers, treatments, services, and related information.
      </P>
      <P>
        Medspa Maps is not a medical practice or healthcare provider and does not provide medical
        diagnosis, treatment, prescriptions, or individualized medical advice.
      </P>

      <H2>Eligibility</H2>
      <P>
        Medspa Maps is intended for use by individuals who are at least 18 years old, or the age of
        majority in their jurisdiction, and who have the legal capacity to enter into these Terms. By
        using Medspa Maps, you represent that you meet these requirements.
      </P>

      <H2>Medical Disclaimer</H2>
      <P>
        Information available through Medspa Maps, including treatment descriptions, articles,
        provider information, practice listings, educational materials, and other content, is
        provided for general informational and educational purposes only.
      </P>
      <P>
        Nothing on Medspa Maps should be considered medical advice, diagnosis, or a recommendation
        for any particular treatment, procedure, provider, product, or course of care.
      </P>
      <P>
        Medical and aesthetic treatments may involve risks and may not be appropriate for everyone.
        Always consult directly with an appropriately qualified healthcare professional regarding
        your individual medical history, treatment options, risks, benefits, and expected outcomes
        before making healthcare or treatment decisions.
      </P>
      <P>
        Do not disregard professional medical advice or delay seeking medical care because of
        information you have read on Medspa Maps.
      </P>

      <H2>Practice and Provider Listings</H2>
      <P>
        Medspa Maps provides information about independent med spas, practices, providers,
        treatments, and services.
      </P>
      <P>
        We make reasonable efforts to provide useful and current information; however, information
        about a practice may change without notice.
      </P>
      <P>
        Medspa Maps does not guarantee the accuracy, completeness, availability, qualifications,
        licensing status, pricing, services, treatment availability, safety, quality, or results
        associated with any practice, provider, treatment, or service listed on the website.
      </P>
      <P>
        Users are responsible for independently evaluating a provider or practice before scheduling
        or receiving treatment, including verifying credentials, licensing, qualifications, pricing,
        and whether a particular treatment is appropriate for them.
      </P>

      <H2>Vetted, Verified, Featured, and Ranked Listings</H2>
      <P>
        Medspa Maps may describe certain practices or listings using terms such as
        &ldquo;vetted,&rdquo; &ldquo;verified,&rdquo; &ldquo;featured,&rdquo;
        &ldquo;top-rated,&rdquo; or similar terminology.
      </P>
      <P>
        These descriptions relate to Medspa Maps&rsquo; directory and editorial processes and should
        not be interpreted as a medical endorsement, guarantee of treatment quality, guarantee of
        credentials, or guarantee of results.
      </P>
      <P>
        A practice&rsquo;s inclusion, placement, ranking, or featured status on Medspa Maps does not
        replace a user&rsquo;s responsibility to independently evaluate a provider before receiving
        medical or aesthetic services.
      </P>
      <P>
        Medspa Maps may update its review, verification, ranking, or listing criteria from time to
        time.
      </P>

      <H2>Ratings and Reviews</H2>
      <P>
        Practice listings may display ratings, review counts, testimonials, or other information
        originating from patients, practices, public sources, or third-party platforms.
      </P>
      <P>
        Medspa Maps does not guarantee that reviews or ratings represent every patient&rsquo;s
        experience or that an individual user will experience similar results.
      </P>
      <P>
        Ratings, reviews, and testimonials should be considered as one source of information and
        should not replace independent research or consultation with a qualified healthcare
        professional.
      </P>

      <H2>Third-Party Websites and Booking Services</H2>
      <P>
        Medspa Maps may provide links to practice websites, external booking platforms, maps, and
        other third-party websites or services.
      </P>
      <P>
        Appointments are made directly with independent practices or through their selected booking
        services. Medspa Maps does not provide the underlying medical or aesthetic service and is not
        a party to the provider-patient relationship or transaction.
      </P>
      <P>
        Third-party websites and services operate under their own terms, policies, and privacy
        practices. Medspa Maps is not responsible for the availability, security, accuracy, content,
        products, services, or practices of third-party websites.
      </P>

      <H2>Appointments, Treatments, and Transactions</H2>
      <P>
        Any consultation, appointment, payment, treatment, procedure, service, cancellation, refund,
        dispute, or other transaction involving a listed practice is solely between the user and that
        independent practice or provider.
      </P>
      <P>
        Medspa Maps is not responsible for any treatment, service, transaction, injury, complication,
        outcome, disagreement, loss, or other issue arising from an interaction between a user and a
        listed provider or practice.
      </P>

      <H2>Acceptable Use</H2>
      <P>You agree to use Medspa Maps only for lawful purposes.</P>
      <P>You may not:</P>
      <UL
        items={[
          "Attempt to gain unauthorized access to the website, systems, or data",
          "Interfere with the security or operation of the website",
          "Introduce viruses, malicious code, or other harmful technologies",
          "Use automated systems to scrape, harvest, copy, or extract website content or data without authorization",
          "Misrepresent your identity or affiliation with a practice or provider",
          "Submit knowingly false, misleading, fraudulent, or unlawful information",
          "Use Medspa Maps in a way that violates applicable laws or the rights of others",
        ]}
      />
      <P>
        We reserve the right to restrict access to the website when we reasonably believe these Terms
        have been violated.
      </P>

      <H2>Intellectual Property</H2>
      <P>
        Unless otherwise indicated, the Medspa Maps website and its original content, branding,
        design, graphics, directory structure, educational materials, and other materials are owned
        by or licensed to Medspa Maps and are protected by applicable intellectual property laws.
      </P>
      <P>
        Third-party business names, logos, photographs, trademarks, and other materials remain the
        property of their respective owners.
      </P>
      <P>
        You may use Medspa Maps for personal, non-commercial informational purposes. You may not
        reproduce, republish, distribute, sell, modify, scrape, or commercially exploit protected
        Medspa Maps content without prior authorization.
      </P>
      <P>
        If you believe content on Medspa Maps infringes your copyright, please contact us with a
        description of the work, its location on the website, and your contact information, and we
        will review and respond to legitimate requests.
      </P>

      <H2>Disclaimer of Warranties</H2>
      <P>
        Medspa Maps is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis to the
        extent permitted by applicable law.
      </P>
      <P>
        While we make reasonable efforts to maintain useful and accurate information, we do not
        warrant that the website will always be available, uninterrupted, secure, error-free,
        complete, or current.
      </P>
      <P>
        We also do not guarantee any particular medical, aesthetic, financial, or other outcome
        resulting from information obtained through Medspa Maps or services received from a listed
        practice.
      </P>

      <H2>Limitation of Liability</H2>
      <P>
        To the fullest extent permitted by applicable law, Medspa Maps and its owners, affiliates,
        employees, representatives, and service providers will not be liable for indirect,
        incidental, consequential, special, exemplary, or punitive damages arising from or related to
        your use of the website, reliance on website information, interaction with a listed provider,
        or use of third-party websites or services.
      </P>
      <P>
        Nothing in these Terms is intended to exclude or limit liability that cannot legally be
        excluded or limited.
      </P>

      <H2>Indemnification</H2>
      <P>
        To the extent permitted by applicable law, you agree to indemnify and hold harmless Medspa
        Maps and its affiliates, officers, employees, representatives, and service providers from
        claims, liabilities, losses, damages, or expenses arising from your unlawful or unauthorized
        use of the website or your material violation of these Terms.
      </P>

      <H2>Dispute Resolution; Binding Arbitration; Class Action Waiver</H2>
      <P>
        Please read this section carefully. It affects your legal rights and requires most disputes
        to be resolved through individual arbitration rather than in court.
      </P>

      <H3>Informal Resolution First</H3>
      <P>
        Before filing a claim, you agree to first contact Medspa Maps through the contact information
        provided on our website and attempt in good faith to resolve the dispute informally for at
        least 30 days.
      </P>

      <H3>Agreement to Arbitrate</H3>
      <P>
        If a dispute is not resolved informally, you and Medspa Maps agree that any dispute, claim,
        or controversy arising out of or relating to these Terms or your use of Medspa Maps will be
        resolved by binding, individual arbitration administered by the American Arbitration
        Association (&ldquo;AAA&rdquo;) under its Consumer Arbitration Rules, rather than in court,
        except that either party may bring an individual action in small claims court.
      </P>

      <H3>Class Action and Jury Trial Waiver</H3>
      <P>
        You and Medspa Maps agree that any arbitration or claim will be conducted on an individual
        basis only, and not as a class, collective, consolidated, or representative action. You and
        Medspa Maps each waive any right to a jury trial.
      </P>

      <H3>Opt-Out Right</H3>
      <P>
        You may opt out of this arbitration agreement by sending written notice to Medspa Maps
        through the contact information provided on our website within 30 days of first becoming
        subject to these Terms. If you opt out, disputes will instead be resolved in the courts
        identified in &ldquo;Governing Law&rdquo; below, and this arbitration section will not apply
        to you.
      </P>

      <H3>Exceptions</H3>
      <P>
        Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in
        a court of competent jurisdiction to prevent the actual or threatened infringement,
        misappropriation, or violation of a party&rsquo;s intellectual property or confidentiality
        rights.
      </P>

      <H3>Severability of This Section</H3>
      <P>
        If any part of this arbitration agreement is found unenforceable, the remainder will still
        apply, except that if the class action waiver is found unenforceable as to a particular
        claim, that claim (and only that claim) must proceed in court rather than in arbitration.
      </P>

      <H2>Governing Law</H2>
      <P>
        These Terms, and any dispute not subject to arbitration under the section above, will be
        governed by the laws of the State of Utah, without regard to its conflict-of-law principles.
        Subject to the arbitration agreement above, the state and federal courts located in Utah will
        have exclusive jurisdiction over any dispute not subject to arbitration, and you consent to
        the personal jurisdiction of those courts.
      </P>

      <H2>Changes to the Website or Terms</H2>
      <P>
        We may modify, suspend, discontinue, or update portions of Medspa Maps at any time.
      </P>
      <P>
        We may also update these Terms periodically. When changes are made, the &ldquo;Last
        Updated&rdquo; date at the top of this page may be revised.
      </P>
      <P>
        Your continued use of Medspa Maps after updated Terms become effective constitutes your
        acceptance of those Terms to the extent permitted by applicable law.
      </P>

      <H2>Severability</H2>
      <P>
        If any provision of these Terms is found to be invalid or unenforceable, the remaining
        provisions will continue in effect to the fullest extent permitted by law.
      </P>

      <H2>Contact Us</H2>
      <P>
        If you have questions about these Terms &amp; Conditions, please contact Medspa Maps through
        the contact information provided on our website.
      </P>
    </LegalPage>
  );
}

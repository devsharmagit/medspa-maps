import type { Metadata } from "next";

import { H2, H3, LegalPage, P, UL } from "@/components/legal/legal-page";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

const DESCRIPTION =
  "How Medspa Maps collects, uses, shares and protects your information, plus your privacy rights and choices.";

export const metadata: Metadata = {
  title: `Privacy Policy — ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    type: "website",
    title: `Privacy Policy — ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/privacy-policy",
    siteName: SITE_NAME,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy" accent="policy" lastUpdated="September 2026">
      <P>
        Medspa Maps (&ldquo;Medspa Maps,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) respects your privacy and is committed to protecting the information you
        provide when you visit or use our website. This Privacy Policy explains the types of
        information we may collect, how we use and share that information, and the choices you may
        have regarding your information.
      </P>
      <P>
        By using Medspa Maps, you acknowledge the practices described in this Privacy Policy.
      </P>

      <H2>Information We Collect</H2>
      <P>
        We may collect information that you provide directly to us as well as certain information
        generated when you use our website.
      </P>

      <H3>Information You Provide</H3>
      <P>
        When you contact us, request to have a medspa listed, or submit information through a form
        on our website, we may collect information such as:
      </P>
      <UL
        items={[
          "Full name",
          "Business email address",
          "Business or practice name",
          "Information included in inquiries or other forms you submit",
          "Other information you voluntarily provide to us",
        ]}
      />

      <H3>Search and Location Information</H3>
      <P>
        When you use Medspa Maps to find practices, treatments, or services, we may collect
        information related to your searches, including:
      </P>
      <UL
        items={[
          "ZIP code or city entered into our search tools",
          "Treatments or conditions searched",
          "Search filters and preferences",
          "Practices or pages viewed",
        ]}
      />
      <P>
        If our website uses device-based location functionality, location information may also be
        processed according to your device or browser permissions.
      </P>

      <H3>Information Collected Automatically</H3>
      <P>
        When you visit Medspa Maps, certain technical information may be collected automatically,
        including:
      </P>
      <UL
        items={[
          "IP address",
          "Browser type",
          "Device type",
          "Operating system",
          "Pages visited",
          "Referring pages or websites",
          "Date and time of visits",
          "General website activity and interactions",
        ]}
      />

      <H2>Cookies and Tracking Technologies</H2>
      <P>
        Medspa Maps uses cookies, pixels, and similar technologies to support website functionality,
        understand how visitors use the website, improve performance, and provide a better user
        experience. This includes technologies provided by third parties, such as Google Analytics
        (website analytics) and advertising pixels such as the Google Ads and Meta
        (Facebook/Instagram) pixels, which help us measure the performance of our marketing and, in
        some cases, show you relevant ads on other websites or platforms (sometimes called
        &ldquo;retargeting&rdquo; or &ldquo;cross-context behavioral advertising&rdquo;).
      </P>
      <P>
        These third-party analytics and advertising providers may collect information about your
        browsing activity on Medspa Maps and other websites through cookies or similar technologies,
        and may combine it with other information they have about you. As described below, this type
        of data sharing may be treated as a &ldquo;sale&rdquo; or &ldquo;share&rdquo; of personal
        information under certain state privacy laws, even though Medspa Maps does not receive any
        monetary payment for it.
      </P>
      <P>
        Your browser may allow you to block or delete cookies, and you can generally opt out of
        interest-based advertising through your browser settings, device settings, or industry tools
        such as the Digital Advertising Alliance (optout.aboutads.info) or the Network Advertising
        Initiative (optout.networkadvertising.org). Disabling certain cookies may affect how some
        portions of the website function.
      </P>
      <P>
        Where required by applicable law, we will provide appropriate choices regarding non-essential
        cookies or similar technologies, such as a cookie banner or preference tool.
      </P>

      <H2>How We Use Information</H2>
      <P>We may use information collected through Medspa Maps to:</P>
      <UL
        items={[
          "Operate, maintain, and improve our website and directory",
          "Provide and improve search functionality",
          "Help users discover relevant medspas, treatments, and services",
          "Personalize search results and website experiences",
          "Process medspa listing requests",
          "Respond to questions, inquiries, or requests",
          "Analyze website traffic, usage, and performance",
          "Measure and improve the effectiveness of our advertising and marketing",
          "Maintain the security and integrity of our website",
          "Develop new features and improve existing services",
          "Comply with applicable legal requirements",
        ]}
      />

      <H2>How We May Share Information</H2>
      <P>
        We may share information with third parties when reasonably necessary to operate and improve
        Medspa Maps. These parties may include service providers that support website hosting,
        analytics, advertising, security, communications, or other business operations, such as
        Google Analytics and advertising platforms operated by Google and Meta.
      </P>
      <P>
        We may also disclose information when required by law, legal process, or governmental
        request, or when reasonably necessary to protect the rights, property, security, or safety of
        Medspa Maps, our users, or others, including in connection with a merger, acquisition,
        financing, or sale of assets.
      </P>
      <P>
        Medspa Maps does not sell personal information to third parties in exchange for money.
        However, because we allow certain analytics and advertising partners to collect information
        through cookies and similar technologies on our website (see &ldquo;Cookies and Tracking
        Technologies&rdquo; above), this activity may be considered a &ldquo;sale&rdquo; or
        &ldquo;share&rdquo; of personal information under some state privacy laws. See &ldquo;Your
        Privacy Rights&rdquo; below for information about your choices.
      </P>

      <H2>Your Privacy Rights</H2>
      <P>
        Depending on where you live, applicable privacy laws may provide certain rights regarding
        your personal information.
      </P>

      <H3>California Privacy Rights (CCPA/CPRA)</H3>
      <P>
        If you are a California resident, the California Consumer Privacy Act, as amended by the
        California Privacy Rights Act (&ldquo;CCPA&rdquo;), gives you certain rights regarding your
        personal information, including the right to:
      </P>
      <UL
        items={[
          "Know what personal information we have collected, used, disclosed, or sold/shared about you, and why",
          "Delete personal information we have collected from you, subject to certain exceptions",
          "Correct inaccurate personal information we maintain about you",
          "Opt out of the “sale” or “share” of your personal information, including for cross-context behavioral advertising",
          "Limit the use or disclosure of sensitive personal information, where applicable",
          "Not receive discriminatory treatment for exercising your privacy rights",
        ]}
      />
      <P>
        In the preceding 12 months, we may have &ldquo;sold&rdquo; or &ldquo;shared&rdquo; (as those
        terms are defined under the CCPA) identifiers, internet or network activity, and
        geolocation-type information (such as ZIP code or city) with analytics and advertising
        partners for the purposes described above. We do not sell or share the personal information
        of individuals we know to be under 16 years of age.
      </P>
      <P>
        To opt out of the &ldquo;sale&rdquo; or &ldquo;share&rdquo; of your personal information, you
        may adjust your cookie preferences through our website&rsquo;s cookie tool (where available),
        change your browser or device settings, or contact us using the information in &ldquo;Contact
        Us&rdquo; below. Where technically feasible, we will honor opt-out preference signals, such
        as the Global Privacy Control (&ldquo;GPC&rdquo;), as a valid request to opt out of
        sale/sharing for the browser or device sending the signal.
      </P>
      <P>
        To exercise your right to know, delete, or correct, please contact us as described in
        &ldquo;Contact Us&rdquo; below. We will need to verify your identity before completing
        certain requests, and you may designate an authorized agent to submit a request on your
        behalf in accordance with applicable law.
      </P>

      <H3>Other U.S. State Privacy Rights</H3>
      <P>
        Residents of certain other states (for example, under laws such as the Utah Consumer Privacy
        Act and similar laws in other states) may have rights that are similar to those described
        above, such as the right to access, delete, or correct personal information, and to opt out
        of certain targeted advertising or profiling, to the extent those laws apply to Medspa Maps.
        Where applicable, you may exercise these rights using the contact information below.
      </P>

      <H3>Do Not Track and Global Privacy Control</H3>
      <P>
        Some browsers offer a &ldquo;Do Not Track&rdquo; (DNT) signal. Because there is not yet a
        common industry standard for responding to DNT signals, our website does not currently
        respond differently based on a browser&rsquo;s DNT signal, but we do honor GPC signals for
        opt-out of sale/share requests as described above.
      </P>
      <P>
        The availability and scope of the rights described in this section depend on applicable law
        and may not apply to all users.
      </P>

      <H2>Health-Related Search Information</H2>
      <P>
        Because Medspa Maps helps users search for aesthetic and wellness treatments, search terms
        you enter (such as a treatment or condition) may relate to health or wellness topics. Medspa
        Maps is not a healthcare provider, is not a HIPAA-covered entity, and does not maintain
        medical records. We do not knowingly use treatment or condition search terms to identify a
        specific individual&rsquo;s health condition, but if you are concerned about the sensitivity
        of a search term, you may choose not to enter it.
      </P>

      <H2>Third-Party Websites and Booking Services</H2>
      <P>
        Medspa Maps contains links to independent medspas, provider websites, booking platforms, and
        other third-party websites or services.
      </P>
      <P>
        When you select a link such as a practice website or booking option, you may leave Medspa
        Maps and interact directly with a third party. Those third parties operate independently from
        Medspa Maps and may collect information according to their own privacy policies and
        practices.
      </P>
      <P>
        Medspa Maps is not responsible for the privacy, security, content, or data practices of
        third-party websites or services. We encourage you to review their privacy policies before
        providing personal information.
      </P>

      <H2>Data Retention</H2>
      <P>
        We retain personal information only for as long as reasonably necessary for the purposes
        described in this Privacy Policy, including providing our services, maintaining business
        records, resolving disputes, enforcing agreements, and satisfying applicable legal
        requirements.
      </P>
      <P>
        Retention periods may vary depending on the type of information and the purpose for which it
        was collected.
      </P>

      <H2>Data Security</H2>
      <P>
        We take reasonable administrative and technical measures designed to protect information
        under our control. However, no website, electronic transmission, or data storage system can
        be guaranteed to be completely secure.
      </P>
      <P>
        Accordingly, we cannot guarantee the absolute security of information transmitted to or
        stored through Medspa Maps.
      </P>

      <H2>Children&rsquo;s Privacy</H2>
      <P>
        Medspa Maps is intended for a general audience and is not directed to children under 13. We
        do not knowingly collect personal information from children under 13, and we do not knowingly
        sell or share the personal information of individuals under 16.
      </P>
      <P>
        If we become aware that personal information from a child under 13 has been collected through
        our website, we will take reasonable steps to delete it as appropriate.
      </P>

      <H2>Changes to This Privacy Policy</H2>
      <P>
        We may update this Privacy Policy periodically to reflect changes to Medspa Maps, our
        practices, or applicable requirements.
      </P>
      <P>
        When we make changes, we may update the &ldquo;Last Updated&rdquo; date at the top of this
        page. We encourage users to review this Privacy Policy periodically.
      </P>

      <H2>Contact Us</H2>
      <P>
        If you have questions about this Privacy Policy or wish to submit a privacy-related request
        (including a CCPA request to know, delete, correct, or opt out of sale/sharing), please
        contact Medspa Maps through the contact information provided on our website.
      </P>
    </LegalPage>
  );
}

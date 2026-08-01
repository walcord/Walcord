import Head from 'next/head';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-black font-['Helvetica_Neue',_Helvetica,_Arial,_sans-serif]">
      <Head>
        <title>Terms of Use - WALCORD</title>
      </Head>

      <header className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-6 py-6 z-10 flex justify-between items-center">
        <Link href="/" className="text-xl font-light hover:opacity-50 transition-opacity">✕</Link>
        <h2 className="text-[10px] tracking-[0.2em] uppercase font-medium">Legal</h2>
        <div className="w-6" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 text-sm leading-relaxed text-gray-800">
        <h1 className="font-['Times_New_Roman',_serif] text-4xl mb-2 text-black">Terms of Use</h1>
        <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-12">Last updated: {new Date().toISOString().slice(0,10)}</p>

        <div className="space-y-10">
          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Walcord, you accept and agree to be bound by these Terms of Use. Walcord is a digital media platform providing editorial content, campaigns, and cultural curation.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">2. Intellectual Property</h2>
            <p>
              All content published on Walcord, including articles, photographs, videos, design elements, and branding, is the exclusive property of Walcord or its contributors. You may not reproduce, distribute, or create derivative works without explicit written permission from our editorial team.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">3. User Accounts</h2>
            <p>
              While our content is accessible publicly, certain features may require creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">4. Acceptable Use</h2>
            <p>
              You agree to use Walcord only for lawful purposes. You must not attempt to compromise the platform's security, scrape our editorial data, or use our services to distribute malicious software.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">5. Modifications</h2>
            <p>
              We reserve the right to modify these terms at any time to reflect changes in our editorial direction or legal requirements. Continued use of the platform following any changes constitutes your acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">6. Contact</h2>
            <p>
              For legal inquiries, press, or permissions, please contact <a href="mailto:thewalcord@gmail.com" className="border-b border-black pb-0.5 hover:text-gray-500">thewalcord@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
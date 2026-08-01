import Head from 'next/head';
import Link from 'next/link';

export default function ChildSafety() {
  return (
    <div className="min-h-screen bg-white text-black font-['Helvetica_Neue',_Helvetica,_Arial,_sans-serif]">
      <Head>
        <title>Child Safety - WALCORD</title>
      </Head>

      <header className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-6 py-6 z-10 flex justify-between items-center">
        <Link href="/" className="text-xl font-light hover:opacity-50 transition-opacity">✕</Link>
        <h2 className="text-[10px] tracking-[0.2em] uppercase font-medium">Safety</h2>
        <div className="w-6" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 text-sm leading-relaxed text-gray-800">
        <h1 className="font-['Times_New_Roman',_serif] text-4xl mb-2 text-black">Child Safety Standards</h1>
        <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-12">
          Last updated: {new Date().toISOString().slice(0, 10)}
        </p>

        <div className="space-y-10">
          <section>
            <p>
              At Walcord, we maintain strict editorial and operational standards. We have a zero-tolerance policy toward child sexual exploitation and abuse (CSEA). Protecting minors is a fundamental priority in our digital environment.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">Our Editorial Commitment</h2>
            <p>
              As a media publication, we strictly prohibit the creation, hosting, or linking of any content related to child sexual exploitation or abuse across our platform, articles, and external campaigns.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">Preventive Measures</h2>
            <ul className="space-y-3">
              <li className="flex gap-3"><span className="text-gray-400">—</span> Rigorous editorial review of all content and imagery prior to publication.</li>
              <li className="flex gap-3"><span className="text-gray-400">—</span> Strict vetting of third-party campaigns and external links hosted on our platform.</li>
              <li className="flex gap-3"><span className="text-gray-400">—</span> Securing our platform against malicious uploads or unauthorized content modifications.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">Reporting Concerns</h2>
            <p>
              If you ever identify any content on our platform that raises child safety concerns, or if you detect unauthorized activities, we urge you to report it immediately. We will investigate, remove any violating material, and cooperate fully with law enforcement authorities.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] tracking-[0.15em] uppercase font-medium text-black mb-4">Contact</h2>
            <p>
              To report any concerning activity or content, please contact our editorial team urgently at <a href="mailto:thewalcord@gmail.com" className="border-b border-black pb-0.5 hover:text-gray-500">thewalcord@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
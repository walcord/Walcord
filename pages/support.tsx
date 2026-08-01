import Head from 'next/head';
import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-black font-['Helvetica_Neue',_Helvetica,_Arial,_sans-serif]">
      <Head>
        <title>Support - WALCORD</title>
      </Head>

      <header className="absolute top-0 w-full px-6 py-6 flex justify-between items-center">
        <Link href="/" className="text-xl font-light hover:opacity-50 transition-opacity">✕</Link>
      </header>

      <main className="flex-grow flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="font-['Times_New_Roman',_serif] text-4xl mb-6">Support</h1>
          
          <p className="text-sm text-gray-600 leading-relaxed mb-8">
            Welcome to Walcord Support. If you need assistance with your account, reporting content, or general inquiries, please reach out directly to our team.
          </p>
          
          <div className="inline-flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Email us</span>
            <a
              href="mailto:thewalcord@gmail.com"
              className="text-lg font-light border-b border-black pb-1 hover:text-gray-500 hover:border-gray-500 transition-colors"
            >
              thewalcord@gmail.com
            </a>
          </div>

          <p className="mt-12 text-xs text-gray-400 tracking-wide">
            We aim to respond within 24 hours.
          </p>
        </div>
      </main>
    </div>
  );
}
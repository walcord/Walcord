export default function SupportPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-black px-6">
      <div className="max-w-xl text-center p-8">
        <h1 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Times New Roman' }}>
          Support
        </h1>
        <p className="mb-3" style={{ fontFamily: 'Roboto, sans-serif' }}>
          Welcome to Walcord Support. If you need assistance, please reach out:
        </p>
        <p className="mb-1">
          Email:{' '}
          <a
            href="mailto:support@walcord.com"
            className="text-[#1F48AF] underline"
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            support@walcord.com
          </a>
        </p>
        <p className="mt-6 text-sm text-gray-500" style={{ fontFamily: 'Roboto, sans-serif' }}>
          We respond within 24 hours. Thank you for using Walcord.
        </p>
      </div>
    </div>
  );
}

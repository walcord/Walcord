import Head from "next/head";

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Walcord</title>
        <meta name="description" content="Privacy Policy for Walcord" />
      </Head>
      <main className="mx-auto max-w-3xl px-6 py-12 prose">
        <h1>Privacy Policy</h1>
        <p>Last updated: {new Date().toISOString().slice(0,10)}</p>

        <h2>Data We Collect</h2>
        <ul>
          <li>Email address (for account and login)</li>
          <li>User ID</li>
          <li>User content (favorites, posts, concert photos)</li>
          <li>Product interactions</li>
          <li>Diagnostics (performance and crash data)</li>
          <li>Photos or videos (if uploaded)</li>
        </ul>

        <h2>How We Use Information</h2>
        <ul>
          <li>Account management and app functionality</li>
          <li>Security and support</li>
          <li>App performance</li>
        </ul>

        <p>We do <strong>not</strong> sell personal data or track you across third-party apps or websites.</p>

        <h2>Sharing</h2>
        <p>Only with service providers necessary to run Walcord (hosting, database), under strict agreements.</p>

        <h2>Retention & Deletion</h2>
        <p>You can request deletion anytime at <a href="mailto:hello@walcord.com">hello@walcord.com</a>.</p>

        <h2>Children</h2>
        <p>Walcord is intended for users aged 13+.</p>

        <h2>Contact</h2>
        <p>Email: <a href="mailto:hello@walcord.com">hello@walcord.com</a></p>
      </main>
    </>
  );
}

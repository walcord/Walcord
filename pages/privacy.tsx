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
          <li><strong>Email address</strong> (account creation, transactional emails)</li>
          <li><strong>User ID</strong> (account identifier)</li>
          <li><strong>User content</strong> (favorites, ratings, posts, concert photos you upload)</li>
          <li><strong>Product interactions</strong> (basic in-app actions to improve functionality)</li>
          <li><strong>Diagnostics</strong> (performance/crash logs to keep the app reliable)</li>
          <li><strong>Photos or videos</strong> (only if you choose to upload them)</li>
        </ul>

        <h2>How We Use Information</h2>
        <ul>
          <li>App functionality and account management</li>
          <li>Safety, integrity and support</li>
          <li>Performance and reliability (diagnostics)</li>
        </ul>

        <p>We do <strong>not</strong> sell your data and we do <strong>not</strong> track you across third-party apps or websites.</p>

        <h2>Sharing</h2>
        <p>We share data only with service providers necessary to run the app (hosting, DB) under data-processing agreements.</p>

        <h2>Retention & Deletion</h2>
        <p>You can request deletion of your account and data by emailing <a href="mailto:hello@walcord.com">hello@walcord.com</a>.</p>

        <h2>Children</h2>
        <p>Walcord is intended for users aged 13+.</p>

        <h2>Contact</h2>
        <p>Email: <a href="mailto:hello@walcord.com">hello@walcord.com</a></p>
      </main>
    </>
  );
}

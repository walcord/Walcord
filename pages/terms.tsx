export default function TermsPage() {
  return (
    <main style={{maxWidth: 860, margin: "40px auto", padding: "0 16px", lineHeight: 1.6}}>
      <h1 style={{fontFamily: "Times New Roman, serif"}}>Terms of Use</h1>
      <p>Last updated: {new Date().toISOString().slice(0,10)}</p>

      <h2>1. No Tolerance for Objectionable Content</h2>
      <p>
        Walcord does not tolerate any content that is illegal, hateful, violent, harassing,
        pornographic, discriminatory, or otherwise objectionable. Users must not upload or share
        such content. We may remove content and terminate accounts at our sole discretion.
      </p>

      <h2>2. User-Generated Content</h2>
      <p>
        You are responsible for the content you post. By using Walcord, you agree not to violate
        the rights of others and to comply with applicable laws.
      </p>

      <h2>3. Reporting and Moderation</h2>
      <p>
        Users can report objectionable content using the “Report” button. We review reports and
        take action (including removal and/or account ejection) within 24 hours.
      </p>

      <h2>4. Blocking Users</h2>
      <p>
        You can block other users to avoid abusive interactions. When blocked, their content will
        no longer appear in your feed.
      </p>

      <h2>5. Account Deletion</h2>
      <p>
        You may permanently delete your account at any time in Profile → Settings → Delete Account.
      </p>

      <h2>6. Changes</h2>
      <p>
        We may update these Terms. Continued use of Walcord constitutes acceptance of the updated Terms.
      </p>

      <h2>7. Contact</h2>
      <p>
        For concerns, please contact support@walcord.com. We aim to respond quickly to urgent reports.
      </p>
    </main>
  );
}

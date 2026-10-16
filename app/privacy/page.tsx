export const metadata = { title: "Privacy Policy | CreatorAI OS" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p>Effective date: October 16, 2026</p>
      <p>CreatorAI OS is operated by Matthew Culwell. This policy explains what data the app handles and how. Questions: <a className="underline" href="mailto:matpcul@gmail.com">matpcul@gmail.com</a>.</p>
      <h2 className="text-xl font-semibold">Information we collect</h2>
      <p>Account details you provide (such as email and name), content you create in the app, and basic technical logs needed to run and secure the service.</p>
      <h2 className="text-xl font-semibold">Google and YouTube data</h2>
      <p>CreatorAI OS requests only the YouTube scope <code>https://www.googleapis.com/auth/youtube.upload</code>. It is used solely to upload videos that the owner creates to his own YouTube channel. The app does not read, analyze, or modify other YouTube data.</p>
      <p>OAuth tokens are stored securely and used only for this upload function. Google user data is never sold, shared with third parties, or used for advertising. Use of information received from Google APIs adheres to the Google API Services User Data Policy, including its Limited Use requirements.</p>
      <p>By using the YouTube features you also agree to the <a className="underline" href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, and Google handles data under the <a className="underline" href="https://policies.google.com/privacy">Google Privacy Policy</a>.</p>
      <h2 className="text-xl font-semibold">Revoking access</h2>
      <p>You can revoke CreatorAI OS access to your Google account at any time at <a className="underline" href="https://myaccount.google.com/permissions">https://myaccount.google.com/permissions</a>. You can also email us to request deletion of stored tokens and account data.</p>
      <h2 className="text-xl font-semibold">How we use and share data</h2>
      <p>Data is used only to provide the app. We do not sell personal data. We share it only with infrastructure providers needed to host the service, or when required by law.</p>
      <h2 className="text-xl font-semibold">Retention and security</h2>
      <p>Data is kept while your account is active and deleted on request. We use reasonable safeguards, but no system is perfectly secure.</p>
      <h2 className="text-xl font-semibold">Changes</h2>
      <p>We may update this policy and will change the effective date above when we do.</p>
    </main>
  );
}

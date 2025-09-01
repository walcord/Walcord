import React from "react";

export default function ChildSafety() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-900">
          Walcord – Child Safety Standards
        </h1>
        <p className="mb-4">
          At Walcord, we have a zero-tolerance policy toward child sexual
          exploitation and abuse (CSEA). Protecting minors is a fundamental
          priority, and we are committed to maintaining a safe digital space
          for all our users.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2 text-blue-800">
          Our Commitment
        </h2>
        <p className="mb-4">
          We strictly prohibit the creation, sharing, or promotion of any
          content related to child sexual exploitation or abuse. Any violation
          will result in immediate removal and account suspension.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2 text-blue-800">
          Preventive Measures
        </h2>
        <ul className="list-disc list-inside mb-4 space-y-2">
          <li>Content moderation and proactive monitoring of reported activity.</li>
          <li>Clear reporting tools available inside the app for all users.</li>
          <li>Prohibition of fake profiles and misuse of the platform.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2 text-blue-800">
          Response to Reports
        </h2>
        <ul className="list-disc list-inside mb-4 space-y-2">
          <li>Immediate review and removal of reported content.</li>
          <li>Suspension or termination of accounts violating these policies.</li>
          <li>
            Cooperation with law enforcement authorities when required.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2 text-blue-800">
          Contact
        </h2>
        <p className="mb-4">
          If you encounter any concerning activity, please contact us at:{" "}
          <a
            href="mailto:adrianparedesfuentes@gmail.com"
            className="text-blue-700 underline"
          >
            adrianparedesfuentes@gmail.com
          </a>{" "}
          or use the reporting feature within the app.
        </p>

        <p className="text-sm text-gray-600 mt-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </div>
    </main>
  );
}
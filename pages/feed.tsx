import React from "react";
import Head from "next/head";
import { Feed } from "../components/walcord/Feed";

export default function FeedPage() {
  return (
    <>
      <Head>
        <title>Walcord — The Wall</title>
        <meta name="description" content="Your Walcord wall — recommendations and pending" />
      </Head>
      <div className="min-h-screen bg-white">
        <Feed />
      </div>
    </>
  );
}

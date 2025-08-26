import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import FollowButton from "../../components/social/FollowButton";
import AddFriendButton from "../../components/social/AddFriendButton";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getFollowerCounts } from "../../lib/db/follow";
import FriendRequestsSheet from "../../components/social/FriendRequestsSheet";
import Link from "next/link";
import { motion } from "framer-motion";

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function UserPublicPage() {
  const router = useRouter();
  const { username } = router.query as { username: string };
  const supabase = createClientComponentClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [followers, setFollowers] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("username", username)
        .maybeSingle();
      if (prof) {
        setProfile(prof as Profile);
        const counts = await getFollowerCounts(prof.id);
        setFollowers(counts?.followers_count ?? 0);

        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id === prof.id) {
          const { data: pend } = await supabase.from("friendships")
            .select("id").eq("receiver_id", user.id).eq("status","pending");
          setPendingCount(pend?.length ?? 0);
        }
      }
    })();
  }, [username, supabase]);

  if (!profile) return null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <section className="flex items-center gap-6">
        <div className="relative h-24 w-24 rounded-full overflow-hidden bg-gray-200">
          {profile.avatar_url && (<Image src={profile.avatar_url} alt={profile.username} fill className="object-cover" />)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-serif text-gray-900">{profile.full_name || profile.username}</h1>
          <p className="text-gray-500">@{profile.username}</p>

          <div className="mt-4 flex items-center gap-3">
            <FollowButton profileId={profile.id} />
            <AddFriendButton profileId={profile.id} />
            <span className="text-sm text-gray-600 select-none">{followers} followers</span>

            <FriendRequestsSheet ownerProfileId={profile.id} badgeCount={pendingCount} />
            <Link href="/friends" className="text-sm text-[#1F48AF] underline-offset-4 hover:underline">
              See all friends
            </Link>
          </div>
        </div>
      </section>

      <motion.hr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="my-10 border-gray-200" />

      <section className="rounded-3xl border border-gray-200 p-8 text-gray-500">
        Editorial placeholder
      </section>
    </main>
  );
}

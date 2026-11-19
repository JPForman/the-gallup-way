"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { hasPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/** "Edit profile" shown only to the profile's owner (display only). */
export function OwnProfileActions({ profileId }: { profileId: string }) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!hasPublicEnv()) return;
    void createClient()
      .auth.getSession()
      .then(({ data }) => setIsOwner(data.session?.user.id === profileId));
  }, [profileId]);

  if (!isOwner) return null;
  return (
    <Button asChild variant="outline" className="h-11">
      <Link href="/settings">Edit profile</Link>
    </Button>
  );
}

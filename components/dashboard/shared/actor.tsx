"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/client";

type Actor = { full_name: string; avatar_url: string | null };

let cached: Actor | null | undefined;

export async function getActorProfile(): Promise<Actor | null> {
  if (cached !== undefined) return cached;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    cached = null;
    return cached;
  }
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  cached = (data as Actor | null) ?? null;
  return cached as Actor | null;
}

export function useActor(): Actor | null {
  const [actor, setActor] = useState<Actor | null>(null);

  useEffect(() => {
    void getActorProfile().then(setActor);
  }, []);

  return actor;
}

export function ActorAvatar() {
  const actor = useActor();
  if (!actor) return null;
  return <Avatar name={actor.full_name} src={actor.avatar_url} />;
}

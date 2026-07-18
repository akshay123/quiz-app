import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useGameBroadcast(gameId, onUpdate) {
  useEffect(() => {
    if (!gameId) return;

    const supabase = createClient();
    const channel = supabase.channel(`game:${gameId}`);

    channel
      .on("broadcast", { event: "game_update" }, (payload) => {
        onUpdate(payload.payload);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, onUpdate]);
}

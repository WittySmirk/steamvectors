import { useQuery } from "@tanstack/react-query";

export type GameDetails = {
    app_id: string
    name: string
    genres: string
    developers: string
    header_image: string
}

async function fetchGameDetails(appId: string): Promise<GameDetails>{
    const resp = await fetch(`http://localhost:8000/api/games/${appId}`);

    if (!resp.ok) {
        throw new Error("Failed to fetch game details")
    }

    return resp.json()
}

export function useGameDetails(appId: string | null) {
    return useQuery({
        queryKey: ['game-details', appId],
        queryFn: () => fetchGameDetails(appId!),
        enabled: !!appId,
        staleTime: Infinity,
        gcTime: Infinity
    })
}
import { useQuery } from "@tanstack/react-query";

export type GameProjection = { 
    app_id: string
    name: string
    x: number
    y: number
}

async function fetchProjections(): Promise<GameProjection[]>{
    const resp = await fetch("http://localhost:8000/api/projections?v=2");
    
    if (!resp.ok) {
        throw new Error("Failed to fetch projections")
    }

    return resp.json()
}

export function useGameProjections() {
    return useQuery({
        queryKey: ['game-projections'],
        queryFn: fetchProjections,
        staleTime: Infinity,
        gcTime: Infinity
    })
}
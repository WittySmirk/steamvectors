import { useQuery } from "@tanstack/react-query";

export type MyProjection = { 
    x: number | null
    y: number | null
}

async function fetchMyProjection(): Promise<MyProjection>{
    const resp = await fetch("http://localhost:8000/api/my_projection", {
        credentials: "include"
    });
    
    if (!resp.ok) {
        throw new Error("Failed to fetch my projection")
    }

    return resp.json()
}

export function useMyProjection(enabled: boolean) {
    return useQuery({
        queryKey: ['my-projection'],
        queryFn: fetchMyProjection,
        enabled,
        staleTime: Infinity,
        gcTime: Infinity
    })
}
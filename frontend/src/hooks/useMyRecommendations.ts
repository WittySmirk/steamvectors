import { useQuery } from "@tanstack/react-query";

export type MyRecommendations = [
    {
        app_id: string,
        name: string,
        developers: string,
        genres: string,
        header_image: string,
    }
]

async function fetchMyRecommendations(): Promise<MyRecommendations> {
    const resp = await fetch("http://localhost:8000/api/my_recommendations", {
        credentials: "include"
    })
    
    if (!resp.ok){
        throw new Error("Failed to fetch my recommendations")
    }

    return resp.json();
}

export function useMyRecommendations(enabled: boolean) {
    return useQuery({
        queryKey: ['my-recommendations'],
        queryFn: fetchMyRecommendations,
        enabled,
        staleTime: Infinity,
        gcTime: Infinity
    })
}
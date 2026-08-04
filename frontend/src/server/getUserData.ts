import {createServerFn} from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// TODO: maybe generate types from openapi
interface UserData {
    steamid: string,
    communityvisibilitystate: number,
    profilestate: number,
    personaname: string,
    profileurl: string,
    avatar: string,
    avatarmedium: string,
    avatarfull: string,
    avatarhash: string,
    lastlogoff: number,
    personastate: number,
    primaryclanid: string,
    timecreated: number,
    personastateflags: number
};

export const getCurrentUser = createServerFn({method: "GET"}).handler(async (): Promise<UserData> => {
    const request = getRequest();
    const cookie = request.headers.get("cookie") ?? ""

    const res = await fetch("http://localhost:8000/api/me", {
        headers: {
            cookie
        }
    })

    return res.json()
})
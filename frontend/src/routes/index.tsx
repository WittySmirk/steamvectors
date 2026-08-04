import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';

import { getCurrentUser } from '#/server/getUserData';

export const Route = createFileRoute('/')({ 
  loader: () => getCurrentUser(),
  component: Home
})

async function logout() {
  await fetch("http://localhost:8000/auth/logout", {
    method: "POST",
    credentials: "include"
  })

  window.location.reload()
}

function Home() {
  const [avatarToggled, setAvatarToggled] = useState<boolean>(false);
  const [steamId, setSteamId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const data = Route.useLoaderData();

  async function handleSetUser(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.code == "Enter") {
      setError(null);
      try {
        const resp = await fetch("http://localhost:8000/api/set_user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({id: e.currentTarget.value}),
            credentials: "include",
            redirect: 'manual'
        })

        if (resp.type === 'opaqueredirect') {
          window.location.href = '/';
          return;
        }

        const j = await resp.json().catch(() => null);
        if (j?.detail) {
          setError(j.detail);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    }
  }

  return (
    <div className="p-8">
      {/* TODO: maybe make this the header component*/}
      {data && data.steamid ? 
        <div className="flex w-full justify-between">
          <h1 className="text-2xl">{data.personaname + "'s Steam Vectors"}</h1>
          <div>
            <img src={data.avatarmedium} className="rounded-full" onClick={() => setAvatarToggled(!avatarToggled)} />
            <button className={avatarToggled ? "text-red-500" : "hidden"} onClick={() => logout()}>Logout</button>
          </div>
        </div>
      :
        <div className="flex w-full justify-between">
          <h1 className="text-2xl">Steam Vectors</h1>
          <div>
            <input onKeyDown={handleSetUser} value={steamId} onChange={(e) => setSteamId(e.currentTarget.value)} className="text-xl border-2 border-[#1C2839] p-2 w-100 placeholder-[#1C2839]" placeholder="Enter Steam ID"/>
            {error && <p className="text-red-500">{error}</p>}
          </div>
          <a className="flex items-center justify-center gap-2 bg-[#1C2839] text-white text-xl p-2 rounded-xl" href="http://localhost:8000/auth/steam/login">
            Sign in with Steam 
            <img className="w-10" src="https://i.imgur.com/bRSWE4P.png" />
          </a>
        </div>
      }
      <Canvas />
    </div>
  )
}

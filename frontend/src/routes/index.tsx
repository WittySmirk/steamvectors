import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { getCurrentUser } from '#/server/getUserData';
import { useGameProjections, type GameProjection } from '#/hooks/useGameProjections';

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

function Projections({ games }: { games: GameProjection[] }) {
  const geometry = useMemo(() => {
    let n = 0
    let sumX = 0
    let sumY = 0
    for (let i = 0; i < games.length; i++) {
      const x = games[i].x
      const y = games[i].y
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      sumX += x
      sumY += y
      n++
    }
    const cx = n > 0 ? sumX / n : 0
    const cy = n > 0 ? sumY / n : 0

    const positions = new Float32Array(n * 3)
    let j = 0
    for (let i = 0; i < games.length; i++) {
      const x = games[i].x
      const y = games[i].y
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      positions[j * 3] = x - cx
      positions[j * 3 + 1] = y - cy
      positions[j * 3 + 2] = 0
      j++
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [games])

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={1.5} sizeAttenuation={false} color="#9db4d0" transparent opacity={0.9} />
    </points>
  )
}

function GraphControls() {
  return (
    <OrbitControls
      makeDefault
      enableRotate={false}
      enablePan
      enableZoom
      zoomToCursor
      enableDamping
      dampingFactor={0.1}
      minZoom={40}
      maxZoom={4000}
      mouseButtons={{
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  )
}

function Home() {
  const [avatarToggled, setAvatarToggled] = useState<boolean>(false);
  const [steamId, setSteamId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const {data: games} = useGameProjections();

  const data = Route.useLoaderData();

  async function handleSetUser(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.code == "Enter") {
      setErr(null);
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
          setErr(j.detail);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong");
      }
    }
  }
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#181a1f]">
      <Canvas className="h-full w-full"
      orthographic
      camera={{
        position: [0, 0, 10],
        zoom: 300
      }}>
        <color attach="background" args={['#181a1f']} />
        {games && <Projections games={games} />}
        {games && <GraphControls />}
      </Canvas>
      <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-4 text-white">
        {data && data.steamid ? 
          <div className="flex w-full items-center justify-between">
            <h1 className="text-2xl font-semibold drop-shadow">{data.personaname + "'s Steam Vectors"}</h1>
            <div className="flex items-center gap-3">
              <img src={data.avatarmedium} className="w-10 rounded-full" onClick={() => setAvatarToggled(!avatarToggled)} />
              <button className={avatarToggled ? "text-red-400" : "hidden"} onClick={() => logout()}>Logout</button>
            </div>
          </div>
        :
          <div className="flex w-full items-center justify-between">
            <h1 className="text-2xl font-semibold drop-shadow">Steam Vectors</h1>
            <div>
              <input onKeyDown={handleSetUser} value={steamId} onChange={(e) => setSteamId(e.currentTarget.value)} className="w-64 border-2 border-[#1C2839] bg-[#1C2839] p-2 text-white placeholder-white/50" placeholder="Enter Steam ID"/>
              {err && <p className="text-red-400">{err}</p>}
            </div>
            <a className="flex items-center justify-center gap-2 rounded-xl bg-[#1C2839] p-2 text-xl text-white" href="http://localhost:8000/auth/steam/login">
              Sign in with Steam 
              <img className="w-10" src="https://i.imgur.com/bRSWE4P.png" />
            </a>
          </div>
        }
      </div>
    </div>
  )
}

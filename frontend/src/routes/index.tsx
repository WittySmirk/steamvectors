import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { getCurrentUser } from '#/server/getUserData';
import { useGameProjections, type GameProjection } from '#/hooks/useGameProjections';
import { useGameDetails } from '#/hooks/useGameDetails';
import { buildGenreColorMap, genreColorFor } from '#/lib/genreColors';

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

function Projections({ games, onSelect }: { games: GameProjection[]; onSelect: (game: GameProjection) => void }) {
  const colorMap = useMemo(() => buildGenreColorMap(games), [games])

  const { geometry, vertexToGame } = useMemo(() => {
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
    const colors = new Float32Array(n * 3)
    const vertexToGame = new Int32Array(n)

    let j = 0
    for (let i = 0; i < games.length; i++) {
      const game = games[i]
      if (!Number.isFinite(game.x) || !Number.isFinite(game.y)) continue
      positions[j * 3] = game.x - cx
      positions[j * 3 + 1] = game.y - cy
      positions[j * 3 + 2] = 0
      const [r, g, b] = genreColorFor(game.genres, colorMap)
      colors[j * 3] = r
      colors[j * 3 + 1] = g
      colors[j * 3 + 2] = b
      vertexToGame[j] = i
      j++
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return { geometry: geo, vertexToGame }
  }, [games, colorMap])

  const pointsRef = useRef<THREE.Points>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  const gamesRef = useRef(games)
  gamesRef.current = games
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const vertexToGameRef = useRef(vertexToGame)
  vertexToGameRef.current = vertexToGame

  useEffect(() => {
    const el = gl.domElement
    let down = false
    let downX = 0
    let downY = 0

    function handlePointerDown(e: PointerEvent) {
      down = true
      downX = e.clientX
      downY = e.clientY
    }

    function handlePointerUp(e: PointerEvent) {
      if (!down) return
      down = false
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
      if (moved > 5) return

      const rect = el.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.params.Points.threshold = 2
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

      const points = pointsRef.current
      if (!points) return
      const hits = raycaster.intersectObject(points)
      let best: (typeof hits)[number] | null = null
      for (const h of hits) {
        if (h.distanceToRay != null && (best == null || h.distanceToRay < best.distanceToRay!)) best = h
      }
      if (best?.index == null) return
      const game = gamesRef.current[vertexToGameRef.current[best.index]]
      if (game) onSelectRef.current(game)
    }

    el.addEventListener('pointerdown', handlePointerDown)
    el.addEventListener('pointerup', handlePointerUp)
    return () => {
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl, camera])

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={3} sizeAttenuation={false} vertexColors />
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
      enableDamping
      dampingFactor={0.1}
      minZoom={8}
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
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const {data: games} = useGameProjections();
  const {data: details} = useGameDetails(selectedAppId);

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
        {games && <Projections games={games} onSelect={(g) => setSelectedAppId(g.app_id)} />}
        {games && <GraphControls />}
      </Canvas>
      {details && (
        <div className="absolute bottom-4 left-4 z-10 w-72 overflow-hidden rounded-lg bg-[#1C2839] text-white shadow-xl">
          <button onClick={() => setSelectedAppId(null)} className="absolute right-2 top-2 text-lg leading-none text-white/70 hover:text-white">×</button>
          {details.header_image && <img src={details.header_image} alt={details.name} className="w-full" />}
          <div className="p-3">
            <h2 className="text-lg font-semibold">{details.name}</h2>
            {details.genres && <p className="mt-1 text-sm text-white/70">{details.genres}</p>}
            {details.developers && <p className="mt-1 text-sm text-white/70">{details.developers}</p>}
          </div>
        </div>
      )}
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

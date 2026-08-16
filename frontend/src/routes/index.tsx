import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { getCurrentUser } from '#/server/getUserData';
import { useGameProjections, type GameProjection } from '#/hooks/useGameProjections';
import { useMyProjection } from '#/hooks/useMyProjection';
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

function computeCentroid(games: GameProjection[]): { cx: number; cy: number } {
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
  return { cx: n > 0 ? sumX / n : 0, cy: n > 0 ? sumY / n : 0 }
}

function Projections({ games, onSelect }: { games: GameProjection[]; onSelect: (game: GameProjection) => void }) {
  const colorMap = useMemo(() => buildGenreColorMap(games), [games])

  const groups = useMemo(() => {
    const { cx, cy } = computeCentroid(games)

    const byColor = new Map<string, { color: THREE.Color; gameIndices: number[] }>()
    for (let i = 0; i < games.length; i++) {
      const game = games[i]
      if (!Number.isFinite(game.x) || !Number.isFinite(game.y)) continue
      const [r, g, b] = genreColorFor(game.genres, colorMap)
      const key = `${r},${g},${b}`
      let entry = byColor.get(key)
      if (!entry) {
        entry = { color: new THREE.Color().setRGB(r, g, b), gameIndices: [] }
        byColor.set(key, entry)
      }
      entry.gameIndices.push(i)
    }

    return [...byColor.values()].map(({ color, gameIndices }) => {
      const positions = new Float32Array(gameIndices.length * 3)
      const vertexToGame = new Int32Array(gameIndices.length)
      for (let j = 0; j < gameIndices.length; j++) {
        const gi = gameIndices[j]
        positions[j * 3] = games[gi].x - cx
        positions[j * 3 + 1] = games[gi].y - cy
        positions[j * 3 + 2] = 0
        vertexToGame[j] = gi
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      return { color, geometry: geo, vertexToGame }
    })
  }, [games, colorMap])

  const pointsRefs = useRef<(THREE.Object3D | null)[]>([])
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  const gamesRef = useRef(games)
  gamesRef.current = games
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

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

      let best: { hit: THREE.Intersection; vertexToGame: Int32Array; dist: number } | null = null
      for (const points of pointsRefs.current) {
        if (!points) continue
        const hits = raycaster.intersectObject(points)
        for (const h of hits) {
          const d = h.distanceToRay
          if (d != null && (best == null || d < best.dist)) {
            best = { hit: h, vertexToGame: points.userData.vertexToGame as Int32Array, dist: d }
          }
        }
      }
      if (!best || best.hit.index == null) return
      const game = gamesRef.current[best.vertexToGame[best.hit.index]]
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
    <>
      {groups.map((g, i) => (
        <points
          key={i}
          ref={(el) => {
            pointsRefs.current[i] = el
            if (el) el.userData.vertexToGame = g.vertexToGame
          }}
          geometry={g.geometry}
          frustumCulled={false}
        >
          <pointsMaterial color={g.color} size={3} sizeAttenuation={false} />
        </points>
      ))}
    </>
  )
}

function makeRingTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.arc(64, 64, 58, 0, Math.PI * 2)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

let ringTexture: THREE.Texture | null = null
function getRingTexture(): THREE.Texture {
  if (!ringTexture) ringTexture = makeRingTexture()
  return ringTexture
}

function loadCircularAvatar(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        const img = tex.image
        const size = Math.max(img.width, img.height)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, size, size)

        const mask = document.createElement('canvas')
        mask.width = size
        mask.height = size
        const mctx = mask.getContext('2d')!
        mctx.fillStyle = '#fff'
        mctx.beginPath()
        mctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        mctx.fill()

        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(mask, 0, 0)
        ctx.globalCompositeOperation = 'source-over'

        tex.dispose()
        const circular = new THREE.CanvasTexture(canvas)
        circular.needsUpdate = true
        resolve(circular)
      },
      undefined,
      reject
    )
  })
}

function UserAvatar({ url, position }: { url: string; position: [number, number, number] }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const camera = useThree((s) => s.camera)
  const ref = useRef<THREE.Sprite>(null)
  const ringRef = useRef<THREE.Sprite>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }
    let disposed = false
    loadCircularAvatar(url)
      .then((tex) => {
        if (!disposed) setTexture(tex)
      })
      .catch(() => {
        if (!disposed) setTexture(null)
      })
    return () => {
      disposed = true
    }
  }, [url])

  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])

  useFrame(() => {
    if (!ref.current || !ringRef.current) return
    const px = Math.min(56, Math.max(20, camera.zoom * 0.12))
    const size = px / camera.zoom
    ref.current.scale.set(size, size, 1)
    ringRef.current.scale.set(size * 1.3, size * 1.3, 1)
  })

  if (!texture) return null

  return (
    <group>
      <sprite ref={ringRef} position={position}>
        <spriteMaterial map={getRingTexture()} transparent depthTest={false} depthWrite={false} />
      </sprite>
      <sprite ref={ref} position={position}>
        <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
      </sprite>
    </group>
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

function PixelProbe() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        gl.render(scene, camera)
        const ctx = gl.getContext() as WebGL2RenderingContext
        const w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight
        const buf = new Uint8Array(w * h * 4)
        ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf)
        const colors = new Map<string, number>()
        for (let i = 0; i < w * h; i += 1024) {
          const r = buf[i * 4], g = buf[i * 4 + 1], b = buf[i * 4 + 2]
          const key = `${r >> 4},${g >> 4},${b >> 4}`
          colors.set(key, (colors.get(key) || 0) + 1)
        }
        const top = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
        console.log('PIXELS', JSON.stringify({ w, h, zoom: camera.zoom, distinct: colors.size, top }))
      } catch (e) {
        console.log('PIXELS error', String(e))
      }
    }, 6000)
    return () => clearTimeout(t)
  }, [gl, camera, scene])
  return null
}

function Home() {
  const [avatarToggled, setAvatarToggled] = useState<boolean>(false);
  const [steamId, setSteamId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const {data: games} = useGameProjections();
  const {data: details} = useGameDetails(selectedAppId);
  const data = Route.useLoaderData();
  const {data: myProjection} = useMyProjection(!!data?.steamid);
  const centroid = useMemo(() => games ? computeCentroid(games) : { cx: 0, cy: 0 }, [games]);
  const avatarPos = myProjection && Number.isFinite(myProjection.x) && Number.isFinite(myProjection.y)
    ? [(myProjection.x as number) - centroid.cx, (myProjection.y as number) - centroid.cy, 0] as [number, number, number]
    : null;

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
      if (!gl) { console.log('DIAG', JSON.stringify({ error: 'no webgl context' })); return }
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      const fh = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
      console.log('DIAG', JSON.stringify({
        version: gl.getParameter(gl.VERSION),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        highpSupported: !!fh && fh.precision > 0,
        highpRange: fh ? `${fh.precision}/${fh.rangeMin}/${fh.rangeMax}` : null,
        pixelRatio: window.devicePixelRatio,
        spoofedRendererInfo: !dbg,
      }))
    } catch (e) {
      console.log('DIAG error', e)
    }
  }, [])

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
        {data && avatarPos && <UserAvatar url={data.avatarmedium} position={avatarPos} />}
        {games && <GraphControls />}
        <PixelProbe />
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

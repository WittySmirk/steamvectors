import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react';
import { getCurrentUser } from '#/server/getUserData';

export const Route = createFileRoute('/')({ 
  loader: () => getCurrentUser(),
  component: Home
})

function Home() {
  const data = Route.useLoaderData();

  useEffect(() => {
    console.log(data);
  }, [])
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      {data ? 
        <>
          <h1>{data.personaname}</h1>
          <img src={data.avatarfull} />
        </>
      :
      <a href="http://localhost:8000/auth/steam/login">Sign in with Steam</a>
      }
    </div>
  )
}

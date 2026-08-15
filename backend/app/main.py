import os 
import httpx
import psycopg
from psycopg.rows import dict_row
from urllib.parse import urlencode
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.requests import Request
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# TODO: Dev only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/auth/steam/login")
def steam_redirect():
    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.return_to": "http://localhost:8000/auth/steam/callback",
        "openid.realm": "http://localhost:8000", # TODO: env variable for URL
    }
    url = "https://steamcommunity.com/openid/login?" + urlencode(params)
    return RedirectResponse(url)

@app.get("/auth/steam/callback")
def steam_callback(req: Request):
    params = dict(req.query_params)
    claimed_id = params.get("openid.claimed_id")
    steam_id = ""
    if claimed_id:
        steam_id = claimed_id.split("/")[-1] 
    
    response = RedirectResponse("http://localhost:3000/", status_code=302)

    # TODO: secure in prod
    response.set_cookie("steam_id", steam_id, secure=False, httponly=True)
    
    return response

@app.post("/auth/logout")
def auth_logot():
    response = RedirectResponse("http://localhost:3000/", status_code=204)
    response.delete_cookie(key="steam_id", httponly=True)
    print("deleted steam id")
    return response

class SetUserRequest(BaseModel):
    id: str

# TODO: maybe allow list of users
@app.post("/api/set_user")
async def set_user(req: SetUserRequest):
    response = RedirectResponse("http://localhost:3000/", status_code=302)
    if not req.id:
        print("test")
        return HTTPException(status_code=301, detail="No steam_id provided")

    params = {
        "key": os.environ.get("STEAM_KEY"),
        "steamids": req.id
    }

    url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?" + urlencode(params)

    async with httpx.AsyncClient() as client:
            try:
                r = await client.get(url)
                if len(r.json().get("response").get("players")) == 0:
                    return HTTPException(status_code=400, detail="Steam id does not exist")
                response.set_cookie("steam_id", req.id, secure=False, httponly=True)
                return response

            except httpx.HTTPStatusError as err:
                print("here2")
                return HTTPException(status_code=err.response.status_code, detail="Steam API Error")
            except httpx.RequestError:
                print("here3")
                return HTTPException(status_code=503, detail="Steam API Unreachable") 
    

@app.get("/api/me")
async def get_me(req: Request):
    cookies = dict(req.cookies)
    steam_id = cookies.get("steam_id")
    if not steam_id:
        return HTTPException(status_code=401, detail="No steam_id provided")
    
    params = {
        "key": os.environ.get("STEAM_KEY"),
        "steamids": steam_id
    }
    url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?" + urlencode(params)

    # TODO: maybe allow querying multiple people

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            return response.json().get("response").get("players")[0]

        except httpx.HTTPStatusError as err:
            return HTTPException(status_code=err.response.status_code, detail="Steam API Error")
        except httpx.RequestError:
            return HTTPException(status_code=503, detail="Steam API Unreachable")
    
@app.get("/api/projections")
async def get_projections():
    # TODO: move this out of here and expose db module
    conn_string = os.environ.get("DATABASE_URL")
    if conn_string is None:
        raise ValueError("DATABASE_URL environment variable is required")
    with psycopg.connect(conn_string) as conn:
        with conn.cursor(row_factory=dict_row) as curr:
            curr.execute("""
                SELECT 
                    p.x,
                    p.y,
                    g.app_id,
                    g.genres
                FROM game_embedding_projections p
                JOIN game_embeddings g
                    ON p.game_embedding_id = g.id
            """)
            rows = curr.fetchall()
            response = JSONResponse(content=rows)
            response.headers["Cache-Control"] = "public, max-age=86400"
            return response 

@app.get("/api/games/{app_id}")
async def get_game(app_id: str):
    conn_string = os.environ.get("DATABASE_URL")
    if conn_string is None:
        raise ValueError("DATABASE_URL environment variable is required")
    with psycopg.connect(conn_string) as conn:
        with conn.cursor(row_factory=dict_row) as curr:
            curr.execute("""
            SELECT
                app_id,
                name,
                genres,
                developers,
                header_image
            FROM game_embeddings
            WHERE app_id = %s

            """, (app_id,))
            row = curr.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Game not found")
            return JSONResponse(content=row)

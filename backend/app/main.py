import os 
import httpx
import json
from urllib.parse import urlencode
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.requests import Request
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Dev only
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
    

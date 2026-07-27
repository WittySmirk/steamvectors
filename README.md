# steamvectors

Vectorized embeddings, visualization, and recommendations of Steam games

## Embeddings/Backend
### Python + FastAPI
- Initial data fetched from https://www.kaggle.com/datasets/fronkongames/steam-games-dataset
- Embedded using OpenAI *text-embedding-3-small* model/API
- Player *taste* embedding generated using top played games weighted by playtime and normalized
- Stored in NeonDB with pgvector extension

## Frontend
### React + Vite + Tanstack
- Allows users to login with Steam OAuth
- Visualization of vectorized data with D3.js
- Shows recommended games, pathways to such, and highlights most played/searched for games

## Hosting
### TBD

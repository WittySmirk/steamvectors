import os
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
import numpy as np
import psycopg
import umap

load_dotenv()

conn_string = os.getenv("DATABASE_URL")
if conn_string is None:
    raise ValueError("DATABASE_URL environment variable is required")

game_index = pd.read_parquet('./data/embeddings/game_index.parquet')
embeddings = np.load('./data/embeddings/embeddings.npy')

projection_path = Path('./data/embeddings/umap_2d.npy')

if projection_path.exists():
    print("Loading cached UMAP projection...")
    projection = np.asarray(np.load(projection_path), dtype=np.float32)
else:
    print("Computing UMAP projection...")
    reducer = umap.UMAP(
        n_components=2,
        metric="cosine",
        n_neighbors=15,
        min_dist=0.1,
        random_state=42,
        verbose=True
    )
    projection = np.asarray(reducer.fit_transform(embeddings), dtype=np.float32)
    np.save(projection_path, projection)

assert len(projection) == len(embeddings)

with psycopg.connect(conn_string) as conn:
    conn.execute("CREATE EXTENSION IF NOT EXISTS vector")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS game_embeddings (
            id SERIAL PRIMARY KEY,
            app_id TEXT,
            name TEXT,
            genres TEXT,
            developers TEXT,
            header_image TEXT,
            embedding vector(512)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS game_embedding_projections (
            id SERIAL PRIMARY KEY,
            game_embedding_id INTEGER UNIQUE NOT NULL REFERENCES game_embeddings(id) ON DELETE CASCADE,
            x REAL NOT NULL,
            y REAL NOT NULL
        )
    """)

    # Clear so re-runs don't duplicate. Commit separately so the old data is
    # freed before new rows are written (avoids transient 2x storage).
    conn.execute("TRUNCATE game_embedding_projections, game_embeddings RESTART IDENTITY")
    conn.commit()

with psycopg.connect(conn_string) as conn:
    result = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM game_embeddings").fetchone()
    start_id = result[0] if result else 1

    batch_size = 1000
    for i in range(0, len(game_index), batch_size):
        batch_idx = game_index.iloc[i:i+batch_size]
        batch_emb = embeddings[i:i+batch_size]

        values = [
            (row['appID'], row['name'], row['genres'], row['developers'], row['header_image'], emb.tolist())
            for (_, row), emb in zip(batch_idx.iterrows(), batch_emb)
        ]

        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO game_embeddings (app_id, name, genres, developers, header_image, embedding) VALUES (%s, %s, %s, %s, %s, %s)",
                values
            )

    for i in range(0, len(projection), batch_size):
        batch_proj = projection[i:i+batch_size]

        values = [
            (start_id + j, float(x), float(y))
            for j, (x, y) in enumerate(batch_proj)
        ]

        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO game_embedding_projections (game_embedding_id, x, y) VALUES (%s, %s, %s)",
                values
            )

        start_id += len(batch_proj)

    # Build the HNSW index after data is inserted (faster than indexing during
    # bulk insert). Idempotent so re-runs are safe.
    conn.execute("""
        CREATE INDEX IF NOT EXISTS game_embeddings_embedding_hnsw_idx
        ON game_embeddings USING hnsw (embedding vector_cosine_ops)
    """)

    result = conn.execute("SELECT COUNT(*) FROM game_embeddings").fetchone()
    count = result[0] if result else 0
    print(f"Uploaded {count:,} game embeddings")

    result = conn.execute("SELECT COUNT(*) FROM game_embedding_projections").fetchone()
    proj_count = result[0] if result else 0
    print(f"Uploaded {proj_count:,} game embedding projections")

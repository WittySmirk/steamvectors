import os
from dotenv import load_dotenv
import pandas as pd
import numpy as np
import psycopg

load_dotenv()

conn_string = os.getenv("DATABASE_URL")
if conn_string is None:
    raise ValueError("DATABASE_URL environment variable is required")

game_index = pd.read_parquet('./data/embeddings/game_index.parquet')
embeddings = np.load('./data/embeddings/embeddings.npy')

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

    # Clear so re-runs don't duplicate
    # conn.execute("TRUNCATE game_embeddings")

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

    result = conn.execute("SELECT COUNT(*) FROM game_embeddings").fetchone()
    count = result[0] if result else 0
    print(f"Uploaded {count:,} game embeddings")

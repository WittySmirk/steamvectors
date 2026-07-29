from dotenv import load_dotenv
import os
from openai import OpenAI
import numpy as np
from sklearn.preprocessing import normalize
import pandas as pd
from tqdm import tqdm
import time
import tiktoken
from pathlib import Path

Path("./data/embeddings").mkdir(parents=True, exist_ok=True)

load_dotenv()

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

encoder = tiktoken.encoding_for_model("text-embedding-3-small")

# Batch api calls b/c 50,000+ embeddings
def create_embeddings(batch):
    retries = 0

    while True:
        try:
            response = client.embeddings.create(
                input=batch,
                model="text-embedding-3-small",
                dimensions=512
            )

            return [
                item.embedding for item in response.data
            ]

        except Exception as e:
            if "rate_limit_exceeded" in str(e):
                wait_time = min(60, 2 ** retries)

                print(
                    f"Rate limited. Waiting {wait_time}s..."
                )

                time.sleep(wait_time)
                retries += 1
            else:
                raise

# Cap the token count to prevent failing
def truncate_text(text, max_tokens=7500):
    tokens = encoder.encode(text)

    if len(tokens) > max_tokens:
        tokens = tokens[:max_tokens]

    return encoder.decode(tokens)

steam = pd.read_parquet('./data/processed/games.parquet')
steam = steam.reset_index(drop=True)

steam['embedding_text'] = steam['embedding_text'].apply(truncate_text)

texts = steam['embedding_text'].to_list()

assert len(steam) == len(texts)

batch_size = 25 # 25 at a time

embeddings = []

for i in tqdm(range(0, len(texts), batch_size)):
    batch = texts[i:i+batch_size]
    embeddings.extend(create_embeddings(batch))

    if i % 1000 == 0 and i != 0:
        checkpoint = np.array(embeddings, dtype=np.float32)
        checkpoint = normalize(checkpoint, axis=1)

        np.save(
            './data/embeddings/embedding_checkpoint.npy',
            checkpoint
        )

embeddings = np.asarray(embeddings, dtype=np.float32)

# normalize embeddings for easier cosine similarity
embeddings = normalize(embeddings, axis=1) 

assert len(steam) == len(texts)
# Save embeddings and bind app id and name to indexes
np.save('./data/embeddings/embeddings.npy', embeddings)
steam[['appID', 'name', 'genres', 'developers', 'header_image']].to_parquet('./data/embeddings/game_index.parquet')
# Data Pipeline

### Python setup:

```sh
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

### Env setup:

Set *OPENAI_API_KEY* and *DATABASE_URL*. This project assumes NeonDB with pgvector as the database.

### To run the pipeline, run it in this order:

```sh
python download_data.py
python clean_data.py
python embed_data.py
python upload_embeds.py
```
The dataset contains 124,146 games, so expect ~30+ mins to embed using text-embedding-3-small
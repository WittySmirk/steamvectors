from typing import cast
from datasets import load_dataset
import pandas as pd
from pathlib import Path

Path('./data/raw').mkdir(parents=True, exist_ok=True)

ds = load_dataset("FronkonGames/steam-games-dataset")

steam = cast(pd.DataFrame, ds["train"].to_pandas())

steam.to_parquet("./data/raw/raw_games.parquet")

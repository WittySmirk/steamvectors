from typing import cast
from datasets import load_dataset
import pandas as pd

ds = load_dataset("FronkonGames/steam-games-dataset")

steam = cast(pd.DataFrame, ds["train"].to_pandas())

steam.to_parquet("./data/processed/raw_games.parquet")

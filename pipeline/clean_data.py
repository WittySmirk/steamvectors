from bs4 import BeautifulSoup
import re
import pandas as pd
import numpy as np

# Remove html from descriptions
def strip_html(x: str) -> str:
    return BeautifulSoup(x, "html.parser").get_text(separator=" ")

# Remove markdown patterns
MD_PATTERNS = [
    (r'\*\*(.*?)\*\*', r'\1'),      # bold
    (r'`([^`]*)`', r'\1'),          # inline code
    (r'^#\s+(.*)', r'\1', re.MULTILINE),  # h1 header
    (r'\*([^*]+)\*', r'\1'),        # italic (single asterisk)
]

def strip_md(x: str) -> str:
    for pat, repl, *flags in MD_PATTERNS:
        flag = flags[0] if flags else 0
        x = re.sub(pat, repl, x, flags=flag)
    return x

# Remove html + md
def combined_strip(x: str) -> str:
    no_html = strip_html(x)
    return strip_md(no_html)

# Easier to embed "a, b, c" than [a,b,c]
def list_to_text(x) -> str:
    if isinstance(x, (list, np.ndarray)):
        return ", ".join(x)
    return ""

# Embedding text
def create_embeddings(row):
    return f"""
    Title:
    {row['name']}

    Description:
    {row['description_clean']}

    Genres:
    {row['genres']}

    Categories:
    {row['categories']}

    Developer:
    {row['developers']}

    Publishers:
    {row['publishers']}
    """

steam = pd.read_parquet("./data/raw/raw_games.parquet") # data from download_data.py

# print(steam.columns.to_list())

# keep what we need
steam = steam[[
    'appID',
    'name',
    'detailed_description',
    'developers',
    'publishers',
    'categories',
    'genres',
    'header_image'
]]

steam = steam.drop_duplicates(subset=['appID'])

steam['description_clean'] = (steam['detailed_description'].apply(combined_strip))

for col in ['developers', 'publishers', 'categories', 'genres']:
    steam[col] = steam[col].apply(list_to_text)

steam['embedding_text'] = steam.apply(create_embeddings, axis=1) # row wise

steam.to_parquet("./data/processed/games.parquet")
import kagglehub

# Download latest version
path = kagglehub.dataset_download(
    "fronkongames/steam-games-dataset",
    output_dir="./data/raw/steam_data/"
)

print("Path to dataset files:", path)

import requests

API = "https://minecraft.wiki/api.php"

params = {
    "action": "query",
    "list": "categorymembers",
    "cmtitle": "Category:Minecraft_Dungeons_sound_effects",
    "cmlimit": 500,
    "format": "json"
}

urls = []

while True:
    r = requests.get(API, params=params).json()

    for item in r["query"]["categorymembers"]:
        title = item["title"]

        if title.startswith("File:"):
            fileinfo = requests.get(API, params={
                "action": "query",
                "titles": title,
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json"
            }).json()

            pages = fileinfo["query"]["pages"]

            for page in pages.values():
                urls.append(page["imageinfo"][0]["url"])

    if "continue" not in r:
        break

    params["cmcontinue"] = r["continue"]["cmcontinue"]

with open("sound_urls.txt", "w") as f:
    for url in urls:
        f.write(url + "\n")

print("Lista criada:", len(urls), "arquivos")
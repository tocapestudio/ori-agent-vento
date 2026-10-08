"""Download Ori renders, whiten the light-gray background and build circular-avatar crops."""
import io
from pathlib import Path

import numpy as np
import requests
from PIL import Image

B = "https://static.prod-images.emergentagent.com/jobs/612d0ed0-21ac-4919-a436-9a898fe98c1c/images/"
SRC = {
    "neutral": "93ee8bda6807305ff92a0745a63d82cd8142b728f6a594cde8ad3b0e9d0b580f",
    "happy": "decebc821f352760a9a2d5d8ed4605f0dacd10f95d8957369c909b7a5b80a858",
    "wink": "cde8b9646d0aed396ec8c2b8a4578282208f1fbd2cc9a951cdf4405e50b6c159",
    "thinking": "8dbe4bd57b126cc902d6cde1998b8b0694d4bf4a08a85d644884166ac7038861",
    "idea": "43d7b3abd95b9bc9f50b22b49e959babd969514d407bc063fb964f4679b32238",
    "waving": "8761e6a338454e3492a7fad10a8603d77cea88e7594bf00d1b0ca551b47a028a",
}
OUT = Path("/app/frontend/public/ori")


def whiten(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    corners = np.concatenate([a[:40, :40].reshape(-1, 3), a[:40, -40:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    a = np.clip(a * (255.0 / bg), 0, 255)
    a[a.min(axis=2) > 238] = 255
    return Image.fromarray(a.astype(np.uint8))


for name, h in SRC.items():
    img = whiten(Image.open(io.BytesIO(requests.get(B + h + ".jpeg", timeout=60).content)))
    img.save(OUT / f"{name}.png", optimize=True)
    w, hgt = img.size
    side = int(w * 0.62)
    top = int(hgt * 0.09)
    left = (w - side) // 2
    img.crop((left, top, left + side, top + side)).resize((256, 256), Image.LANCZOS).save(OUT / f"avatar-{name}.png", optimize=True)
    print(name, img.size)

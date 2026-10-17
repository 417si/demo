"""
ポスターから「Web表示用の軽い版」と「SNSシェア用画像(OGP)」を作るスクリプト。

  pip install pillow
  python3 tools/optimize_images.py

入力:  assets/img/poster.jpg（原寸 2894×4093。差し替えるときはこの名前で上書き）
出力:  assets/img/poster-1800.webp / poster-1200.webp … ページに表示する版（content.js の hero.poster）
       assets/img/ogp.jpg          … Xなどにリンクを貼ったときのサムネイル（1200×630）
"""
import os
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
IMG = os.path.join(ROOT, "assets", "img")

im = Image.open(os.path.join(IMG, "poster.jpg")).convert("RGB")
print("poster:", im.size)

for w_, q in ((1800, 80), (1200, 80)):
    web = im.copy()
    web.thumbnail((w_, w_ * im.height // im.width), Image.LANCZOS)
    web.save(os.path.join(IMG, f"poster-{w_}.webp"), "WEBP", quality=q, method=6)
    print(f"-> poster-{w_}.webp", web.size)

W, H = 1200, 630
bg = im.resize((W, int(im.height * W / im.width)), Image.LANCZOS)
top = (bg.height - H) // 3
bg = bg.crop((0, top, W, top + H)).filter(ImageFilter.GaussianBlur(30))
bg = Image.blend(bg, Image.new("RGB", (W, H), (23, 33, 31)), 0.45)
p = im.resize((int(im.width * (H - 50) / im.height), H - 50), Image.LANCZOS)
bg.paste(p, ((W - p.width) // 2, 25))
bg.save(os.path.join(IMG, "ogp.jpg"), quality=88)
print("-> ogp.jpg", bg.size)

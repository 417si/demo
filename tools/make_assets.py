"""
La Magica＊Prism Ceremony — 装飾素材ジェネレーター
  python3 tools/make_assets.py
で assets/svg/ の装飾SVGをすべて作り直します。

ポスターのトンマナ（銀のアールヌーヴォー額縁・羊皮紙・夜の庭・プリズムの光・
ガラスの旗・ボタニカル）に合わせています。色は PALETTE で一括変更できます。
seed（random.Random(数字)）を変えると葉や花の配置が変わります。
"""
import math, random, os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "svg")
os.makedirs(OUT, exist_ok=True)

PALETTE = {
    "line":    "#2E4632",   # 葉や花の線（イラストの主線）
    "leaf1":   "#3F6B38",
    "leaf2":   "#5E8F45",
    "leaf3":   "#8DBF5A",
    "leafHi":  "#C9E59A",
    "night":   "#17211F",
    "night2":  "#22302C",
    "pewter":  "#AEB8B6",
    "pewterL": "#E6ECEA",
    "pewterD": "#4E5957",
    "lilac":   "#C8B4F2",
    "violet":  "#8A55C8",
    "mint":    "#BDF2DC",
    "pink":    "#F6C4DD",
    "glow":    "#FFF4C7",
    "gem":     "#3E86E0",
    "sun":     "#E57A2E",
    "red":     "#D8343C",
    "white":   "#FFFDF6",
    "parch":   "#E9DFC9",
}
P = PALETTE


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def catmull(points):
    d = f"M{f(points[0][0])},{f(points[0][1])}"
    pts = [points[0]] + points + [points[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{f(c1[0])},{f(c1[1])} {f(c2[0])},{f(c2[1])} {f(p2[0])},{f(p2[1])}"
    return d


def svg(w, h, body, defs="", attrs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" {attrs}>'
            f"<defs>{DEFS}{defs}</defs>{body}</svg>")


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fp:
        fp.write(content)
    print("wrote", name, f"{len(content)//1024}KB")


DEFS = f"""
<linearGradient id="gPewter" x1="0" y1="0" x2="1" y2="1">
 <stop offset="0" stop-color="{P['pewterL']}"/><stop offset=".45" stop-color="{P['pewter']}"/>
 <stop offset=".7" stop-color="#8E9997"/><stop offset="1" stop-color="{P['pewterL']}"/>
</linearGradient>
<linearGradient id="gPrism" x1="0" y1="0" x2="1" y2="1">
 <stop offset="0" stop-color="{P['mint']}"/><stop offset=".35" stop-color="{P['lilac']}"/>
 <stop offset=".7" stop-color="{P['pink']}"/><stop offset="1" stop-color="{P['glow']}"/>
</linearGradient>
<linearGradient id="gLeafA" x1="0" y1="0" x2="1" y2="0">
 <stop offset="0" stop-color="{P['leaf1']}"/><stop offset="1" stop-color="{P['leaf2']}"/>
</linearGradient>
<linearGradient id="gLeafB" x1="0" y1="0" x2="1" y2="0">
 <stop offset="0" stop-color="{P['leaf2']}"/><stop offset="1" stop-color="{P['leaf3']}"/>
</linearGradient>
<radialGradient id="gGem" cx=".35" cy=".3" r=".8">
 <stop offset="0" stop-color="#D6ECFF"/><stop offset=".45" stop-color="#6FB0F5"/><stop offset="1" stop-color="#1F5FB8"/>
</radialGradient>
<radialGradient id="gGemV" cx=".35" cy=".3" r=".8">
 <stop offset="0" stop-color="#F6EEFF"/><stop offset=".5" stop-color="{P['lilac']}"/><stop offset="1" stop-color="{P['violet']}"/>
</radialGradient>
<radialGradient id="gGlow">
 <stop offset="0" stop-color="#FFFBE6"/><stop offset=".3" stop-color="{P['glow']}" stop-opacity=".75"/><stop offset="1" stop-color="{P['glow']}" stop-opacity="0"/>
</radialGradient>
"""


# --------------------------------------------------------------- primitives
def leaf(x, y, ang, L, W, fill="url(#gLeafA)", line=True, vein=True, op=1.0):
    """尖った葉（ユーカリ風の細長い葉）。(x,y) が付け根"""
    d = (f"M0,0 C{f(L*.2)},{f(-W)} {f(L*.72)},{f(-W*.95)} {f(L)},0 "
         f"C{f(L*.72)},{f(W*.95)} {f(L*.2)},{f(W)} 0,0Z")
    s = f'<g transform="translate({f(x)},{f(y)}) rotate({f(ang)})" opacity="{op}">'
    s += f'<path d="{d}" fill="{fill}"' + (f' stroke="{P["line"]}" stroke-opacity=".85" stroke-width="{f(max(.6, W*.045))}" stroke-linejoin="round"' if line else "") + "/>"
    if vein:
        s += f'<path d="M{f(L*.04)},0 Q{f(L*.5)},{f(-W*.1)} {f(L*.9)},0" stroke="{P["leafHi"]}" stroke-opacity=".75" stroke-width="{f(max(.6, W*.08))}" fill="none" stroke-linecap="round"/>'
    return s + "</g>"


def petal_flower(x, y, r, n, fill, center, rot=0, pw=.55, line=True):
    s = f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)})">'
    for i in range(n):
        d = (f"M0,0 C{f(r*.2)},{f(-r*pw)} {f(r*.9)},{f(-r*pw*.9)} {f(r)},0 "
             f"C{f(r*.9)},{f(r*pw*.9)} {f(r*.2)},{f(r*pw)} 0,0Z")
        s += f'<path d="{d}" transform="rotate({f(360/n*i)})" fill="{fill}"' + (f' stroke="{P["line"]}" stroke-width="1"' if line else "") + "/>"
    s += f'<circle r="{f(r*.24)}" fill="{center}" stroke="{P["line"]}" stroke-width=".8"/>'
    return s + "</g>"


def hibiscus(x, y, r, rot=0):
    s = f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)})">'
    for i in range(5):
        a = 72 * i
        d = f"M0,0 C{f(r*.1)},{f(-r*.75)} {f(r*1.05)},{f(-r*.8)} {f(r)},0 C{f(r*1.05)},{f(r*.7)} {f(r*.15)},{f(r*.7)} 0,0Z"
        s += f'<path d="{d}" transform="rotate({a})" fill="{P["red"]}" stroke="{P["line"]}" stroke-width="1.1"/>'
        s += f'<path d="M{f(r*.15)},0 L{f(r*.75)},0" transform="rotate({a})" stroke="#8E1622" stroke-width="1" opacity=".7"/>'
    s += f'<path d="M0,0 L{f(r*1.25)},{f(-r*.25)}" stroke="#F3D06A" stroke-width="2.2" stroke-linecap="round"/>'
    s += f'<circle cx="{f(r*1.25)}" cy="{f(-r*.25)}" r="2.6" fill="#F3D06A"/>'
    return s + "</g>"


def lantern(x, y, h):
    """ほおずき（オレンジの提灯の花）"""
    w = h * .62
    d = f"M0,0 C{f(w*.7)},{f(h*.15)} {f(w*.62)},{f(h*.82)} 0,{f(h)} C{f(-w*.62)},{f(h*.82)} {f(-w*.7)},{f(h*.15)} 0,0Z"
    s = f'<g transform="translate({f(x)},{f(y)})">'
    s += f'<path d="{d}" fill="{P["sun"]}" stroke="{P["line"]}" stroke-width="1"/>'
    s += f'<path d="M0,{f(h*.05)} Q{f(w*.22)},{f(h*.5)} 0,{f(h*.95)} M0,{f(h*.05)} Q{f(-w*.22)},{f(h*.5)} 0,{f(h*.95)}" stroke="#A84A12" stroke-width=".9" fill="none"/>'
    s += f'<path d="M0,0 L0,-8" stroke="{P["leaf1"]}" stroke-width="2"/>'
    return s + "</g>"


def bells(x, y, n, rnd):
    """すずらん（白いベル型の花）"""
    s = ""
    for i in range(n):
        bx, by = x + i * 7, y + i * 13
        s += (f'<path d="M{f(bx-6)},{f(by)} Q{f(bx)},{f(by-11)} {f(bx+6)},{f(by)} L{f(bx+7)},{f(by+6)} '
              f'Q{f(bx+3.5)},{f(by+3)} {f(bx)},{f(by+6)} Q{f(bx-3.5)},{f(by+3)} {f(bx-7)},{f(by+6)}Z" '
              f'fill="{P["white"]}" stroke="{P["line"]}" stroke-width=".9"/>')
    return s


def hydrangea(x, y, r, rnd):
    s = f'<g transform="translate({f(x)},{f(y)})">'
    cols = ["#5D8FE0", "#7FA9F0", "#4C72C9", "#A8C4F7"]
    for _ in range(int(r * 1.1)):
        a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(0, r)
        s += petal_flower(math.cos(a) * d, math.sin(a) * d, rnd.uniform(5, 7), 4, rnd.choice(cols), P["white"], rot=rnd.uniform(0, 90), pw=.7)
    return s + "</g>"


def clover(x, y, r, rot=0):
    s = f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)})">'
    for i in range(4):
        s += (f'<path d="M0,0 C{f(-r*.9)},{f(-r*.5)} {f(-r*.6)},{f(-r*1.3)} 0,{f(-r*.85)} '
              f'C{f(r*.6)},{f(-r*1.3)} {f(r*.9)},{f(-r*.5)} 0,0Z" transform="rotate({90*i})" fill="url(#gLeafB)" stroke="{P["line"]}" stroke-width=".9"/>')
    return s + "</g>"


def sunflower(x, y, r, rot=0):
    s = f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)})">'
    for i in range(18):
        s += (f'<path d="M0,0 C{f(r*.3)},{f(-r*.22)} {f(r*.85)},{f(-r*.14)} {f(r)},0 C{f(r*.85)},{f(r*.14)} {f(r*.3)},{f(r*.22)} 0,0Z" '
              f'transform="rotate({20*i})" fill="#F4C431" stroke="{P["line"]}" stroke-width=".8"/>')
    s += f'<circle r="{f(r*.42)}" fill="#6B3F1D" stroke="{P["line"]}" stroke-width="1"/>'
    for i in range(14):
        a = i * 2.4; rr = r * .32 * math.sqrt(i / 14)
        s += f'<circle cx="{f(math.cos(a)*rr)}" cy="{f(math.sin(a)*rr)}" r="1.5" fill="#A8743A"/>'
    return s + "</g>"


def butterfly(x, y, s_, kind, rot=0, cls=""):
    """kind: 'monarch'（オレンジ）/ 'morpho'（青）"""
    if kind == "monarch":
        a, b, vein = "#F28C28", "#E5641A", P["line"]
    else:
        a, b, vein = "#7EC8F5", "#2F7FD6", "#173B66"
    wing = (f'<path d="M0,-2 C-10,-26 -34,-30 -36,-14 C-37,-4 -24,2 0,2Z" fill="{a}" stroke="{vein}" stroke-width="1.6"/>'
            f'<path d="M0,2 C-18,4 -30,16 -22,26 C-14,32 -4,22 0,6Z" fill="{b}" stroke="{vein}" stroke-width="1.6"/>'
            f'<path d="M-4,-4 L-30,-16 M-6,0 L-30,-6 M-4,6 L-20,22" stroke="{vein}" stroke-width="1"/>'
            f'<circle cx="-31" cy="-20" r="1.6" fill="#fff"/><circle cx="-34" cy="-12" r="1.4" fill="#fff"/><circle cx="-24" cy="25" r="1.3" fill="#fff"/>')
    s = (f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)}) scale({f(s_)})" class="{cls}">'
         f'<g class="wl">{wing}</g><g class="wr" transform="scale(-1,1)">{wing}</g>'
         f'<ellipse cx="0" cy="2" rx="2.4" ry="13" fill="{P["line"]}"/>'
         f'<path d="M-1,-9 Q-6,-20 -10,-24 M1,-9 Q6,-20 10,-24" stroke="{P["line"]}" stroke-width="1.2" fill="none"/></g>')
    return s


# --------------------------------------------------------------- hanging glass banner (ポスターの旗)
def make_banner():
    W, H = 160, 400
    defs = f"""
<linearGradient id="gGlass" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#E6D8FA" stop-opacity=".95"/><stop offset=".55" stop-color="#E8F7EF" stop-opacity=".9"/><stop offset="1" stop-color="#C9F0DE" stop-opacity=".85"/>
</linearGradient>
<linearGradient id="gShine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>"""
    body = ("M28,74 L28,300 C28,330 52,334 52,352 C52,372 40,376 40,392 L120,392 C120,376 108,372 108,352 "
            "C108,334 132,330 132,300 L132,74 C132,52 108,40 80,40 C52,40 28,52 28,74Z")
    b = []
    # 吊り紐
    b.append(f'<path d="M80,0 L80,22" stroke="{P["pewterD"]}" stroke-width="2"/>')
    # キャップ（銀・巻き飾り）
    b.append(f'<path d="M22,58 C22,36 50,24 80,24 C110,24 138,36 138,58 L138,70 L22,70Z" fill="url(#gPewter)" stroke="{P["pewterD"]}" stroke-width="2"/>')
    for sx in (1, -1):
        b.append(f'<g transform="translate(80,0) scale({sx},1)"><path d="M58,66 C74,66 82,56 76,48 C71,42 62,46 66,52" fill="none" stroke="{P["pewterD"]}" stroke-width="5" stroke-linecap="round"/>'
                 f'<path d="M58,66 C74,66 82,56 76,48 C71,42 62,46 66,52" fill="none" stroke="{P["pewterL"]}" stroke-width="2.4" stroke-linecap="round"/></g>')
    b.append(f'<circle cx="80" cy="22" r="7" fill="url(#gGemV)" stroke="{P["pewterD"]}" stroke-width="1.5"/>')
    # ガラス本体
    b.append(f'<path d="{body}" fill="url(#gGlass)" stroke="{P["pewterD"]}" stroke-width="2.2"/>')
    b.append(f'<path d="M36,80 L36,296 C36,322 60,330 60,352" fill="none" stroke="{P["violet"]}" stroke-opacity=".35" stroke-width="1.4"/>')
    b.append(f'<path d="M124,80 L124,296 C124,322 100,330 100,352" fill="none" stroke="{P["violet"]}" stroke-opacity=".35" stroke-width="1.4"/>')
    # 紋章：四つ葉の花＋円
    cx, cy = 80, 190
    b.append(f'<circle cx="{cx}" cy="{cy}" r="34" fill="none" stroke="#6F5AA8" stroke-width="2"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="27" fill="none" stroke="#6F5AA8" stroke-width=".9"/>')
    for i in range(4):
        b.append(f'<path d="M0,0 C-11,-8 -10,-22 0,-24 C10,-22 11,-8 0,0Z" transform="translate({cx},{cy}) rotate({90*i})" fill="#B9A3E8" stroke="#6F5AA8" stroke-width="1.4"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="4.5" fill="#6F5AA8"/>')
    for sx in (1, -1):
        b.append(f'<g transform="translate({cx},0) scale({sx},1)"><path d="M0,120 C18,124 30,138 26,152 M0,262 C18,258 30,244 26,230" fill="none" stroke="#7FA86A" stroke-width="2"/>'
                 + leaf(22, 140, -70, 18, 6, P["leaf3"], line=False, vein=False) + leaf(22, 244, 70, 18, 6, P["leaf3"], line=False, vein=False) + "</g>")
    # つや
    b.append(f'<rect x="44" y="70" width="14" height="240" rx="7" fill="url(#gShine)" opacity=".7"/>')
    write("banner.svg", svg(W, H, "".join(b), defs))


# --------------------------------------------------------------- pewter corner ornament (額縁の角)
def scroll_path(d, w=6):
    return (f'<path d="{d}" fill="none" stroke="{P["pewterD"]}" stroke-width="{w+2.6}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="url(#gPewter)" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def make_corner():
    W = H = 140
    b = []
    b.append(scroll_path("M8,132 L8,46 C8,22 22,8 46,8 L132,8", 5))
    b.append(scroll_path("M20,120 L20,52 C20,34 34,20 52,20 L120,20", 2.4))
    b.append(scroll_path("M46,8 C46,30 30,46 8,46", 3))
    b.append(scroll_path("M70,8 C70,28 84,40 98,34 C108,30 106,18 96,20", 3))
    b.append(scroll_path("M8,70 C28,70 40,84 34,98 C30,108 18,106 20,96", 3))
    b.append(scroll_path("M30,30 C48,36 58,50 54,64 C51,74 40,72 42,64", 3))
    # 宝石（青いしずく）
    b.append(f'<path d="M34,22 C42,30 46,38 42,46 C38,52 30,52 26,46 C22,38 26,30 34,22Z" transform="translate(-6,-4) rotate(-45 34 38)" fill="url(#gGem)" stroke="{P["pewterD"]}" stroke-width="1.6"/>')
    write("corner.svg", svg(W, H, "".join(b)))


# --------------------------------------------------------------- ornamental rule (見出し下)
def make_rule():
    W, H = 360, 36
    b = []
    for sx in (1, -1):
        g = (scroll_path("M30,18 C50,18 60,8 74,10 C86,12 84,24 74,24", 2.2)
             + f'<path d="M84,18 L166,18" stroke="{P["pewter"]}" stroke-width="1.6"/>'
             + f'<circle cx="174" cy="18" r="2.2" fill="{P["pewter"]}"/>')
        b.append(f'<g transform="translate(180,0) scale({sx},1) translate(-180,0)">{g}</g>')
    b.append(f'<path d="M180,4 L192,18 L180,32 L168,18Z" fill="url(#gGemV)" stroke="{P["pewterD"]}" stroke-width="1.6"/>')
    b.append(f'<path d="M180,8 L186,18 L180,18Z" fill="#fff" opacity=".7"/>')
    write("rule.svg", svg(W, H, "".join(b)))


# --------------------------------------------------------------- prism sparkle（タイトルの＊）
def make_sparkle():
    W = H = 64
    c = 32
    b = []
    for i in range(8):
        long_ = i % 2 == 0
        L = 28 if long_ else 17
        w = 3.4 if long_ else 2.2
        b.append(f'<path d="M0,-{w} L{L},0 L0,{w}Z" transform="translate({c},{c}) rotate({45*i})" fill="url(#gPrism)"/>')
    for i in range(4):
        a = math.radians(45 * (2 * i + 1))
        b.append(f'<circle cx="{f(c+math.cos(a)*22)}" cy="{f(c+math.sin(a)*22)}" r="2.6" fill="#fff"/>')
    b.append(f'<circle cx="{c}" cy="{c}" r="4.2" fill="#fff"/>')
    write("sparkle.svg", svg(W, H, "".join(b)))


# --------------------------------------------------------------- foliage band (明→暗の境目・フッター上)
def make_band(name, colors, base, seed, H=220, fireflies=False):
    rnd = random.Random(seed)
    W = 1600
    parts = []

    def add(s, x):
        parts.append(s)
        if x < 160:
            parts.append(f'<g transform="translate({W},0)">{s}</g>')
        if x > W - 160:
            parts.append(f'<g transform="translate({-W},0)">{s}</g>')

    for layer, col in enumerate(colors):
        hmin, hmax = [(110, 210), (80, 170), (50, 120)][layer]
        for _ in range(150):
            x = rnd.uniform(0, W)
            L = rnd.uniform(hmin, hmax)
            add(leaf(x, H + 10, rnd.uniform(-125, -55), L, L * rnd.uniform(.16, .24), col, line=False, vein=False), x)
        if layer == 1:
            for _ in range(14):
                x = rnd.uniform(0, W)
                add(clover(x, H - rnd.uniform(40, 90), rnd.uniform(9, 13), rnd.uniform(0, 90)).replace("url(#gLeafB)", col).replace(f'stroke="{P["line"]}"', 'stroke="none"'), x)
    parts.append(f'<rect x="0" y="{H-26}" width="{W}" height="26" fill="{base}"/>')
    if fireflies:
        for _ in range(16):
            x = rnd.uniform(0, W)
            add(f'<circle cx="{f(x)}" cy="{f(rnd.uniform(30, 140))}" r="{f(rnd.uniform(8, 16))}" fill="url(#gGlow)"/>', x)
    write(name, svg(W, H, "".join(parts), "", 'preserveAspectRatio="xMidYMax slice"'))


# --------------------------------------------------------------- parchment texture (タイル可能)
def make_parchment():
    W = H = 360
    defs = """
<filter id="paper" x="0" y="0" width="100%" height="100%">
 <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="7" stitchTiles="stitch" result="m"/>
 <feColorMatrix in="m" type="matrix" values="0 0 0 0 .45  0 0 0 0 .36  0 0 0 0 .22  0 0 0 .55 -.18" result="mott"/>
 <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" stitchTiles="stitch" result="n"/>
 <feColorMatrix in="n" type="matrix" values="0 0 0 0 .4  0 0 0 0 .32  0 0 0 0 .2  0 0 0 .22 -.06" result="grain"/>
 <feMerge><feMergeNode in="mott"/><feMergeNode in="grain"/></feMerge>
</filter>"""
    body = f'<rect width="{W}" height="{H}" fill="{P["parch"]}"/><rect width="{W}" height="{H}" filter="url(#paper)"/>'
    write("parchment.svg", svg(W, H, body, defs))


# --------------------------------------------------------------- 姫の紋章（emblem.svg）の色ちがい
def make_emblem_variants():
    """assets/svg/emblem.svg（黒1色のIllustrator書き出し）から色ちがいを作る。
    紋章を差し替えたら、このスクリプトを実行し直せば全部に反映されます。"""
    import re
    src_path = os.path.join(OUT, "emblem.svg")
    if not os.path.exists(src_path):
        print("skip emblem (assets/svg/emblem.svg がありません)")
        return
    src = open(src_path, encoding="utf-8").read()
    vb = re.search(r'viewBox="([^"]+)"', src).group(1)
    paths = "".join(re.findall(r"<path[^>]*/>", src, re.S))
    paths = re.sub(r'\s(fill|class|style)="[^"]*"', "", paths)
    variants = {
        "emblem-silver.svg": f'''<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{P['pewterL']}"/><stop offset=".45" stop-color="{P['pewter']}"/><stop offset=".7" stop-color="#8E9997"/><stop offset="1" stop-color="{P['pewterL']}"/></linearGradient>''',
        "emblem-prism.svg": f'''<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{P['mint']}"/><stop offset=".4" stop-color="{P['lilac']}"/><stop offset=".75" stop-color="{P['pink']}"/><stop offset="1" stop-color="{P['glow']}"/></linearGradient>''',
        "emblem-ink.svg": f'''<linearGradient id="g"><stop offset="0" stop-color="{P['pewterD']}"/><stop offset="1" stop-color="{P['pewterD']}"/></linearGradient>''',
    }
    for name, grad in variants.items():
        out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><defs>{grad}</defs>'
               f'<g fill="url(#g)">{paths}</g></svg>')
        write(name, out)


if __name__ == "__main__":
    make_emblem_variants()
    # make_banner()  # 旗（今は未使用）
    make_corner()
    make_rule()
    make_sparkle()
    # 明るいストーリー → 夜のキャラクター欄 への境目
    make_band("band-night.svg", ["#3A5A3C", "#2A4230", P["night"]], P["night"], 4, fireflies=True)
    # 羊皮紙 → フッター（夜）への境目
    make_band("band-footer.svg", ["#3A5A3C", "#2A4230", P["night"]], P["night"], 9)
    make_parchment()

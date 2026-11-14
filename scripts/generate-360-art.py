"""Draw the original art for 360: 14 backgrounds, 13 character cut-outs and 4 props, as plain SVG.

Run with Python 3 from the repository root. No dependencies, no external images.

Every picture is flat cut paper: no outlines, no gradients on people, and no faces. A life is
remembered whole only in the dark, and the next person keeps none of it, so nobody in the lit
scenes gets a face. Each era has one small palette. A fixed seed keeps the output reproducible.
"""
import math
import random
from pathlib import Path

DEST = Path(__file__).resolve().parents[1] / 'public/game-list/360/assets'
W, H = 1600, 900


def f(value):
    return f'{value:.1f}'.rstrip('0').rstrip('.')


def rect(x, y, w, h, fill, extra=''):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{fill}"{extra}/>'


def poly(points, fill, extra=''):
    return f'<path d="M{" L".join(f"{f(x)} {f(y)}" for x, y in points)}Z" fill="{fill}"{extra}/>'


def path(d, fill='none', extra=''):
    return f'<path d="{d}" fill="{fill}"{extra}/>'


def circle(x, y, r, fill, extra=''):
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{fill}"{extra}/>'


def ellipse(x, y, rx, ry, fill, extra=''):
    return f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}"{extra}/>'


def line(x1, y1, x2, y2, stroke, width=2, extra=''):
    return (f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{stroke}" '
            f'stroke-width="{f(width)}" stroke-linecap="round"{extra}/>')


def glow(name, color, stops):
    inner = ''.join(f'<stop offset="{offset}" stop-color="{color}" stop-opacity="{opacity}"/>' for offset, opacity in stops)
    return f'<radialGradient id="{name}">{inner}</radialGradient>'


def fade(name, colors, vertical=True):
    inner = ''.join(f'<stop offset="{offset}" stop-color="{color}"/>' for offset, color in colors)
    axis = 'x1="0" y1="0" x2="0" y2="1"' if vertical else 'x1="0" y1="0" x2="1" y2="0"'
    return f'<linearGradient id="{name}" {axis}>{inner}</linearGradient>'


def cut(rng, x, y, w, h, fill, wobble=3, extra=''):
    """A rectangle cut by hand: four corners nudged a little."""
    j = lambda: rng.uniform(-wobble, wobble)
    return poly([(x + j(), y + j()), (x + w + j(), y + j()), (x + w + j(), y + h + j()), (x + j(), y + h + j())], fill, extra)


def write(folder, name, body, defs='', width=W, height=H):
    target = DEST / folder / f'{name}.svg'
    target.parent.mkdir(parents=True, exist_ok=True)
    head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">'
    target.write_text(f'{head}{f"<defs>{defs}</defs>" if defs else ""}\n' + '\n'.join(body) + '\n</svg>\n', encoding='utf-8')
    print(f'{folder}/{name}.svg  {target.stat().st_size:,} bytes')


# ───────────────────────── the dark ─────────────────────────

def dust(rng, count, toward=None):
    out = []
    for _ in range(count):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        size = rng.choice([0.6, 0.6, 0.8, 0.8, 1.0, 1.3, 1.8])
        opacity = rng.uniform(0.08, 0.5)
        if toward:
            dx, dy = toward[0] - x, toward[1] - y
            distance = math.hypot(dx, dy) or 1
            if distance < 150:
                continue
            pull = min(26, 3600 / distance)
            out.append(line(x, y, x + dx / distance * pull, y + dy / distance * pull, '#d7d9de', size,
                            f' opacity="{opacity * 0.7:.2f}"'))
        else:
            out.append(circle(x, y, size, '#d7d9de', f' opacity="{opacity:.2f}"'))
    return out


def void():
    rng = random.Random(360)
    defs = glow('v', '#000', [(0, 0), (0.6, 0), (1, 0.7)])
    body = [rect(0, 0, W, H, '#07080b')] + dust(rng, 260)
    body.append(f'<rect width="{W}" height="{H}" fill="url(#v)"/>')
    write('bg', 'void', body, defs)


def void_light():
    rng = random.Random(361)
    center = (1190, 310)
    defs = (glow('a', '#39404e', [(0, 0.6), (0.5, 0.22), (1, 0)])
            + glow('b', '#e8c98a', [(0, 0.22), (0.4, 0.07), (1, 0)]))
    body = [rect(0, 0, W, H, '#07080b'),
            f'<circle cx="{center[0]}" cy="{center[1]}" r="900" fill="url(#a)"/>',
            f'<circle cx="{center[0]}" cy="{center[1]}" r="300" fill="url(#b)"/>']
    body += dust(rng, 240, toward=center)
    write('bg', 'void_light', body, defs)


def title():
    rng = random.Random(362)
    defs = glow('h', '#f1cf8b', [(0, 0.55), (0.3, 0.16), (1, 0)]) + glow('v', '#000', [(0, 0), (0.55, 0), (1, 0.75)])
    body = [rect(0, 0, W, H, '#07080b')] + dust(rng, 150)
    cx, cy, radius = 1010, 440, 318
    tilt = math.radians(22)
    total = 620
    chosen = 141
    # Faint parallels, so the cloud of points reads as a globe you could put degrees on.
    for latitude in (-50, -20, 10, 40):
        ry = radius * math.cos(math.radians(latitude))
        y = cy - radius * math.sin(math.radians(latitude)) * math.cos(tilt)
        body.append(ellipse(cx, y, ry, ry * math.sin(tilt), 'none', ' stroke="#8f96a3" stroke-width="0.7" opacity="0.2"'))
    front = []
    for index in range(total):
        z = 1 - 2 * (index + 0.5) / total
        ring = math.sqrt(1 - z * z)
        angle = index * math.pi * (3 - math.sqrt(5))
        x, y = ring * math.cos(angle), ring * math.sin(angle)
        y2 = y * math.cos(tilt) - z * math.sin(tilt)
        depth = y * math.sin(tilt) + z * math.cos(tilt)
        px, py = cx + x * radius, cy - y2 * radius
        if index == chosen and depth < 0:
            chosen += 1
        if index == chosen:
            body.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="74" fill="url(#h)"/>')
            front.append(circle(px, py, 4.6, '#f6dca4'))
            continue
        if depth < 0:
            body.append(circle(px, py, 1.1, '#aeb4bf', ' opacity="0.16"'))
        else:
            front.append(circle(px, py, 1.2 + depth * 1.3, '#dfe2e7', f' opacity="{0.32 + depth * 0.5:.2f}"'))
    body += front
    body.append(f'<rect width="{W}" height="{H}" fill="url(#v)"/>')
    write('bg', 'title', body, defs)


# ───────────────────────── 1894 제물포 ─────────────────────────

def straw_bale(rng, x, y, w=118, h=74):
    out = [path(f'M{f(x)} {f(y + 12)} Q{f(x + w / 2)} {f(y - 10)} {f(x + w)} {f(y + 12)} L{f(x + w)} {f(y + h)} L{f(x)} {f(y + h)}Z', '#c9a961')]
    for band in (0.28, 0.72):
        out.append(rect(x + w * band - 4, y + 4, 8, h - 4, '#a2823f'))
    for _ in range(7):
        sx = x + rng.uniform(8, w - 8)
        out.append(line(sx, y + rng.uniform(14, 26), sx + rng.uniform(-3, 3), y + h - rng.uniform(4, 16), '#b3924c', 1.4))
    return out


def jemulpo_yard():
    rng = random.Random(1894)
    defs = fade('s', [(0, '#dcc9a0'), (0.55, '#e9d9b4'), (1, '#d2bd90')]) + glow('g', '#fff3d2', [(0, 0.6), (1, 0)])
    body = [f'<rect width="{W}" height="460" fill="url(#s)"/>', f'<circle cx="520" cy="250" r="260" fill="url(#g)"/>']
    # islands and the sea
    body.append(path('M0 352 Q140 300 300 340 T620 336 Q760 318 900 346 L900 380 L0 380Z', '#9aa391'))
    body.append(rect(0, 362, W, 110, '#8d9b93'))
    for _ in range(46):
        y = rng.uniform(370, 462)
        x = rng.uniform(0, 1150)
        body.append(line(x, y, x + rng.uniform(20, 70), y, '#a9b6ad', 1.6, ' opacity="0.7"'))
    # warships on the horizon: hull, funnels, smoke
    for x, scale in ((250, 1.0), (470, 0.72), (690, 0.86), (120, 0.6)):
        y = 372
        body.append(poly([(x, y), (x + 150 * scale, y), (x + 136 * scale, y + 16 * scale), (x + 10 * scale, y + 16 * scale)], '#4b4f4b'))
        for funnel in (0.36, 0.56):
            body.append(rect(x + 150 * scale * funnel, y - 30 * scale, 10 * scale, 30 * scale, '#4b4f4b'))
            sx, sy = x + 150 * scale * funnel + 5 * scale, y - 30 * scale
            for puff, (dx, dy, r) in enumerate(((6, -10, 7), (20, -20, 10), (40, -27, 13), (66, -31, 16))):
                body.append(circle(sx + dx * scale, sy + dy * scale, r * scale, '#77786f', f' opacity="{0.5 - puff * 0.09:.2f}"'))
        body.append(line(x + 22 * scale, y, x + 22 * scale, y - 44 * scale, '#4b4f4b', 2))
    # junk masts closer in
    for x in (860, 940, 1004):
        body.append(line(x, 300, x, 452, '#5a4630', 4))
        body.append(poly([(x + 3, 312), (x + 58, 336), (x + 54, 420), (x + 3, 434)], '#b99a6a'))
        for rib in range(4):
            body.append(line(x + 3, 330 + rib * 26, x + 56, 348 + rib * 22, '#8d7248', 1.6))
    # mud wall and the storehouse
    body.append(rect(0, 452, W, 448, '#b89c6c'))
    body.append(cut(rng, -10, 420, 1130, 96, '#a98b5c', 4))
    for _ in range(60):
        body.append(circle(rng.uniform(0, 1110), rng.uniform(430, 508), rng.uniform(1.5, 4), '#8f744a', ' opacity="0.5"'))
    body.append(poly([(-10, 420), (1120, 420), (1104, 398), (-10, 398)], '#3d3a36'))
    body.append(cut(rng, 1090, 250, 520, 420, '#8c7350', 3))
    body.append(poly([(1050, 262), (1600, 262), (1600, 150), (1130, 150)], '#34322f'))
    for index in range(14):
        x = 1070 + index * 40
        body.append(line(x + 62, 152, x, 262, '#4a4743', 3))
    body.append(cut(rng, 1210, 330, 260, 340, '#5b4630', 2))
    for board in range(1, 6):
        body.append(line(1210 + board * 43, 334, 1210 + board * 43, 668, '#473624', 2))
    body.append(rect(1196, 470, 290, 26, '#2f2a25'))
    body.append(rect(1318, 458, 46, 50, '#1f1c19'))
    body.append(path('M1328 458 q13 -30 26 0', 'none', ' stroke="#1f1c19" stroke-width="7"'))
    # yard floor, shadows, bales
    body.append(poly([(0, 516), (W, 516), (W, 900), (0, 900)], '#c3a878'))
    body.append(poly([(1090, 670), (1600, 670), (1600, 760), (900, 760)], '#a88c5d', ' opacity="0.6"'))
    for x, y in ((40, 600), (150, 600), (260, 600), (96, 532), (206, 532), (150, 464)):
        body += straw_bale(rng, x, y)
    body.append(ellipse(210, 680, 230, 16, '#9c8052', ' opacity="0.55"'))
    for _ in range(70):
        x, y = rng.uniform(0, W), rng.uniform(690, 900)
        body.append(line(x, y, x + rng.uniform(16, 60), y + rng.uniform(-2, 2), '#ad9060', 1.6, ' opacity="0.6"'))
    write('bg', 'jemulpo_yard', body, defs)


def jemulpo_room():
    rng = random.Random(1895)
    defs = glow('l', '#f2b45a', [(0, 0.75), (0.25, 0.34), (1, 0)]) + glow('v', '#000', [(0, 0), (0.5, 0.1), (1, 0.72)])
    body = [rect(0, 0, W, H, '#231b13'), rect(0, 0, W, 610, '#3a2d1f')]
    # papered doors with a lattice
    for x in (150, 470, 790):
        body.append(cut(rng, x, 110, 290, 480, '#6f5b3d', 2))
        body.append(rect(x + 14, 124, 262, 452, '#8d7650'))
        for column in range(1, 6):
            body.append(line(x + 14 + column * 43.6, 124, x + 14 + column * 43.6, 576, '#4d3d28', 3))
        for row in range(1, 8):
            body.append(line(x + 14, 124 + row * 56.5, x + 276, 124 + row * 56.5, '#4d3d28', 3))
    body.append(rect(0, 96, W, 16, '#1c150e'))
    # chest with brass
    body.append(cut(rng, 1180, 400, 330, 220, '#4a3018', 2))
    body.append(rect(1180, 470, 330, 8, '#2c1c0d'))
    for x in (1218, 1452):
        body.append(rect(x, 412, 22, 196, '#9c7a35', ' opacity="0.8"'))
    body.append(circle(1345, 520, 18, '#b08a3c'))
    body.append(rect(1339, 520, 12, 34, '#b08a3c'))
    # floor and bedding
    body.append(rect(0, 610, W, 290, '#5a4426'))
    for x in range(0, W, 200):
        body.append(line(x + rng.uniform(-6, 6), 610, x + rng.uniform(-40, 40), 900, '#4a3820', 2))
    body.append(path('M60 760 Q260 690 620 708 Q700 716 720 760 L720 900 L60 900Z', '#b9a98a'))
    body.append(path('M60 790 Q300 730 720 770 L720 900 L60 900Z', '#7c5a52'))
    body.append(path('M90 742 q60 -40 150 -22 q40 14 26 44 q-90 26 -176 -22Z', '#d8cbb0'))
    # oil lamp
    body.append(f'<circle cx="1040" cy="470" r="420" fill="url(#l)"/>')
    body.append(rect(1026, 520, 28, 96, '#1f160d'))
    body.append(poly([(1000, 616), (1080, 616), (1066, 600), (1014, 600)], '#1f160d'))
    body.append(ellipse(1040, 520, 34, 10, '#2e2114'))
    body.append(path('M1040 506 q-12 -22 0 -46 q14 24 0 46Z', '#ffd98a'))
    body.append(f'<rect width="{W}" height="{H}" fill="url(#v)"/>')
    write('bg', 'jemulpo_room', body, defs)


# ───────────────────────── 1952 부산 ─────────────────────────

def hill_shacks(rng, body, base_y, top_y, lit, wall_colors, roof):
    for row in range(7):
        y = top_y + (base_y - top_y) * row / 7
        x = rng.uniform(-30, 20)
        while x < W:
            w, h = rng.uniform(54, 110), rng.uniform(34, 56)
            body.append(cut(rng, x, y + rng.uniform(-6, 6), w, h, rng.choice(wall_colors), 2))
            body.append(poly([(x - 5, y + 2), (x + w + 5, y - rng.uniform(2, 10)), (x + w + 5, y + 6), (x - 5, y + 10)], roof))
            if rng.random() < lit:
                body.append(rect(x + w * 0.3, y + h * 0.42, 13, 12, '#e8b060'))
            x += w + rng.uniform(2, 16)


def market_base(rng, sky, hill, tarps, ground, pole):
    body = [rect(0, 0, W, H, sky)]
    body.append(path('M0 300 Q300 180 620 250 T1200 210 Q1420 190 1600 260 L1600 420 L0 420Z', hill))
    return body, ground, pole, tarps


def busan_market():
    rng = random.Random(1952)
    body = [rect(0, 0, W, H, '#a9b2b5')]
    body.append(path('M0 300 Q300 170 620 240 T1200 200 Q1420 180 1600 250 L1600 430 L0 430Z', '#7f8a8d'))
    hill = []
    hill_shacks(rng, hill, 420, 220, 0, ['#6d7679', '#737d80', '#687174'], '#565e60')
    body.append('<g opacity="0.75">' + ''.join(hill) + '</g>')
    body.append(rect(0, 410, W, 490, '#6b6257'))
    # poles and patched tarps
    for x in range(40, W, 190):
        body.append(line(x + rng.uniform(-8, 8), 150, x + rng.uniform(-8, 8), 700, '#4a3d30', 7))
    tarp = ['#6f7350', '#7c7a58', '#c9c2a6', '#8a5a3c', '#5f6647', '#b7ae90']
    x = -40
    while x < W:
        w = rng.uniform(190, 330)
        y = rng.uniform(96, 150)
        sag = rng.uniform(18, 44)
        color = rng.choice(tarp)
        body.append(path(f'M{f(x)} {f(y)} L{f(x + w)} {f(y + rng.uniform(-14, 14))} L{f(x + w + 10)} {f(y + 150)} '
                         f'Q{f(x + w / 2)} {f(y + 150 + sag)} {f(x - 10)} {f(y + 142)}Z', color))
        if rng.random() < 0.6:
            body.append(cut(rng, x + rng.uniform(30, w - 90), y + rng.uniform(30, 80), rng.uniform(36, 70), rng.uniform(26, 46),
                            rng.choice(tarp), 3, ' opacity="0.85"'))
        x += w - rng.uniform(10, 40)
    for x in (300, 760, 1240):
        body.append(line(x, 250, x, 318, '#2f2a24', 2))
        body.append(circle(x, 326, 10, '#f3e3a8'))
        body.append(circle(x, 326, 34, '#f3e3a8', ' opacity="0.14"'))
    # the stall: boards, tins, cartons, crates
    body.append(cut(rng, 520, 560, 1120, 42, '#5a4631', 3))
    body.append(rect(540, 600, 1100, 300, '#463729'))
    for column in range(7):
        for level in range(rng.randint(2, 4)):
            x, y = 590 + column * 62, 512 - level * 50
            body.append(rect(x, y, 48, 48, rng.choice(['#3f5b6e', '#8a3b2c', '#3f5b6e'])))
            body.append(rect(x, y + 14, 48, 16, '#e3d9bf'))
            body.append(ellipse(x + 24, y, 24, 5, '#c7ccd0'))
    for row in range(4):
        y = 536 - row * 26
        body.append(rect(1060, y, 150, 24, '#d9d2c0'))
        body.append(rect(1060, y, 150, 7, '#a33a2b'))
        body.append(circle(1090, y + 15, 6, '#a33a2b'))
    for x, y, w, h in ((1260, 470, 150, 90), (1400, 500, 130, 60), (1290, 400, 110, 70)):
        body.append(cut(rng, x, y, w, h, '#8f7a55', 2))
        body.append(rect(x + 14, y + h * 0.4, w - 28, 8, '#3c3327'))
        body.append(rect(x + 14, y + h * 0.4 + 16, (w - 28) * 0.6, 8, '#3c3327'))
    body.append(cut(rng, 40, 600, 420, 130, '#55503f', 4))
    body.append(cut(rng, 70, 560, 180, 60, '#6f7350', 3))
    for _ in range(80):
        x, y = rng.uniform(0, W), rng.uniform(730, 900)
        body.append(line(x, y, x + rng.uniform(20, 80), y + rng.uniform(-3, 3), '#5b5349', 2, ' opacity="0.7"'))
    write('bg', 'busan_market', body)


def market_fire():
    rng = random.Random(1953)
    defs = (glow('f', '#ff8a2a', [(0, 0.95), (0.35, 0.5), (1, 0)])
            + fade('s', [(0, '#120d0c'), (0.6, '#3a1a10'), (1, '#6a2a12')]))
    body = [f'<rect width="{W}" height="{H}" fill="url(#s)"/>',
            f'<ellipse cx="520" cy="560" rx="1100" ry="560" fill="url(#f)"/>']
    for _ in range(9):
        x = rng.uniform(60, 1300)
        body.append(path(f'M{f(x)} 470 q{f(rng.uniform(-90, 90))} -160 {f(rng.uniform(-40, 160))} -300 '
                         f'q{f(rng.uniform(40, 150))} -110 {f(rng.uniform(120, 300))} -190 '
                         f'q{f(rng.uniform(-60, 40))} 260 {f(rng.uniform(-200, -80))} 490Z', '#241816', ' opacity="0.55"'))
    for _ in range(26):
        x, base = rng.uniform(-40, 1180), rng.uniform(470, 560)
        height, width = rng.uniform(90, 300), rng.uniform(46, 120)
        body.append(path(f'M{f(x)} {f(base)} q{f(-width * 0.3)} {f(-height * 0.5)} {f(width * 0.34)} {f(-height)} '
                         f'q{f(width * 0.1)} {f(height * 0.42)} {f(width * 0.46)} {f(height * 0.36)} '
                         f'q{f(width * 0.3)} {f(height * 0.3)} {f(width * 0.2)} {f(height * 0.64)}Z',
                         rng.choice(['#f0702a', '#f79a3a', '#ffc45e', '#e85a22'])))
    for x in range(40, W, 190):
        body.append(line(x + rng.uniform(-8, 8), 250, x + rng.uniform(-14, 14), 720, '#0d0907', 8))
    x = -40
    while x < W:
        w = rng.uniform(190, 330)
        y = rng.uniform(300, 360)
        body.append(path(f'M{f(x)} {f(y)} L{f(x + w)} {f(y + rng.uniform(-14, 14))} L{f(x + w + 10)} {f(y + 130)} '
                         f'Q{f(x + w / 2)} {f(y + 170)} {f(x - 10)} {f(y + 124)}Z', '#0f0a08'))
        x += w - rng.uniform(10, 40)
    body.append(rect(0, 640, W, 260, '#0d0907'))
    body.append(cut(rng, 520, 610, 1120, 40, '#170f0b', 3))
    for _ in range(120):
        body.append(circle(rng.uniform(0, 1500), rng.uniform(20, 520), rng.uniform(1, 3.4), rng.choice(['#ffd27a', '#ff9a3c']),
                           f' opacity="{rng.uniform(0.3, 0.95):.2f}"'))
    write('bg', 'market_fire', body, defs)


def busan_shack():
    rng = random.Random(1954)
    defs = fade('s', [(0, '#0e1420'), (1, '#1c2940')])
    body = [f'<rect width="{W}" height="{H}" fill="url(#s)"/>']
    for _ in range(70):
        body.append(circle(rng.uniform(0, W), rng.uniform(0, 240), rng.uniform(0.5, 1.3), '#cfd6e2', f' opacity="{rng.uniform(0.2, 0.7):.2f}"'))
    # harbour far below
    body.append(rect(980, 330, 620, 120, '#101a2b'))
    body.append(poly([(1180, 380), (1420, 380), (1400, 404), (1200, 404)], '#070b12'))
    body.append(rect(1290, 346, 16, 34, '#070b12'))
    for _ in range(40):
        x, y = rng.uniform(990, 1600), rng.uniform(332, 440)
        body.append(rect(x, y, rng.uniform(2, 5), 2, '#e8c070', f' opacity="{rng.uniform(0.3, 0.9):.2f}"'))
    body.append(path('M0 300 Q360 210 760 300 Q1000 350 1100 470 L1600 520 L1600 900 L0 900Z', '#161d2a'))
    shacks = []
    hill_shacks(rng, shacks, 760, 290, 0.16, ['#27303e', '#2c3442', '#232b38', '#30323a'], '#11161f')
    body.append('<g clip-path="url(#h)">' + ''.join(shacks) + '</g>')
    defs += '<clipPath id="h"><path d="M0 280 Q360 200 760 290 Q1000 340 1110 460 L1600 510 L1600 900 L0 900Z"/></clipPath>'
    # steps down the hill
    for step in range(16):
        y = 470 + step * 28
        body.append(rect(700 + step * 9, y, 150 - step * 2, 9, '#3a4352'))
    # the near shack: plank wall, a lit paper window, a stovepipe
    body.append(cut(rng, 980, 560, 640, 360, '#2b2a2c', 3))
    for board in range(11):
        body.append(line(980 + board * 60, 566, 980 + board * 60 + rng.uniform(-4, 4), 900, '#1d1c1f', 3))
    body.append(poly([(950, 572), (1600, 520), (1600, 548), (950, 600)], '#0f1218'))
    body.append(circle(1260, 690, 150, '#e8b060', ' opacity="0.12"'))
    body.append(rect(1200, 640, 130, 104, '#e2b565'))
    body.append(line(1265, 640, 1265, 744, '#5d4526', 5))
    body.append(line(1200, 692, 1330, 692, '#5d4526', 5))
    body.append(rect(1470, 440, 16, 110, '#0f1218'))
    body.append(path('M1478 440 q-30 -50 -4 -110 q30 40 4 110Z', '#3a4352', ' opacity="0.45"'))
    write('bg', 'busan_shack', body, defs)


def seoul_room():
    rng = random.Random(1967)
    body = [rect(0, 0, W, 640, '#c2b08f'), rect(0, 640, W, 260, '#8d7450')]
    for x in range(0, W, 46):
        body.append(rect(x, 0, 14, 640, '#b9a684'))
    for x in range(0, W, 180):
        body.append(line(x + rng.uniform(-5, 5), 640, x + rng.uniform(-50, 50), 900, '#7c6544', 2))
    # window: saw-tooth roofs, chimneys, smoke
    body.append(rect(820, 120, 520, 360, '#5d4a33'))
    body.append(rect(840, 140, 480, 320, '#aab4b8'))
    for index in range(5):
        x = 840 + index * 96
        body.append(poly([(x, 380), (x + 70, 320), (x + 96, 320), (x + 96, 380)], '#5f676c'))
    body.append(rect(840, 380, 480, 80, '#565d62'))
    for x, top in ((930, 190), (1150, 220)):
        body.append(poly([(x, 380), (x + 8, top), (x + 30, top), (x + 38, 380)], '#474c50'))
        body.append(path(f'M{x + 19} {top} q50 -30 130 -22 q-40 22 -44 50 q-50 -6 -86 -28Z', '#c9cfd2', ' opacity="0.75"'))
    body.append(line(1080, 140, 1080, 460, '#5d4a33', 12))
    body.append(line(840, 300, 1320, 300, '#5d4a33', 10))
    # calendar, a nail, folded bedding
    body.append(rect(380, 170, 190, 250, '#ece3cc'))
    body.append(rect(380, 170, 190, 70, '#9a3b2c'))
    for row in range(5):
        for column in range(7):
            body.append(rect(394 + column * 24, 256 + row * 30, 14, 14, '#b9ad92' if column else '#c9897c'))
    body.append(cut(rng, 60, 470, 300, 60, '#7b5d68', 3))
    body.append(cut(rng, 70, 530, 280, 56, '#b9a98a', 3))
    body.append(cut(rng, 64, 586, 292, 60, '#5f7068', 3))
    # low table: kettle, medicine packets, a bowl
    body.append(poly([(900, 700), (1420, 700), (1470, 740), (850, 740)], '#5b3d22'))
    body.append(rect(880, 740, 30, 90, '#472e18'))
    body.append(rect(1410, 740, 30, 90, '#472e18'))
    body.append(path('M1000 700 q0 -80 60 -80 q60 0 60 80Z', '#c9a23a'))
    body.append(path('M1120 660 q40 -4 44 -34', 'none', ' stroke="#c9a23a" stroke-width="10" stroke-linecap="round"'))
    body.append(rect(1046, 606, 28, 14, '#8d7022'))
    for index in range(4):
        body.append(cut(rng, 1200 + index * 44, 676 - index * 2, 40, 26, '#f1ead8', 2))
    body.append(ellipse(1390, 694, 44, 12, '#e9e2d0'))
    write('bg', 'seoul_room', body)


# ───────────────────────── 1988 서울 ─────────────────────────

def bed(rng, body, x, y, scale=1.0):
    s = scale
    for post in (x, x + 300 * s):
        body.append(rect(post, y - 170 * s, 9 * s, 330 * s, '#d9dcdc'))
    body.append(rect(x, y - 170 * s, 300 * s, 9 * s, '#d9dcdc'))
    for bar in range(1, 6):
        body.append(rect(x + bar * 50 * s, y - 166 * s, 5 * s, 120 * s, '#d9dcdc'))
    body.append(cut(rng, x - 20 * s, y - 50 * s, 720 * s, 46 * s, '#f1efe6', 2))
    body.append(cut(rng, x - 20 * s, y - 6 * s, 720 * s, 110 * s, '#9fb7c4', 2))
    body.append(cut(rng, x + 6 * s, y - 84 * s, 160 * s, 44 * s, '#fbfaf4', 3))


def ward():
    rng = random.Random(1988)
    body = [rect(0, 0, W, 350, '#e7e1cf'), rect(0, 350, W, 300, '#b7c8bb'), rect(0, 344, W, 10, '#93a698'),
            rect(0, 650, W, 250, '#9aa39a')]
    for x in range(0, W, 160):
        body.append(line(x, 650, x - 70, 900, '#8b948b', 2))
    for y in (720, 800):
        body.append(line(0, y, W, y, '#8b948b', 2))
    # window with blinds
    body.append(rect(90, 90, 420, 330, '#f5f1e4'))
    body.append(rect(110, 110, 380, 290, '#b9cfdd'))
    for slat in range(13):
        body.append(rect(110, 112 + slat * 22, 380, 12, '#eeeadc'))
    body.append(line(300, 110, 300, 400, '#f5f1e4', 10))
    # curtain rail and a drawn curtain
    body.append(rect(0, 60, W, 8, '#b9b5a6'))
    body.append(path('M560 68 L680 68 Q690 380 670 640 L590 640 Q570 380 560 68Z', '#d9c8b0'))
    for fold in range(4):
        body.append(line(585 + fold * 24, 72, 596 + fold * 20, 636, '#c3b196', 3))
    # television on a bracket: a boy rolling a hoop across a wide field
    body.append(rect(1130, 76, 16, 60, '#6f6c64'))
    body.append(cut(rng, 1010, 130, 300, 220, '#4b4640', 3))
    body.append(path('M1034 152 Q1160 144 1286 152 Q1294 240 1286 328 Q1160 336 1034 328 Q1026 240 1034 152Z', '#2f5f47'))
    body.append(rect(1036, 290, 248, 4, '#d8e6da', ' opacity="0.4"'))
    body.append(circle(1150, 262, 13, 'none', ' stroke="#f4f1e2" stroke-width="3"'))
    body.append(rect(1168, 244, 6, 20, '#f4f1e2'))
    body.append(circle(1171, 238, 5, '#f4f1e2'))
    for knob in range(3):
        body.append(circle(1296, 180 + knob * 30, 6, '#8d887c'))
    # beds and a drip stand
    bed(rng, body, 700, 620, 0.9)
    bed(rng, body, -60, 700, 1.1)
    body.append(rect(1440, 230, 7, 470, '#cfd2d2'))
    body.append(rect(1396, 230, 96, 7, '#cfd2d2'))
    body.append(path('M1400 244 h44 v70 q-22 22 -44 0Z', '#eef3f2', ' opacity="0.9"'))
    body.append(path('M1422 330 q-6 120 -60 200', 'none', ' stroke="#e9eeee" stroke-width="2.5"'))
    body.append(rect(1380, 700, 130, 8, '#b9bcbc'))
    write('bg', 'ward', body)


def hangang_night():
    rng = random.Random(1989)
    defs = fade('s', [(0, '#0a1120'), (1, '#1b2a44')])
    body = [f'<rect width="{W}" height="520" fill="url(#s)"/>']
    for cx, cy, radius, color, spokes in ((520, 190, 170, '#86d695', 34), (1010, 250, 120, '#f0d27a', 26), (270, 320, 86, '#e58f86', 20)):
        body.append(circle(cx, cy, radius * 1.5, color, ' opacity="0.06"'))
        for spoke in range(spokes):
            angle = spoke / spokes * math.tau + rng.uniform(-0.05, 0.05)
            inner, outer = radius * rng.uniform(0.3, 0.45), radius * rng.uniform(0.82, 1.0)
            x1, y1 = cx + math.cos(angle) * inner, cy + math.sin(angle) * inner
            x2, y2 = cx + math.cos(angle) * outer, cy + math.sin(angle) * outer + radius * 0.08
            body.append(line(x1, y1, x2, y2, color, 3, ' opacity="0.9"'))
            body.append(circle(x2, y2 + 4, 3.4, color))
    # far bank
    body.append(rect(0, 470, W, 60, '#0c1220'))
    for _ in range(26):
        x, w, h = rng.uniform(0, W), rng.uniform(40, 110), rng.uniform(20, 90)
        body.append(rect(x, 480 - h, w, h, '#0c1220'))
        for _ in range(int(w * h / 500)):
            body.append(rect(x + rng.uniform(4, w - 8), 480 - h + rng.uniform(4, h - 6), 4, 4, '#e3c57c', f' opacity="{rng.uniform(0.25, 0.8):.2f}"'))
    body.append(rect(0, 520, W, 250, '#111b2e'))
    for color, around, spread in (('#86d695', 520, 240), ('#f0d27a', 1010, 180), ('#e3c57c', 800, 800)):
        for _ in range(46):
            x, y = rng.gauss(around, spread / 2), rng.uniform(530, 760)
            body.append(line(x, y, x + rng.uniform(10, 46), y, color, 2, f' opacity="{rng.uniform(0.1, 0.4):.2f}"'))
    # the bridge the two of them sit under
    body.append(poly([(0, 420), (W, 372), (W, 396), (0, 448)], '#070a12'))
    for index in range(9):
        x = index * 200 - 40
        y = 434 - index * 6
        body.append(rect(x, y, 26, 330, '#070a12'))
        body.append(path(f'M{x + 26} {y + 40} Q{x + 113} {y - 26} {x + 200} {y + 34} L{x + 200} {y + 6} L{x + 26} {y + 12}Z', '#070a12'))
        body.append(circle(x + 13, y - 22, 4, '#f3dc9a'))
        body.append(circle(x + 113, y - 26, 4, '#f3dc9a'))
    body.append(path('M0 760 Q400 720 900 750 T1600 730 L1600 900 L0 900Z', '#0b1210'))
    for _ in range(150):
        x = rng.uniform(0, W)
        y = 742 + rng.uniform(0, 30)
        body.append(line(x, y, x + rng.uniform(-6, 6), y - rng.uniform(8, 22), '#16221c', 2))
    write('bg', 'hangang_night', body, defs)


# ───────────────────────── 2026 서울 ─────────────────────────

def edit_room():
    rng = random.Random(2026)
    defs = glow('e', '#3ddc84', [(0, 0.5), (1, 0)]) + glow('m', '#6fb6c9', [(0, 0.3), (1, 0)])
    body = [rect(0, 0, W, H, '#14171c'), rect(0, 640, W, 260, '#0e1014')]
    for column in range(9):
        for row in range(3):
            body.append(cut(rng, 60 + column * 150, 70 + row * 150, 136, 136, rng.choice(['#1c2027', '#1a1e24', '#20242c']), 1))
    # door and the exit sign above it
    body.append(rect(1390, 190, 170, 450, '#22262d'))
    body.append(rect(1404, 204, 142, 436, '#1a1d23'))
    body.append(rect(1416, 420, 8, 44, '#6b7079'))
    body.append(f'<circle cx="1475" cy="148" r="150" fill="url(#e)"/>')
    body.append(rect(1416, 122, 118, 50, '#2fbf71'))
    body.append(rect(1464, 132, 20, 30, '#eafff2'))
    body.append(poly([(1492, 147), (1516, 147), (1508, 139), (1516, 147), (1508, 155)], 'none', ' stroke="#eafff2" stroke-width="4"'))
    body.append(circle(1446, 138, 5, '#eafff2'))
    body.append(path('M1446 144 l-8 12 M1446 144 l8 10 M1446 144 v10', 'none', ' stroke="#eafff2" stroke-width="3" stroke-linecap="round"'))
    # desk, two monitors
    body.append(f'<ellipse cx="640" cy="430" rx="700" ry="330" fill="url(#m)"/>')
    body.append(poly([(60, 620), (1320, 620), (1380, 670), (0, 670)], '#2a2622'))
    body.append(rect(0, 670, 1380, 14, '#1c1916'))
    for x, kind in ((150, 'wave'), (700, 'timeline')):
        body.append(rect(x, 250, 500, 300, '#0b0d10'))
        body.append(rect(x + 12, 262, 476, 276, '#10202a' if kind == 'wave' else '#161a22'))
        body.append(rect(x + 230, 550, 40, 50, '#0b0d10'))
        body.append(rect(x + 170, 598, 160, 12, '#0b0d10'))
        if kind == 'wave':
            for bar in range(92):
                height = abs(math.sin(bar * 0.37) * math.sin(bar * 0.11 + 1)) * 96 + rng.uniform(2, 16)
                body.append(rect(x + 24 + bar * 5, 400 - height / 2, 3, height, '#6fd0c4'))
            body.append(rect(x + 280, 280, 2, 240, '#f2d14e'))
            body.append(rect(x + 24, 500, 452, 4, '#27414d'))
        else:
            for track in range(5):
                tx = x + 24
                while tx < x + 460:
                    w = rng.uniform(26, 110)
                    body.append(rect(tx, 420 + track * 22, min(w, x + 476 - tx), 16, rng.choice(['#4f6a8c', '#7a5c8a', '#4f8c79', '#8c7a4f'])))
                    tx += w + rng.uniform(3, 14)
            body.append(rect(x + 24, 276, 250, 132, '#262b34'))
            body.append(circle(x + 149, 326, 24, '#3a414d'))
            body.append(path(f'M{x + 99} 408 q50 -70 100 0Z', '#3a414d'))
            body.append(rect(x + 290, 276, 186, 20, '#262b34'))
            body.append(rect(x + 290, 304, 140, 12, '#20242c'))
            body.append(rect(x + 290, 324, 166, 12, '#20242c'))
    body.append(rect(380, 626, 420, 22, '#34312d'))
    for key in range(26):
        body.append(rect(388 + key * 16, 630, 11, 6, '#4a4641'))
    # transcript pages with one highlighted line
    body.append(poly([(900, 628), (1140, 624), (1160, 664), (900, 668)], '#e8e3d6'))
    for row in range(5):
        body.append(line(916, 636 + row * 6, 1128 - row * 8, 634 + row * 6, '#a9a394', 1.6))
    body.append(line(916, 648, 1060, 646.6, '#f2e04a', 5, ' opacity="0.85"'))
    body.append(poly([(1180, 640), (1250, 634), (1252, 644), (1182, 650)], '#e9d93a'))
    write('bg', 'edit_room', body, defs)


def interview_room():
    rng = random.Random(2027)
    body = [rect(0, 0, W, 640, '#d7cbb4'), rect(0, 640, W, 260, '#8f7355')]
    for x in range(0, W, 220):
        body.append(line(x + rng.uniform(-4, 4), 640, x + rng.uniform(-80, 80), 900, '#7f6548', 2))
    body.append(rect(0, 628, W, 14, '#efe7d6'))
    # window with a sheer curtain
    body.append(rect(80, 100, 380, 440, '#f3eee1'))
    body.append(rect(100, 120, 340, 400, '#c4d3d6'))
    body.append(path('M100 520 Q200 440 300 480 T440 450 L440 520Z', '#8fa48c'))
    body.append(path('M60 90 L260 90 Q250 360 290 600 L60 600Z', '#f6f1e6', ' opacity="0.82"'))
    for fold in range(5):
        body.append(line(84 + fold * 36, 96, 96 + fold * 40, 596, '#ddd5c2', 2))
    # frames: certificates and one graduation photograph
    for x, y, w, h, mat in ((640, 130, 150, 110, '#f1ead8'), (810, 130, 150, 110, '#f1ead8'), (980, 130, 150, 110, '#f1ead8')):
        body.append(rect(x, y, w, h, '#5a4127'))
        body.append(rect(x + 10, y + 10, w - 20, h - 20, mat))
        body.append(rect(x + 34, y + 30, w - 68, 5, '#9c917a'))
        for row in range(3):
            body.append(rect(x + 26, y + 46 + row * 10, w - 52, 3, '#bdb39c'))
        body.append(circle(x + w - 34, y + h - 28, 9, '#b0382c', ' opacity="0.8"'))
    body.append(rect(1180, 110, 130, 170, '#2f2a25'))
    body.append(rect(1192, 122, 106, 146, '#bfc8cc'))
    body.append(circle(1245, 176, 20, '#e2c7a8'))
    body.append(poly([(1206, 268), (1284, 268), (1272, 204), (1218, 204)], '#1d1d22'))
    body.append(poly([(1218, 150), (1272, 150), (1282, 160), (1208, 160)], '#1d1d22'))
    # sofa, table, recorder
    body.append(cut(rng, 560, 400, 760, 190, '#6f7453', 4))
    body.append(cut(rng, 520, 470, 90, 190, '#62674a', 4))
    body.append(cut(rng, 1270, 470, 90, 190, '#62674a', 4))
    body.append(cut(rng, 590, 540, 700, 110, '#7b8060', 3))
    body.append(line(940, 404, 940, 544, '#62674a', 4))
    body.append(cut(rng, 640, 430, 150, 110, '#a8553f', 6))
    body.append(poly([(640, 700), (1220, 700), (1270, 760), (590, 760)], '#4d341f'))
    body.append(rect(610, 760, 26, 80, '#3d2917'))
    body.append(rect(1224, 760, 26, 80, '#3d2917'))
    body.append(ellipse(820, 716, 70, 16, '#e9e2d0'))
    for index in range(5):
        body.append(cut(rng, 778 + index * 16, 700 - (index % 2) * 6, 22, 12, '#d9b77a', 2))
    body.append(cut(rng, 1010, 706, 110, 34, '#22252a', 2))
    body.append(circle(1100, 722, 6, '#e0432f'))
    # a floor lamp and the crew's light
    body.append(rect(1420, 250, 8, 400, '#2f2a25'))
    body.append(poly([(1370, 250), (1478, 250), (1456, 170), (1392, 170)], '#e9dcb8'))
    body.append(poly([(1390, 650), (1458, 650), (1448, 636), (1400, 636)], '#2f2a25'))
    body.append(line(1560, 860, 1500, 420, '#1c1c1f', 6))
    body.append(line(1440, 880, 1500, 420, '#1c1c1f', 6))
    body.append(poly([(1450, 300), (1590, 280), (1600, 430), (1470, 440)], '#1c1c1f'))
    body.append(poly([(1464, 314), (1580, 298), (1588, 418), (1480, 426)], '#f4efdf'))
    write('bg', 'interview_room', body)


def window_dawn():
    rng = random.Random(2071)
    defs = fade('d', [(0, '#2a3552'), (0.5, '#8d6f78'), (0.78, '#e9a877'), (1, '#f6dcae')])
    body = [rect(0, 0, W, H, '#3d4650'), rect(0, 660, W, 240, '#2d343c')]
    body.append(rect(520, 80, 700, 500, '#59636d'))
    body.append(f'<rect x="544" y="104" width="652" height="452" fill="url(#d)"/>')
    body.append(path('M544 520 Q700 470 860 500 T1196 480 L1196 556 L544 556Z', '#3b3f52'))
    for _ in range(16):
        x, w, h = rng.uniform(550, 1150), rng.uniform(20, 46), rng.uniform(14, 50)
        body.append(rect(x, 530 - h, w, h + 26, '#32364a'))
    body.append(circle(930, 470, 26, '#fff1cf', ' opacity="0.85"'))
    body.append(line(870, 104, 870, 556, '#59636d', 14))
    body.append(path('M470 60 L640 60 Q626 330 660 640 L470 640Z', '#aab2b3', ' opacity="0.9"'))
    for fold in range(4):
        body.append(line(498 + fold * 36, 66, 512 + fold * 38, 636, '#909a9c', 2))
    body.append(poly([(544, 556), (1196, 556), (1500, 900), (300, 900)], '#f6dcae', ' opacity="0.07"'))
    # bed rail, blanket, the care terminal
    body.append(cut(rng, -20, 700, 900, 220, '#8a97a0', 3))
    body.append(path('M-20 720 Q300 660 880 710 L880 760 Q300 720 -20 780Z', '#dfe3e2'))
    body.append(rect(60, 600, 10, 170, '#b9bfc2'))
    body.append(rect(60, 600, 420, 10, '#b9bfc2'))
    for bar in range(1, 7):
        body.append(rect(60 + bar * 60, 606, 6, 110, '#b9bfc2'))
    body.append(cut(rng, 1240, 600, 260, 300, '#4b545d', 2))
    body.append(cut(rng, 1290, 520, 150, 90, '#1e2329', 2))
    body.append(rect(1302, 532, 126, 66, '#31424a'))
    body.append(rect(1314, 546, 80, 5, '#9fc4c2'))
    body.append(rect(1314, 560, 54, 5, '#6f8b8b'))
    body.append(circle(1414, 584, 4, '#e8b060'))
    write('bg', 'window_dawn', body, defs)


# ───────────────────────── people (800 × 1000, no faces) ─────────────────────────

def person(name, layers, title_text):
    body = [f'<title>{title_text}</title>'] + layers
    write('char', name, body, width=800, height=1000)


def head(skin, cx=400, cy=262, rx=104, ry=124):
    return [rect(cx - 44, cy + 86, 88, 110, skin), ellipse(cx, cy, rx, ry, skin)]


def torso(color, shoulder=250, top=420, slope=70, cx=400):
    return path(f'M{cx - 60} {top} C{cx - 150} {top + 8} {cx - shoulder} {top + slope} {cx - shoulder - 26} {top + slope + 150} '
                f'L{cx - shoulder - 40} 1000 L{cx + shoulder + 40} 1000 L{cx + shoulder + 26} {top + slope + 150} '
                f'C{cx + shoulder} {top + slope} {cx + 150} {top + 8} {cx + 60} {top}Z', color)


def hanbok_collar(light, dark, cx=400, top=420, tie=None):
    out = [path(f'M{cx - 66} {top - 4} L{cx - 6} {top + 150} L{cx + 30} {top + 150} L{cx + 66} {top - 4} '
                f'L{cx + 44} {top - 10} L{cx + 8} {top + 104} L{cx - 44} {top - 10}Z', light),
           path(f'M{cx - 44} {top - 10} L{cx + 8} {top + 104} L{cx + 44} {top - 10} L{cx + 8} {top + 40}Z', dark)]
    if tie:
        out.append(path(f'M{cx + 10} {top + 140} q-70 50 -84 190 l34 6 q8 -110 74 -168Z', tie))
        out.append(path(f'M{cx + 16} {top + 146} q40 70 30 250 l34 -2 q14 -170 -40 -262Z', tie))
        out.append(circle(cx + 14, top + 146, 18, tie))
    return out


def kkeutsun(sick=False):
    skin, hair = '#e6c9a4', '#201a17'
    layers = []
    if sick:
        layers.append(path('M250 150 Q400 60 560 160 Q600 330 520 420 L290 420 Q200 320 250 150Z', hair))
        layers += head(skin, cy=290)
        layers.append(path('M298 236 Q400 196 506 240 Q470 180 400 170 Q326 178 298 236Z', hair))
        layers.append(path('M300 224 Q400 190 504 226 L500 268 Q400 240 304 266Z', '#e9e4d6'))
        layers.append(torso('#d9d2bd', shoulder=230, top=448))
        layers.append(path('M70 640 Q400 560 730 640 L760 1000 L40 1000Z', '#7c5a52'))
        layers.append(path('M70 640 Q400 560 730 640 L734 690 Q400 612 66 690Z', '#b9a98a'))
    else:
        layers.append(path('M286 250 Q280 120 400 118 Q524 120 514 252 Q520 330 498 380 L302 380 Q280 330 286 250Z', hair))
        layers += head(skin)
        layers.append(path('M296 258 Q300 150 400 138 Q500 150 504 258 Q470 196 400 160 Q330 196 296 258Z', hair))
        layers.append(line(400, 140, 400, 176, '#e6c9a4', 3))
        layers.append(torso('#d7cf9f', shoulder=226))
        layers += hanbok_collar('#f1ecda', '#e6c9a4', tie='#8b3a55')
        # the braid over one shoulder, tied with a red ribbon
        layers.append(path('M498 360 Q560 470 540 640 Q532 700 548 760 L510 764 Q490 700 500 640 Q514 500 470 400Z', hair))
        layers.append(path('M506 742 l52 -8 l14 96 l-30 -30 l-26 36Z', '#b23a3a'))
    person('kkeutsun-sick' if sick else 'kkeutsun', layers, '끝순')


def bonggu():
    skin, hair = '#d9b78f', '#1d1815'
    layers = [ellipse(400, 118, 34, 46, hair), rect(384, 150, 32, 30, hair)]
    layers += head(skin)
    layers.append(path('M296 240 Q300 150 400 142 Q500 150 504 240 Q400 200 296 240Z', hair))
    layers.append(path('M294 232 Q400 196 506 232 L506 258 Q400 224 294 258Z', '#35302b'))
    layers.append(torso('#dcd7c8', shoulder=262))
    layers += hanbok_collar('#f3efe2', '#d9b78f')
    layers.append(path('M250 470 Q230 700 236 1000 L330 1000 Q322 720 350 452Z', '#4a5360'))
    layers.append(path('M550 470 Q570 700 564 1000 L470 1000 Q478 720 450 452Z', '#4a5360'))
    # ledger tucked under the arm
    layers.append(poly([(120, 700), (300, 664), (330, 900), (150, 936)], '#6a4a2c'))
    layers.append(poly([(138, 716), (286, 686), (290, 706), (142, 736)], '#e6dcc0'))
    person('bonggu', layers, '봉구')


def mother_in_law():
    skin, hair = '#d8bd9b', '#9c9a95'
    layers = [ellipse(400, 392, 70, 46, hair)]
    layers += head(skin, cy=300, rx=98, ry=116)
    layers.append(path('M304 290 Q306 196 400 186 Q494 196 496 290 Q460 232 400 214 Q340 232 304 290Z', hair))
    layers.append(line(400, 188, 400, 224, '#d8bd9b', 3))
    layers.append(torso('#3d4046', shoulder=214, top=452, slope=90))
    layers += hanbok_collar('#e9e4d6', '#d8bd9b', top=452)
    # a knitted shawl pulled over both shoulders
    layers.append(path('M330 470 Q170 520 110 760 L130 1000 L330 1000 Q300 720 380 520Z', '#6a5a52'))
    layers.append(path('M470 470 Q630 520 690 760 L670 1000 L470 1000 Q500 720 420 520Z', '#6a5a52'))
    for row in range(9):
        layers.append(line(150 + row * 6, 640 + row * 40, 320 - row * 3, 620 + row * 40, '#584a43', 3))
        layers.append(line(650 - row * 6, 640 + row * 40, 480 + row * 3, 620 + row * 40, '#584a43', 3))
    person('mother-in-law', layers, '시어머니')


def yeongho(grown=False):
    skin = '#e0c19a'
    if grown:
        hair = '#1b1917'
        layers = [path('M292 250 Q286 130 410 126 Q520 134 510 250 Q470 180 380 176 Q330 190 292 250Z', hair)]
        layers += head(skin, rx=98, ry=120)
        layers.append(path('M300 246 Q310 150 420 150 Q506 160 502 240 Q450 190 372 196 Q330 206 300 246Z', hair))
        layers.append(torso('#2f3b4a', shoulder=236))
        layers.append(path('M340 420 L400 520 L460 420 L440 412 L400 470 L360 412Z', '#f1eee4'))
        layers.append(path('M352 416 L400 500 L448 416', 'none', ' stroke="#d9d4c5" stroke-width="3"'))
        layers.append(rect(250, 660, 110, 150, '#26303d'))
        layers.append(poly([(262, 640), (350, 630), (356, 672), (268, 682)], '#f1ead8'))
        person('yeongho-grown', layers, '영호')
        return
    hair = '#2a2420'
    layers = [ellipse(400, 430, 122, 134, hair)]
    layers += head(skin, cy=452, rx=116, ry=126)
    layers.append(path('M286 430 Q292 330 400 322 Q508 330 514 430 Q460 372 400 366 Q340 372 286 430Z', hair))
    # an army jacket three sizes too big, sleeves rolled
    layers.append(torso('#5d6444', shoulder=250, top=636, slope=60))
    layers.append(path('M330 632 L400 740 L470 632 L500 660 L400 800 L300 660Z', '#4a5036'))
    layers.append(rect(392, 760, 16, 240, '#4a5036'))
    for y in (800, 880, 960):
        layers.append(circle(400, y, 9, '#8d8f6a'))
    layers.append(rect(190, 860, 120, 34, '#737a55'))
    layers.append(rect(490, 860, 120, 34, '#737a55'))
    person('yeongho', layers, '영호')


def giho():
    skin, hair = '#dcbd97', '#15120f'
    layers = [path('M290 250 Q280 124 404 118 Q524 126 512 250 L500 220 Q470 150 360 164 Q310 180 290 250Z', hair)]
    layers += head(skin)
    layers.append(path('M296 248 Q300 140 410 136 Q512 146 506 244 Q486 176 396 172 Q330 184 296 248Z', hair))
    layers.append(path('M330 168 Q400 140 480 170', 'none', ' stroke="#4b4640" stroke-width="3"'))
    layers.append(torso('#5b6140', shoulder=268))
    # field jacket: wide collar, two flap pockets, a scarf
    layers.append(path('M330 414 L250 470 L330 560 L400 470Z', '#6b7250'))
    layers.append(path('M470 414 L550 470 L470 560 L400 470Z', '#6b7250'))
    layers.append(path('M352 420 Q400 470 448 420 L440 520 Q400 560 360 520Z', '#b9482f'))
    layers.append(rect(394, 540, 12, 460, '#4c5236'))
    for x in (220, 470):
        layers.append(rect(x, 700, 110, 120, '#515737'))
        layers.append(poly([(x, 700), (x + 110, 700), (x + 110, 734), (x + 55, 750), (x, 734)], '#6b7250'))
        layers.append(circle(x + 55, 730, 7, '#9a9d78'))
    layers.append(rect(238, 688, 60, 16, '#e9e2cf'))
    person('giho', layers, '기호')


def sugyeong():
    skin = '#ecd2b4'
    layers = head(skin)
    # a knitted hat pulled down to the brow
    layers.append(path('M288 262 Q282 120 400 112 Q518 120 512 262 Q400 226 288 262Z', '#c99a2e'))
    layers.append(path('M284 250 Q400 210 516 250 L516 290 Q400 250 284 290Z', '#a87d1f'))
    for rib in range(9):
        layers.append(line(304 + rib * 24, 262 - abs(rib - 4) * 3, 302 + rib * 24.5, 282 - abs(rib - 4) * 3, '#8d6816', 3))
    layers.append(circle(400, 108, 24, '#a87d1f'))
    layers.append(torso('#dfe7ea', shoulder=216))
    for stripe in range(11):
        x = 190 + stripe * 42
        layers.append(rect(x, 470, 8, 530, '#a9c0cc', ' opacity="0.85"'))
    layers.append(path('M340 414 L400 540 L460 414 L436 408 L400 486 L364 408Z', '#f5f7f6'))
    # a jumper thrown over the gown
    layers.append(path('M336 430 Q170 470 130 700 L120 1000 L300 1000 Q290 700 372 500Z', '#b0492f'))
    layers.append(path('M464 430 Q630 470 670 700 L680 1000 L500 1000 Q510 700 428 500Z', '#b0492f'))
    layers.append(path('M300 1000 Q296 760 352 540 L372 500 Q300 720 320 1000Z', '#8d3823'))
    layers.append(path('M500 1000 Q504 760 448 540 L428 500 Q500 720 480 1000Z', '#8d3823'))
    person('sugyeong', layers, '수경')


def mom():
    skin, hair = '#e2c4a0', '#2a221d'
    layers = []
    for cx, cy, r in ((310, 210, 62), (360, 150, 66), (440, 150, 66), (492, 210, 62), (300, 290, 52), (502, 290, 52), (400, 130, 60)):
        layers.append(circle(cx, cy, r, hair))
    layers += head(skin)
    for cx, cy, r in ((336, 176, 44), (400, 158, 48), (464, 176, 44)):
        layers.append(circle(cx, cy, r, hair))
    layers.append(torso('#9c6a5c', shoulder=250))
    layers.append(path('M346 416 Q400 470 454 416 L446 440 Q400 500 354 440Z', '#b98476'))
    # rubber apron from the fish stall
    layers.append(path('M300 520 L500 520 L560 1000 L240 1000Z', '#2f4a44'))
    layers.append(path('M316 520 Q330 440 366 420 L380 428 Q350 450 340 520Z', '#2f4a44'))
    layers.append(path('M484 520 Q470 440 434 420 L420 428 Q450 450 460 520Z', '#2f4a44'))
    layers.append(rect(330, 700, 140, 110, '#27403a'))
    layers.append(path('M250 640 Q300 600 340 660', 'none', ' stroke="#3d6058" stroke-width="5"'))
    person('mom', layers, '엄마')


def cha():
    skin, hair = '#e5c9a8', '#241d1a'
    layers = [path('M270 250 Q262 116 400 110 Q538 116 530 250 Q540 360 520 430 L460 430 L470 300 L330 300 L340 430 L280 430 Q260 360 270 250Z', hair)]
    layers += head(skin)
    layers.append(path('M288 262 Q290 140 400 132 Q512 140 512 262 Q486 190 430 174 Q360 200 288 262Z', hair))
    # glasses: the only thing on the face
    for x in (352, 448):
        layers.append(circle(x, 274, 34, 'none', ' stroke="#2a2522" stroke-width="6"'))
    layers.append(line(386, 272, 414, 272, '#2a2522', 5))
    layers.append(torso('#3a3d43', shoulder=280, slope=56))
    layers.append(path('M344 414 L400 600 L456 414 L436 408 L400 520 L364 408Z', '#ece7dc'))
    layers.append(path('M340 414 L250 480 L330 620 L400 600Z', '#474a51'))
    layers.append(path('M460 414 L550 480 L470 620 L400 600Z', '#474a51'))
    # staff lanyard
    layers.append(path('M362 420 Q380 640 400 720 Q420 640 438 420', 'none', ' stroke="#e06a2a" stroke-width="9"'))
    layers.append(rect(366, 716, 68, 96, '#f3efe6'))
    layers.append(rect(378, 730, 44, 40, '#9aa3ad'))
    layers.append(rect(378, 782, 44, 6, '#9aa3ad'))
    person('cha', layers, '차윤희 피디')


def munho(lean=False):
    skin, hair = '#d9b792', '#bdbab3'
    cy = 300 if lean else 262
    layers = [path(f'M286 {cy + 10} Q274 {cy - 50} 304 {cy - 80} L316 {cy + 60} Q296 {cy + 50} 286 {cy + 10}Z', hair),
              path(f'M514 {cy + 10} Q526 {cy - 50} 496 {cy - 80} L484 {cy + 60} Q504 {cy + 50} 514 {cy + 10}Z', hair)]
    layers += head(skin, cy=cy, rx=102, ry=122)
    layers.append(path(f'M312 {cy - 70} Q400 {cy - 118} 488 {cy - 70} Q400 {cy - 96} 312 {cy - 70}Z', '#c9a882'))
    top = 458 if lean else 420
    layers.append(torso('#6d2f33', shoulder=276 if lean else 258, top=top, slope=64))
    layers.append(path(f'M344 {top - 6} L400 {top + 190} L456 {top - 6} L436 {top - 12} L400 {top + 110} L364 {top - 12}Z', '#e9e4d8'))
    layers.append(path(f'M340 {top - 6} L290 {top + 40} L384 {top + 330} L400 {top + 190}Z', '#7c383c'))
    layers.append(path(f'M460 {top - 6} L510 {top + 40} L416 {top + 330} L400 {top + 190}Z', '#7c383c'))
    for index in range(4):
        layers.append(circle(400, top + 360 + index * 70, 9, '#c9a25a'))
    # reading glasses on a cord
    layers.append(path(f'M352 {top + 20} Q360 {top + 170} 372 {top + 240} M448 {top + 20} Q440 {top + 170} 428 {top + 240}', 'none',
                       ' stroke="#2c2724" stroke-width="3"'))
    layers.append(rect(356, top + 236, 38, 26, 'none', ' stroke="#2c2724" stroke-width="5" rx="8"'))
    layers.append(rect(406, top + 236, 38, 26, 'none', ' stroke="#2c2724" stroke-width="5" rx="8"'))
    if lean:
        # one hand raised, a finger out
        layers.append(path('M560 760 Q640 640 650 520 L700 524 Q706 660 640 800Z', '#6d2f33'))
        layers.append(path('M640 530 Q636 470 664 450 Q700 440 712 480 L708 530Z', skin))
        layers.append(path('M672 456 L682 360 Q694 350 702 362 L700 462Z', skin))
    person('munho-lean' if lean else 'munho', layers, '오문호')


def unseen():
    # The four people the player lives as are never drawn: only where they stand, as a faint fall of light.
    defs = glow('u', '#ffffff', [(0, 0.05), (1, 0)])
    target = DEST / 'char' / 'self.svg'
    target.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">'
                      f'<defs>{defs}</defs><ellipse cx="400" cy="560" rx="300" ry="440" fill="url(#u)"/></svg>\n', encoding='utf-8')
    print('char/self.svg')


# ───────────────────────── props (400 × 400) ─────────────────────────

def props():
    rng = random.Random(41)
    key = ['<g transform="rotate(-24 200 200)">',
           path('M150 80 q-60 -50 -90 20 q-10 60 60 60', 'none', ' stroke="#7a6a52" stroke-width="7" stroke-linecap="round"'),
           circle(170, 150, 46, 'none', ' stroke="#3a342e" stroke-width="20"'),
           rect(206, 140, 150, 20, '#3a342e'), rect(310, 158, 18, 44, '#3a342e'), rect(338, 158, 18, 30, '#3a342e'),
           circle(170, 150, 46, 'none', ' stroke="#5a5046" stroke-width="5"'), '</g>']
    write('items', 'key', key, width=400, height=400)

    receipt = ['<g transform="rotate(5 200 200)">', cut(rng, 90, 50, 220, 300, '#ece4cc', 4)]
    receipt.append(rect(150, 76, 100, 12, '#3b352c'))
    for row, width in enumerate((170, 150, 176, 120, 160)):
        receipt.append(rect(114, 116 + row * 30, width, 6, '#6d6557'))
    receipt.append(circle(256, 296, 30, 'none', ' stroke="#b3372b" stroke-width="6"'))
    receipt.append(path('M240 286 h32 M240 300 h32 M256 280 v32', 'none', ' stroke="#b3372b" stroke-width="5"'))
    receipt.append('</g>')
    write('items', 'receipt', receipt, width=400, height=400)

    sketch = ['<g transform="rotate(-6 200 200)">', cut(rng, 70, 80, 260, 250, '#f3efe2', 5),
              rect(70, 80, 260, 34, '#c9d6d2')]
    for spoke in range(18):
        angle = spoke / 18 * math.tau
        sketch.append(line(190 + math.cos(angle) * 16, 180 + math.sin(angle) * 16, 190 + math.cos(angle) * rng.uniform(44, 62),
                           180 + math.sin(angle) * rng.uniform(44, 62), '#2f5aa8', 2.6))
    sketch.append(path('M90 276 Q200 262 314 280', 'none', ' stroke="#2f5aa8" stroke-width="3.4" stroke-linecap="round"'))
    for x in (120, 170, 220, 270):
        sketch.append(line(x, 274, x, 308, '#2f5aa8', 2.6))
    sketch.append(circle(236, 262, 5, '#2f5aa8'))
    sketch.append('</g>')
    write('items', 'sketch', sketch, width=400, height=400)

    globe = [circle(200, 200, 150, '#f3efe2'), circle(200, 200, 126, 'none', ' stroke="#2c2a27" stroke-width="3.4"')]
    for ry in (40, 84):
        globe.append(ellipse(200, 200, 126, ry, 'none', ' stroke="#2c2a27" stroke-width="1.8" opacity="0.7"'))
    for rx in (46, 92):
        globe.append(ellipse(200, 200, rx, 126, 'none', ' stroke="#2c2a27" stroke-width="1.8" opacity="0.7"'))
    globe.append(line(200, 66, 200, 334, '#2c2a27', 1.8))
    globe.append(circle(262, 148, 8, '#c8442f'))
    globe.append(circle(274, 154, 4, 'none', ' stroke="#c8442f" stroke-width="2"'))
    globe.append(path('M282 140 q30 -30 62 -24', 'none', ' stroke="#c8442f" stroke-width="2.4" stroke-linecap="round"'))
    write('items', 'globe', globe, width=400, height=400)


if __name__ == '__main__':
    void(), void_light(), title()
    jemulpo_yard(), jemulpo_room()
    busan_market(), market_fire(), busan_shack(), seoul_room()
    ward(), hangang_night()
    edit_room(), interview_room(), window_dawn()
    kkeutsun(), kkeutsun(sick=True), bonggu()
    mother_in_law(), yeongho(), yeongho(grown=True), giho()
    sugyeong(), mom()
    cha(), munho(), munho(lean=True)
    unseen()
    props()

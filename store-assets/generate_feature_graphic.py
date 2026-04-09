"""Generate the 1024x500 Play Store feature graphic for BracketUp."""
from PIL import Image, ImageDraw, ImageFont
import math

W, H = 1024, 500
NAVY = (15, 23, 42)
GOLD = (255, 196, 0)

img = Image.new("RGB", (W, H), NAVY)
draw = ImageDraw.Draw(img)

# --- bracket lines (left side) ---
def bracket_lines(draw, ox, oy, rounds, rw, rh, gap, color, lw=4):
    """Draw a winners-bracket tree growing left-to-right."""
    for r in range(rounds):
        slots = 2 ** (rounds - 1 - r)
        total_h = slots * rh + (slots - 1) * gap
        start_y = oy + (H - total_h) // 2 - oy // 2
        for s in range(slots):
            top = start_y + s * (rh + gap)
            mid = top + rh // 2
            x0 = ox + r * rw
            x1 = x0 + rw - 20
            # horizontal match line
            draw.line([(x0, mid), (x1, mid)], fill=color, width=lw)
            # connector to next round
            if r < rounds - 1 and s % 2 == 0:
                next_slots = 2 ** (rounds - 2 - r)
                next_total = next_slots * rh + (next_slots - 1) * gap
                next_start = oy + (H - next_total) // 2 - oy // 2
                partner_mid = start_y + (s + 1) * (rh + gap) + rh // 2
                next_mid = next_start + (s // 2) * (rh + gap) + rh // 2
                next_x = ox + (r + 1) * rw - 20
                draw.line([(x1, mid), (x1, partner_mid)], fill=color, width=lw)
                draw.line([(x1, next_mid), (next_x, next_mid)], fill=color, width=lw)

# Winners bracket on left
bracket_lines(draw, 40, 40, 4, 110, 28, 18, GOLD, lw=3)

# Losers bracket (dimmed gold) below — simplified 2-round strip
LB_COLOR = (180, 138, 0)
bracket_lines(draw, 40, 260, 3, 110, 22, 14, LB_COLOR, lw=2)

# --- trophy icon (center-right area) ---
cx, cy = 680, 220
tw = 180
th = 160

def draw_trophy(draw, cx, cy, tw, th, color):
    # cup body (trapezoid)
    pts = [
        (cx - tw//2, cy - th//2),
        (cx + tw//2, cy - th//2),
        (cx + tw//3, cy + th//6),
        (cx - tw//3, cy + th//6),
    ]
    draw.polygon(pts, fill=color)
    # stem
    sw = tw // 8
    draw.rectangle([cx - sw, cy + th//6, cx + sw, cy + th//2 - 10], fill=color)
    # base
    draw.rectangle([cx - tw//3, cy + th//2 - 12, cx + tw//3, cy + th//2 + 4], fill=color)
    # handles
    handle_r = tw // 5
    draw.arc([cx - tw//2 - handle_r, cy - th//3,
              cx - tw//2 + handle_r, cy + th//6], start=90, end=270, fill=color, width=14)
    draw.arc([cx + tw//2 - handle_r, cy - th//3,
              cx + tw//2 + handle_r, cy + th//6], start=270, end=90, fill=color, width=14)
    # star
    star_cx, star_cy = cx, cy - th//8
    star_r_outer = tw // 7
    star_r_inner = star_r_outer // 2
    star_pts = []
    for i in range(10):
        angle = math.radians(-90 + i * 36)
        r = star_r_outer if i % 2 == 0 else star_r_inner
        star_pts.append((star_cx + r * math.cos(angle), star_cy + r * math.sin(angle)))
    draw.polygon(star_pts, fill=NAVY)

draw_trophy(draw, cx, cy, tw, th, GOLD)

# --- text ---
try:
    font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
except:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

# App name
text = "BracketUp"
bbox = draw.textbbox((0, 0), text, font=font_large)
tw_text = bbox[2] - bbox[0]
draw.text((W - tw_text - 48, H - 140), text, fill=GOLD, font=font_large)

# Tagline
tag = "Double-elimination brackets, anywhere."
bbox2 = draw.textbbox((0, 0), tag, font=font_small)
tw_tag = bbox2[2] - bbox2[0]
draw.text((W - tw_tag - 48, H - 60), tag, fill=(180, 200, 220), font=font_small)

img.save("feature_graphic.png")
print("Saved feature_graphic.png (1024x500)")

# 生成带透明通道的测试宠物动画：一个会弹跳+眨眼的小幽灵
# 输出：APNG(全 alpha，平滑) 与 GIF(二值透明，最常见)，均为透明背景。
import math
import os
from PIL import Image, ImageDraw, ImageOps

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "测试素材")
os.makedirs(OUT_DIR, exist_ok=True)

W = H = 200
SS = 3          # 超采样倍数，画完缩小 → 边缘平滑
FRAMES = 24
BODY = (124, 132, 255, 255)   # 淡紫蓝
BODY_DARK = (96, 104, 230, 255)

def draw_frame(i):
    big = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    t = i / FRAMES
    bounce = math.sin(t * 2 * math.pi) * 14          # 上下弹跳
    cx, cy = W / 2, H / 2 + 10 - bounce
    rw, rh = 56, 60

    # 身体（水滴/幽灵形：上圆下摆）
    box = [(cx - rw) * SS, (cy - rh) * SS, (cx + rw) * SS, (cy + rh) * SS]
    d.ellipse(box, fill=BODY)
    # 底部小波浪裙边
    wave_y = cy + rh - 6
    for k in range(-2, 3):
        bx = cx + k * 24
        d.ellipse([(bx - 16) * SS, (wave_y - 14) * SS, (bx + 16) * SS, (wave_y + 16) * SS], fill=BODY)

    # 腮红
    for sx in (-26, 26):
        d.ellipse([(cx + sx - 11) * SS, (cy + 8 - 7) * SS, (cx + sx + 11) * SS, (cy + 8 + 7) * SS],
                  fill=(255, 150, 170, 110))

    # 眼睛（每隔几帧眨一次）
    blink = (i % FRAMES) in (10, 11)
    for sx in (-20, 20):
        ex, ey = cx + sx, cy - 6
        if blink:
            d.line([(ex - 9) * SS, ey * SS, (ex + 9) * SS, ey * SS], fill=(40, 44, 90, 255), width=4 * SS)
        else:
            d.ellipse([(ex - 9) * SS, (ey - 11) * SS, (ex + 9) * SS, (ey + 11) * SS], fill=(255, 255, 255, 255))
            d.ellipse([(ex - 4) * SS, (ey - 4) * SS, (ex + 6) * SS, (ey + 8) * SS], fill=(40, 44, 90, 255))

    # 嘴
    d.arc([(cx - 12) * SS, (cy + 2) * SS, (cx + 12) * SS, (cy + 20) * SS], 20, 160, fill=(40, 44, 90, 255), width=3 * SS)

    return big.resize((W, H), Image.LANCZOS)

frames = [draw_frame(i) for i in range(FRAMES)]

# --- APNG：全 alpha，最干净 ---
apng_path = os.path.join(OUT_DIR, "test-pet.png")
frames[0].save(apng_path, save_all=True, append_images=frames[1:],
               duration=60, loop=0, disposal=2, format="PNG")

# --- GIF：二值透明（最常见格式）---
def to_p(rgba):
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda a: 255 if a >= 128 else 0)        # 透明阈值
    p = rgba.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=255)
    p.paste(255, mask=ImageOps.invert(mask))                    # 索引 255 = 透明
    p.info["transparency"] = 255
    return p

gif_frames = [to_p(f) for f in frames]
gif_path = os.path.join(OUT_DIR, "test-pet.gif")
gif_frames[0].save(gif_path, save_all=True, append_images=gif_frames[1:],
                   duration=60, loop=0, transparency=255, disposal=2, optimize=False)

print("APNG:", os.path.abspath(apng_path))
print("GIF :", os.path.abspath(gif_path))

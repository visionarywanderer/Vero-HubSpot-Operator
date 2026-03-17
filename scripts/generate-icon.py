#!/usr/bin/env python3
"""
Generate the HubSpot Config Engine application icon.
Uses only Python built-in modules — no Pillow or external dependencies.
Creates a 1024x1024 PNG, then converts to .icns via macOS iconutil.
"""

import struct
import zlib
import math
import os
import subprocess
import tempfile
import shutil

# --- Colors ---
BG_COLOR = (30, 30, 35)           # Dark charcoal
ORANGE = (255, 122, 0)            # HubSpot-ish orange
ORANGE_LIGHT = (255, 165, 70)     # Lighter orange for highlights
WHITE = (255, 255, 255)

SIZE = 1024
HALF = SIZE // 2
RADIUS = SIZE // 2 - 20           # Rounded-square corner radius

def dist(x, y, cx, cy):
    return math.sqrt((x - cx) ** 2 + (y - cy) ** 2)

def in_rounded_rect(x, y, margin, corner_r):
    """Check if (x,y) is inside a rounded rectangle centered in the image."""
    left = margin
    right = SIZE - margin
    top = margin
    bottom = SIZE - margin
    inner_left = left + corner_r
    inner_right = right - corner_r
    inner_top = top + corner_r
    inner_bottom = bottom - corner_r

    if inner_left <= x <= inner_right and top <= y <= bottom:
        return True
    if inner_top <= y <= inner_bottom and left <= x <= right:
        return True
    # Check corners
    for cx, cy in [(inner_left, inner_top), (inner_right, inner_top),
                   (inner_left, inner_bottom), (inner_right, inner_bottom)]:
        if dist(x, y, cx, cy) <= corner_r:
            return True
    return False

def in_gear(x, y, cx, cy, outer_r, inner_r, teeth, tooth_width):
    """Check if (x,y) is on the gear shape (ring with teeth)."""
    dx = x - cx
    dy = y - cy
    d = math.sqrt(dx * dx + dy * dy)
    angle = math.atan2(dy, dx)

    # Tooth pattern
    tooth_angle = 2 * math.pi / teeth
    tooth_phase = (angle % tooth_angle) / tooth_angle

    if tooth_phase < tooth_width:
        # On a tooth
        effective_outer = outer_r
    else:
        effective_outer = outer_r - (outer_r - inner_r) * 0.35

    return inner_r <= d <= effective_outer

def in_circle(x, y, cx, cy, r):
    return dist(x, y, cx, cy) <= r

def blend(c1, c2, t):
    """Blend two colors. t=0 gives c1, t=1 gives c2."""
    t = max(0.0, min(1.0, t))
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )

def generate_pixel(x, y):
    """Determine the color of pixel (x, y)."""
    # Background: rounded square
    if not in_rounded_rect(x, y, 8, 185):
        return (0, 0, 0, 0)  # Transparent

    # Subtle gradient on background (darker at bottom)
    bg_t = y / SIZE * 0.3
    bg = blend(BG_COLOR, (15, 15, 20), bg_t)

    cx, cy = HALF, HALF

    # Outer gear
    gear_outer_r = 340
    gear_inner_r = 240
    gear_teeth = 8
    tooth_width = 0.45

    if in_gear(x, y, cx, cy, gear_outer_r, gear_inner_r, gear_teeth, tooth_width):
        # Gradient on gear: lighter at top
        t = 1.0 - (y - (cy - gear_outer_r)) / (2 * gear_outer_r)
        color = blend(ORANGE, ORANGE_LIGHT, t * 0.6)
        return (*color, 255)

    # Inner hub circle
    hub_r = 160
    if in_circle(x, y, cx, cy, hub_r):
        # Dark center with subtle ring
        ring_d = dist(x, y, cx, cy)

        # Inner dark circle
        if ring_d < hub_r - 30:
            return (*bg, 255)

        # Orange ring
        t = 1.0 - (y - (cy - hub_r)) / (2 * hub_r)
        color = blend(ORANGE, ORANGE_LIGHT, t * 0.5)
        return (*color, 255)

    # Hub spokes (connecting inner hub to gear ring)
    angle = math.atan2(y - cy, x - cx)
    d = dist(x, y, cx, cy)
    if hub_r <= d <= gear_inner_r + 5:
        # 4 spokes at 45-degree offsets
        for spoke_angle in [math.pi/4, 3*math.pi/4, 5*math.pi/4, 7*math.pi/4]:
            angle_diff = abs(((angle - spoke_angle + math.pi) % (2 * math.pi)) - math.pi)
            spoke_half_width = 0.12  # radians
            if angle_diff < spoke_half_width:
                t = 1.0 - (y - (cy - gear_outer_r)) / (2 * gear_outer_r)
                color = blend(ORANGE, ORANGE_LIGHT, t * 0.5)
                return (*color, 255)

    return (*bg, 255)

def create_png(width, height, pixels):
    """Create a PNG file from raw RGBA pixel data."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + chunk + crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = make_chunk(b'IHDR', ihdr_data)

    # IDAT — compress the raw pixel rows
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter: None
        row_start = y * width * 4
        raw_data.extend(pixels[row_start:row_start + width * 4])

    compressed = zlib.compress(bytes(raw_data), 9)
    idat = make_chunk(b'IDAT', compressed)

    # IEND
    iend = make_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend

def render_icon(size):
    """Render the icon at a given size and return RGBA pixel bytes."""
    scale = size / SIZE
    pixels = bytearray(size * size * 4)

    for y in range(size):
        for x in range(size):
            # Map to 1024x1024 coordinate space
            sx = x / scale
            sy = y / scale
            r, g, b, a = generate_pixel(sx, sy)
            offset = (y * size + x) * 4
            pixels[offset] = r
            pixels[offset + 1] = g
            pixels[offset + 2] = b
            pixels[offset + 3] = a

    return bytes(pixels)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    assets_dir = os.path.join(project_dir, 'assets')
    os.makedirs(assets_dir, exist_ok=True)

    icns_path = os.path.join(assets_dir, 'hubspot-config-engine.icns')

    # Create temporary iconset directory
    iconset_dir = tempfile.mkdtemp(suffix='.iconset')

    # Required sizes for macOS .icns
    icon_sizes = [
        (16, '16x16', False),
        (32, '16x16', True),
        (32, '32x32', False),
        (64, '32x32', True),
        (128, '128x128', False),
        (256, '128x128', True),
        (256, '256x256', False),
        (512, '256x256', True),
        (512, '512x512', False),
        (1024, '512x512', True),
    ]

    for pixel_size, label, is_2x in icon_sizes:
        suffix = '@2x' if is_2x else ''
        filename = f'icon_{label}{suffix}.png'
        filepath = os.path.join(iconset_dir, filename)

        print(f'  Rendering {filename} ({pixel_size}x{pixel_size})...')
        pixels = render_icon(pixel_size)
        png_data = create_png(pixel_size, pixel_size, pixels)

        with open(filepath, 'wb') as f:
            f.write(png_data)

    # Convert to .icns using macOS iconutil
    print(f'  Converting to .icns...')

    # iconutil expects the directory to end in .iconset
    proper_iconset = iconset_dir
    if not proper_iconset.endswith('.iconset'):
        proper_iconset = iconset_dir + '.iconset'
        os.rename(iconset_dir, proper_iconset)

    try:
        subprocess.run(
            ['iconutil', '-c', 'icns', proper_iconset, '-o', icns_path],
            check=True,
            capture_output=True,
            text=True,
        )
        print(f'  Icon saved to: {icns_path}')
    except subprocess.CalledProcessError as e:
        print(f'  ERROR: iconutil failed: {e.stderr}')
        # Keep the iconset for debugging
        print(f'  Iconset directory: {proper_iconset}')
        return False
    finally:
        shutil.rmtree(proper_iconset, ignore_errors=True)

    return True

if __name__ == '__main__':
    print('Generating HubSpot Config Engine icon...')
    success = main()
    if success:
        print('Done.')
    else:
        print('Icon generation failed.')
        exit(1)

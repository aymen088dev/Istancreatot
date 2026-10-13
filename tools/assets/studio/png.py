"""Une toile et un encodeur PNG — numpy pour le dessin, Pillow pour l'écriture.

Assez pour fabriquer les plaques d'un habillage : dégradés, vignettes, grains,
ronds, croix, drapeaux. Les pixels vivent dans un tableau numpy (hauteur,
largeur, 4), donc un dégradé ou un halo se calculent d'un bloc au lieu d'être
parcourus pixel par pixel.

Chaque plaque sait aussi s'afficher en caractères dans le terminal : c'est ce
qui permet de la relire sans écran.
"""
from __future__ import annotations

import math
import struct
import zlib

import numpy as np

RAMP = " .:-=+*#%@"

try:                                # Pillow écrit des PNG plus compacts
    from PIL import Image
except ImportError:                 # et sinon on encode à la main
    Image = None


def _crc(chunk, kind):
    return struct.pack(">I", zlib.crc32(kind + chunk) & 0xFFFFFFFF)


class Raster:
    """Une toile RGBA 8 bits, en mémoire, avec quelques gestes de dessin."""

    def __init__(self, w, h, color=(0, 0, 0, 0)):
        self.w = int(w)
        self.h = int(h)
        self.img = np.zeros((self.h, self.w, 4), dtype=np.uint8)
        self.img[:, :] = np.array(color, dtype=np.uint8)

    # ------------------------------------------------------------- mécanique
    def _box(self, x0, y0, x1, y1):
        x0 = max(0, int(x0)); y0 = max(0, int(y0))
        x1 = min(self.w, int(x1)); y1 = min(self.h, int(y1))
        return x0, y0, x1, y1

    def _paint(self, x0, y0, x1, y1, c, alpha):
        """Recouvrement source-sur-dest sur une boîte, alpha tableau ou scalaire."""
        x0, y0, x1, y1 = self._box(x0, y0, x1, y1)
        if x1 <= x0 or y1 <= y0:
            return
        box = self.img[y0:y1, x0:x1].astype(np.float32)
        col = np.array(c, dtype=np.float32)[:3]
        a = np.asarray(alpha, dtype=np.float32)
        if a.ndim == 0:
            a = np.full((y1 - y0, x1 - x0), float(a), dtype=np.float32)
        a = a[:y1 - y0, :x1 - x0][..., None]
        da = box[..., 3:4] / 255.0
        na = a + da * (1.0 - a)
        safe = np.where(na > 0, na, 1.0)
        rgb = (col * a + box[..., :3] * da * (1.0 - a)) / safe
        out = box.copy()
        out[..., :3] = np.where(na > 0, rgb, box[..., :3])
        out[..., 3:4] = na * 255.0
        self.img[y0:y1, x0:x1] = np.clip(out, 0, 255).astype(np.uint8)

    # ---------------------------------------------------------------- gestes
    def blend(self, x, y, c, a=1.0):
        """Pose une couleur avec transparence (recouvrement source-sur-dest)."""
        if a <= 0:
            return
        self._paint(int(x), int(y), int(x) + 1, int(y) + 1, c, a)

    def rect(self, x, y, w, h, c, a=1.0):
        self._paint(x, y, x + w, y + h, c, a)

    def disc(self, cx, cy, r, c, soft=1.2, a=1.0):
        """Un disque plein, bord antialiasé sur `soft` pixels."""
        x0, y0 = int(cx - r - soft) - 1, int(cy - r - soft) - 1
        x1, y1 = int(cx + r + soft) + 2, int(cy + r + soft) + 2
        bx0, by0, bx1, by1 = self._box(x0, y0, x1, y1)
        if bx1 <= bx0 or by1 <= by0:
            return
        xs = np.arange(bx0, bx1)[None, :] - cx
        ys = np.arange(by0, by1)[:, None] - cy
        d = np.hypot(xs, ys)
        alpha = np.clip((r + soft - d) / (2.0 * max(soft, 1e-3)), 0.0, 1.0)
        alpha[d <= r - soft] = 1.0
        self._paint(bx0, by0, bx1, by1, c, alpha * a)

    def ring(self, cx, cy, r, thick, c, a=1.0):
        x0, y0 = int(cx - r - thick) - 1, int(cy - r - thick) - 1
        x1, y1 = int(cx + r + thick) + 2, int(cy + r + thick) + 2
        bx0, by0, bx1, by1 = self._box(x0, y0, x1, y1)
        if bx1 <= bx0 or by1 <= by0:
            return
        xs = np.arange(bx0, bx1)[None, :] - cx
        ys = np.arange(by0, by1)[:, None] - cy
        d = np.abs(np.hypot(xs, ys) - r)
        alpha = np.clip(1.0 - d / max(thick, 1e-3), 0.0, 1.0)
        self._paint(bx0, by0, bx1, by1, c, alpha * a)

    def line(self, x0, y0, x1, y1, c, thick=1.0, a=1.0):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for s in range(steps + 1):
            t = s / steps
            self.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick / 2, c, .8, a)

    def poly(self, pts, c, a=1.0):
        """Un polygone plein, par balayage horizontal."""
        ys = [p[1] for p in pts]
        y0, y1 = max(0, int(min(ys))), min(self.h - 1, int(max(ys)))
        n = len(pts)
        for y in range(y0, y1 + 1):
            xs = []
            for i in range(n):
                ax, ay = pts[i]
                bx, by = pts[(i + 1) % n]
                if (ay <= y < by) or (by <= y < ay):
                    xs.append(ax + (bx - ax) * (y - ay) / (by - ay))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                self.rect(int(xs[i]), y, int(xs[i + 1]) - int(xs[i]) + 1, 1, c, a)

    def gradient(self, top, bottom=None, gamma=.85):
        """Un dégradé vertical : deux couleurs, ou une fonction appliquée à toute
        la toile (elle reçoit deux grilles numpy X et Y)."""
        if callable(top):
            y, x = np.mgrid[0:self.h, 0:self.w]
            v = top(x, y)
            self.img[:, :] = np.clip(np.asarray(v, dtype=float), 0, 255).astype(np.uint8)
            return
        t = (np.linspace(0.0, 1.0, self.h) ** gamma)[:, None, None]
        col = np.array(top, float)[None, None, :] * (1 - t) + np.array(bottom, float)[None, None, :] * t
        self.img[:, :self.w, :] = np.clip(np.broadcast_to(col, (self.h, self.w, 4)), 0, 255).astype(np.uint8)

    def grain(self, amount, seed=1, mono=True, alpha=255):
        """Un grain aléatoire reproductible (bruit blanc)."""
        rng = np.random.default_rng(seed)
        n = rng.uniform(-1.0, 1.0, size=(self.h, self.w)) * amount
        if mono:
            self.img[..., 0:3] = np.clip(128 + n, 0, 255).astype(np.uint8)[..., None]
        else:
            self.img[..., 0:3] = np.clip(self.img[..., 0:3].astype(float) + n[..., None], 0, 255).astype(np.uint8)
        self.img[..., 3] = alpha

    # ------------------------------------------------------------- relecture
    def luma(self, x, y):
        p = self.img[int(y), int(x), :3].astype(float)
        return float((p[0] * .2126 + p[1] * .7152 + p[2] * .0722) / 255.0)

    def mean_luma(self):
        p = self.img[..., :3].astype(float)
        return float(np.mean(p[..., 0] * .2126 + p[..., 1] * .7152 + p[..., 2] * .0722) / 255.0)

    def ascii(self, width=76):
        """La plaque en caractères : pour la relire sans écran.

        Une plaque noire à transparence variable (vignette, poussières) se lit
        à sa couverture ; une vraie image se lit à sa luminance.
        """
        matte = self.mean_luma() < .02
        step = max(1, self.w // width)
        sub = self.img[::step * 2, ::step]
        lum = (sub[..., 0] * .2126 + sub[..., 1] * .7152 + sub[..., 2] * .0722) / 255.0
        a = sub[..., 3] / 255.0
        v = a if matte else lum * a
        idx = np.clip((v * len(RAMP)).astype(int), 0, len(RAMP) - 1)
        table = np.array(list(RAMP))
        return "\n".join("".join(row) for row in table[idx])

    def stats(self):
        lum = self.img[..., :3].astype(float)
        v = (lum[..., 0] * .2126 + lum[..., 1] * .7152 + lum[..., 2] * .0722) / 255.0
        alpha = self.img[..., 3] > 128
        return {
            "w": self.w, "h": self.h, "px": self.w * self.h,
            "meanLuma": round(float(v.mean()), 4),
            "litRatio": round(float((v > .045).mean()), 4),
            "opaqueRatio": round(float(alpha.mean()), 4),
        }

    # ------------------------------------------------------------- écriture
    def to_pillow(self):
        """La plaque en image Pillow, pour finir le travail avec la bibliothèque."""
        if Image is None:
            raise RuntimeError("Pillow n'est pas installé (pip install pillow)")
        return Image.frombytes("RGBA", (self.w, self.h), self.img.tobytes())

    def save(self, path):
        path = str(path)
        if Image is not None:
            self.to_pillow().save(path, optimize=True)
            return path
        raw = bytearray()
        stride = self.w * 4
        data = self.img.tobytes()
        for y in range(self.h):
            raw.append(0)                       # filtre 0, sans perte : les PNG
            raw += data[y * stride:(y + 1) * stride]  # restent petits grâce à zlib
        ihdr = struct.pack(">IIBBBBB", self.w, self.h, 8, 6, 0, 0, 0)
        out = bytearray(b"\x89PNG\r\n\x1a\n")
        for kind, body in ((b"IHDR", ihdr), (b"IDAT", zlib.compress(bytes(raw), 9)), (b"IEND", b"")):
            out += struct.pack(">I", len(body)) + kind + body + _crc(body, kind)
        with open(path, "wb") as f:
            f.write(out)
        return path

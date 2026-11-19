// Draws the flat illustrations used by `pnpm db:samples` and saves them as
// WebP in scripts/sample-images/. Only needed if you change the drawings:
//   node scripts/make-sample-images.mjs
// Uses Playwright's Chromium (already installed for e2e) as a canvas.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = new URL("./sample-images/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// Runs inside the browser: draws one scene on a 1600x1067 canvas, returns a WebP data URL.
function draw(scene) {
  const W = 1600, H = 1067;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");

  const sky = (top, bottom) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  };
  const poly = (color, pts) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); g.fill();
  };
  const circle = (color, x, y, r) => { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const rect = (color, x, y, w, h) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  // Red-rock mesas on the horizon.
  const mesas = (far, near, y) => {
    poly(far, [0, y, 120, y - 120, 420, y - 130, 520, y - 40, 760, y - 50, 820, y - 160, 1180, y - 170, 1250, y - 60, 1600, y - 70, 1600, H, 0, H]);
    poly(near, [0, y + 60, 300, y + 30, 640, y + 70, 1000, y + 40, 1600, y + 80, 1600, H, 0, H]);
  };

  switch (scene) {
    case "library": {
      rect("#f3e7d3", 0, 0, W, H);
      rect("#8a5a3b", 0, 840, W, 227);
      const colors = ["#b5452b", "#2f6f73", "#e0a43a", "#5b4b8a", "#3f7d4a", "#c8643b", "#2d4f7c"];
      for (let shelf = 0; shelf < 3; shelf++) {
        const y = 140 + shelf * 240;
        rect("#6e4630", 120, y + 200, 1360, 24);
        let x = 140;
        let i = shelf * 3;
        while (x < 1440) {
          const w = 40 + ((i * 37) % 50), h = 140 + ((i * 53) % 60);
          rect(colors[i % colors.length], x, y + 200 - h, w, h);
          rect("rgba(255,255,255,.35)", x + 8, y + 220 - h, w - 16, 8);
          x += w + 6; i++;
        }
      }
      break;
    }
    case "soccer": {
      sky("#8fc7e8", "#d8eef7");
      mesas("#c9785a", "#b5603f", 520);
      rect("#4f9a4a", 0, 600, W, 467);
      g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 10;
      g.beginPath(); g.ellipse(800, 830, 360, 120, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(800, 600); g.lineTo(800, 1067); g.stroke();
      circle("#ffffff", 980, 860, 90);
      g.fillStyle = "#222";
      for (const [dx, dy] of [[0, 0], [-50, -40], [50, -40], [-40, 50], [42, 50]]) {
        g.beginPath(); g.arc(980 + dx, 860 + dy, 22, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case "trophy": {
      rect("#203a5c", 0, 0, W, H);
      for (let i = 0; i < 40; i++) circle(["#e0a43a", "#b5452b", "#f3e7d3", "#4f9a4a"][i % 4], (i * 397) % W, (i * 211) % 700, 10 + (i % 4) * 4);
      poly("#e0a43a", [620, 300, 980, 300, 940, 560, 860, 640, 740, 640, 660, 560]);
      g.strokeStyle = "#e0a43a"; g.lineWidth = 34;
      g.beginPath(); g.arc(620, 400, 80, Math.PI / 2, Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(980, 400, 80, -Math.PI / 2, Math.PI / 2); g.stroke();
      rect("#c58d2a", 770, 640, 60, 120);
      rect("#8a5a3b", 660, 760, 280, 90);
      break;
    }
    case "snow": {
      sky("#7d8ea3", "#d6dde6");
      mesas("#a9b4c2", "#e9eef3", 560);
      rect("#f7f9fb", 0, 700, W, 367);
      rect("#e0a43a", 520, 700, 420, 160);
      rect("#c8643b", 900, 650, 180, 210);
      rect("#9fd0f0", 930, 680, 120, 70);
      poly("#5c6670", [380, 860, 520, 760, 520, 880]);
      circle("#333", 620, 880, 50); circle("#333", 980, 880, 50);
      for (let i = 0; i < 160; i++) circle("rgba(255,255,255,.9)", (i * 173) % W, (i * 97) % 760, 4 + (i % 3) * 3);
      break;
    }
    case "greenhouse": {
      sky("#f2c38f", "#fbe7cf");
      mesas("#cf8a63", "#b8693f", 560);
      rect("#9b6b47", 0, 760, W, 307);
      poly("rgba(214,236,226,.85)", [360, 820, 360, 520, 800, 340, 1240, 520, 1240, 820]);
      g.strokeStyle = "#ffffff"; g.lineWidth = 12;
      for (const x of [360, 580, 800, 1020, 1240]) { g.beginPath(); g.moveTo(x, 820); g.lineTo(x, x === 800 ? 340 : x < 800 ? 520 - (x - 360) * 0.41 : 340 + (x - 800) * 0.41); g.stroke(); }
      for (let i = 0; i < 9; i++) {
        const x = 420 + i * 92;
        circle("#3f7d4a", x, 760, 34); circle("#5ea35a", x + 18, 744, 26);
      }
      break;
    }
    case "craftfair": {
      sky("#9cd1ec", "#e3f3fb");
      rect("#d9b98f", 0, 760, W, 307);
      const tents = ["#b5452b", "#2f6f73", "#e0a43a", "#5b4b8a"];
      tents.forEach((col, i) => {
        const x = 100 + i * 370;
        poly(col, [x, 480, x + 160, 380, x + 320, 480]);
        rect("#ffffff", x + 10, 480, 300, 30);
        for (let s = 0; s < 6; s++) rect(col, x + 10 + s * 50, 480, 25, 30);
        rect("#7a5236", x + 10, 510, 12, 250); rect("#7a5236", x + 298, 510, 12, 250);
        rect("#f3e7d3", x + 30, 640, 260, 60);
        for (let k = 0; k < 4; k++) circle(tents[(i + k + 1) % 4], x + 70 + k * 60, 625, 22);
      });
      g.strokeStyle = "#555"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(800, 260, 1600, 120); g.stroke();
      for (let i = 0; i < 16; i++) {
        const x = 50 + i * 100, y = 120 + Math.sin((x / 1600) * Math.PI) * 140 * 0.5 + 25;
        poly(tents[i % 4], [x - 26, y - 20, x + 26, y - 20, x, y + 30]);
      }
      break;
    }
    case "bakery": {
      rect("#f6ead8", 0, 0, W, H);
      rect("#8a5a3b", 0, 700, W, 367);
      rect("#6e4630", 0, 690, W, 20);
      for (let i = 0; i < 5; i++) {
        const x = 220 + i * 290, y = 600;
        g.fillStyle = "#c98a45"; g.beginPath(); g.ellipse(x, y, 120, 70, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#dca865"; g.beginPath(); g.ellipse(x, y - 15, 100, 45, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#a8692f"; g.lineWidth = 8;
        for (let s = -1; s <= 1; s++) { g.beginPath(); g.moveTo(x + s * 40 - 20, y - 40); g.lineTo(x + s * 40 + 20, y + 5); g.stroke(); }
        circle("#3f7d4a", x - 30, y - 20, 8); circle("#3f7d4a", x + 25, y - 10, 7);
      }
      for (let i = 0; i < 4; i++) rect("rgba(181,69,43,.85)", 140 + i * 360, 150, 260, 40);
      break;
    }
    case "trail": {
      sky("#f0b27a", "#fde3c4");
      circle("#fff1d6", 1250, 260, 90);
      mesas("#b5603f", "#9b4f33", 560);
      rect("#c98a5a", 0, 700, W, 367);
      poly("#e4c29a", [700, 700, 900, 700, 1300, 1067, 300, 1067]);
      for (let i = 0; i < 14; i++) {
        const x = (i * 131) % W, y = 760 + ((i * 89) % 260);
        if (x > 300 && x < 1300 && y > 720) continue;
        circle("#6f8f4e", x, y, 26 + (i % 3) * 8);
      }
      for (let i = 0; i < 3; i++) { rect("#2f6f73", 420 + i * 300, 860 - i * 40, 50, 70); circle("#2f6f73", 445 + i * 300, 850 - i * 40, 18); }
      break;
    }
    case "market": {
      sky("#cfe6f2", "#eef6fa");
      rect("#b07a4f", 0, 640, W, 427);
      const crate = (x, fill) => {
        rect("#8a5a3b", x, 700, 360, 220);
        rect("#a8714a", x + 10, 710, 340, 20);
        for (let i = 0; i < 12; i++) fill(x + 50 + (i % 4) * 85, 760 + Math.floor(i / 4) * 60);
      };
      crate(80, (x, y) => { g.fillStyle = "#e0912f"; g.beginPath(); g.ellipse(x, y, 40, 30, 0, 0, Math.PI * 2); g.fill(); });
      crate(620, (x, y) => { g.fillStyle = "#3f8a3a"; g.beginPath(); g.ellipse(x, y, 14, 42, 0.5, 0, Math.PI * 2); g.fill(); });
      crate(1160, (x, y) => { g.fillStyle = "#b5452b"; g.beginPath(); g.ellipse(x, y, 14, 42, -0.5, 0, Math.PI * 2); g.fill(); });
      poly("#2f6f73", [40, 300, 800, 180, 1560, 300]);
      for (let s = 0; s < 15; s++) rect(s % 2 ? "#2f6f73" : "#f3e7d3", 40 + s * 101, 300, 101, 60);
      break;
    }
  }
  return c.toDataURL("image/webp", 0.82);
}

const SCENES = ["library", "soccer", "trophy", "snow", "greenhouse", "craftfair", "bakery", "trail", "market"];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const scene of SCENES) {
  const dataUrl = await page.evaluate(draw, scene);
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(new URL(`${scene}.webp`, OUT), buf);
  console.log(`${scene}.webp ${(buf.length / 1024).toFixed(0)} KB`);
}
await browser.close();

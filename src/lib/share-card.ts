type ShareCardInput = {
  id: string;
  question: string;
  redVotes: number;
  blueVotes: number;
  myComment: string;
};

const FONT_CN = "'WenYueXinQingNianTi','PingFang SC','Microsoft YaHei',sans-serif";
const FONT_NUM = "'AccidentalPresidency','Arial Black',sans-serif";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  align: CanvasTextAlign = "left"
) {
  const chars = text.split("");
  let line = "";
  let lineCount = 0;
  ctx.textAlign = align;

  for (let i = 0; i < chars.length; i++) {
    const next = line + chars[i];
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = chars[i];
      lineCount++;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = next;
    }
  }

  if (lineCount < maxLines) {
    const left = chars.length > line.length + lineCount ? `${line.slice(0, -1)}…` : line;
    ctx.fillText(left, x, y + lineCount * lineHeight);
  }
}

async function ensureFonts() {
  const faces = [
    new FontFace("AccidentalPresidency", "url(/font/AccidentalPresidency.ttf)"),
    new FontFace("WenYueXinQingNianTi", "url(/font/WenYueXinQingNianTi/WenYue-XinQingNianTi-W8-J-2.otf)"),
  ];
  try {
    await Promise.all(faces.map((f) => f.load()));
    faces.forEach((f) => document.fonts.add(f));
  } catch {
    // fallback to system fonts
  }
}

export async function generateShareCardBlob(input: ShareCardInput): Promise<Blob> {
  await ensureFonts();

  const width = 1080;
  const height = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const totalVotes = Math.max(0, input.redVotes + input.blueVotes);
  const redRatio = totalVotes > 0 ? input.redVotes / totalVotes : 0.5;

  // Background
  ctx.fillStyle = "#0b1ea8";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ef111c";
  ctx.fillRect(48, 356, width - 96, 360);

  // Top question board (white + yellow)
  const qx = 92;
  const qy = 66;
  const qw = width - 184;
  const qh = 252;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qx, qy, qw, qh);
  ctx.fillStyle = "#ffe300";
  ctx.fillRect(qx + 16, qy + 22, qw - 32, qh - 44);

  ctx.fillStyle = "#111111";
  ctx.font = `900 72px ${FONT_CN}`;
  wrapText(ctx, input.question, width / 2, qy + 118, qw - 120, 82, 2, "center");

  // Red/Blue scoreboard
  const panelX = 94;
  const panelY = 398;
  const panelW = width - 188;
  const barX = panelX + 92;
  const barY = panelY + 72;
  const barW = panelW - 184;
  const barH = 86;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(barX - 4, barY - 4, barW + 8, 4);
  ctx.fillRect(barX - 4, barY + barH, barW + 8, 4);
  ctx.fillRect(barX - 4, barY, 4, barH);
  ctx.fillRect(barX + barW, barY, 4, barH);

  const minPart = 16;
  let redW = Math.round((barW - minPart * 2) * redRatio) + minPart;
  redW = Math.max(minPart, Math.min(barW - minPart, redW));
  const blueW = barW - redW;

  ctx.fillStyle = "#ef000f";
  ctx.fillRect(barX + 6, barY + 6, redW - 6, barH - 12);
  ctx.fillStyle = "#1238dd";
  ctx.fillRect(barX + redW, barY + 6, blueW - 6, barH - 12);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 96px ${FONT_NUM}`;
  ctx.textAlign = "left";
  ctx.fillText(String(input.redVotes), panelX, panelY + 152);
  ctx.textAlign = "right";
  ctx.fillText(String(input.blueVotes), panelX + panelW, panelY + 152);

  ctx.font = `900 52px ${FONT_CN}`;
  ctx.textAlign = "left";
  ctx.fillText("红方", panelX + 108, panelY + 248);
  ctx.textAlign = "right";
  ctx.fillText("蓝方", panelX + panelW - 108, panelY + 248);

  ctx.font = `800 34px ${FONT_CN}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff2c1";
  ctx.fillText(`总票数 ${totalVotes}`, width / 2, panelY + 306);

  // AI comment panel (no QR)
  const cx = 72;
  const cy = 754;
  const cw = width - 144;
  const ch = 286;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx, cy, cw, ch);
  ctx.fillStyle = "#111111";
  ctx.fillRect(cx, cy, cw, 4);
  ctx.fillRect(cx, cy + ch - 4, cw, 4);
  ctx.fillRect(cx, cy, 4, ch);
  ctx.fillRect(cx + cw - 4, cy, 4, ch);

  ctx.fillStyle = "#111111";
  ctx.font = `900 44px ${FONT_CN}`;
  ctx.textAlign = "left";
  ctx.fillText("我的 AI 分身如是说", cx + 24, cy + 58);
  ctx.font = `700 34px ${FONT_CN}`;
  wrapText(ctx, input.myComment || "暂无分身回答", cx + 24, cy + 120, cw - 48, 48, 3, "left");

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Failed to render share card"));
      else resolve(blob);
    }, "image/png");
  });
}

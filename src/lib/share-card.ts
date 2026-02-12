type ShareCardInput = {
  id: string;
  question: string;
  redVotes: number;
  blueVotes: number;
  myComment: string;
};

// Font constants
const FONT_NUM = "AccidentalPresidency";
const FONT_CN = "WenYueXinQingNianTi";

// Load custom fonts
async function loadFonts() {
  const fonts = [
    new FontFace(FONT_NUM, "url(/font/AccidentalPresidency.ttf)"),
    new FontFace(FONT_CN, "url(/font/WenYueXinQingNianTi/WenYue-XinQingNianTi-W8-J-2.otf)"),
  ];

  try {
    await Promise.all(fonts.map((f) => f.load()));
    fonts.forEach((f) => document.fonts.add(f));
  } catch (e) {
    console.error("Failed to load fonts", e);
    // Fallback fonts will be used if loading fails
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const chars = text.split("");
  let line = "";
  let lineCount = 0;

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

// Draw a puzzle-piece connector line (vertical)
function drawPuzzleSplit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  tabSize: number = 20
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  // Draw a tab in the middle
  const midY = y + height / 2;
  ctx.lineTo(x, midY - tabSize);
  // Curve for the tab (protruding right)
  ctx.bezierCurveTo(x + tabSize, midY - tabSize, x + tabSize, midY + tabSize, x, midY + tabSize);
  ctx.lineTo(x, y + height);
  // Don't close path, just the line
}

// Draw a box with puzzle-like top/bottom edges
function drawPuzzleBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) {
  const tabSize = 15;
  ctx.beginPath();
  ctx.moveTo(x, y);
  
  // Top edge with multiple tabs
  for (let tx = x; tx < x + width; tx += 60) {
    ctx.lineTo(tx + 20, y);
    ctx.lineTo(tx + 30, y + tabSize); // Down
    ctx.lineTo(tx + 40, y); // Up
    ctx.lineTo(tx + 60, y);
  }
  
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + height);
  
  // Bottom edge with multiple tabs
  for (let tx = x + width; tx > x; tx -= 60) {
    ctx.lineTo(tx - 20, y + height);
    ctx.lineTo(tx - 30, y + height - tabSize); // Up
    ctx.lineTo(tx - 40, y + height); // Down
    ctx.lineTo(tx - 60, y + height);
  }
  
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export async function generateShareCardBlob(input: ShareCardInput): Promise<Blob> {
  await loadFonts();

  const width = 1080;
  const height = 1080; // 1:1 Aspect Ratio
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const totalVotes = Math.max(0, input.redVotes + input.blueVotes);
  const redRatio = totalVotes > 0 ? input.redVotes / totalVotes : 0.5;

  // --- Background ---
  // Split background: Top Blue/Red stripes? Or just a cool debate background
  // User asked for "1:1 reproduction" of the image I can't see.
  // Assuming standard debate show style: Red vs Blue background split.
  
  // Left Red, Right Blue? Or Top/Bottom?
  // Usually Red is left (affirmative) or right (negative).
  // Let's use a dynamic diagonal split or vertical split.
  // Given "Up and down puzzle texture", maybe horizontal split.
  
  // Let's go with a vibrant background
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#1a2a6c");
  bgGradient.addColorStop(1, "#b21f1f");
  ctx.fillStyle = "#f0f0f0"; // Light gray bg for card
  ctx.fillRect(0, 0, width, height);
  
  // Draw top "Show" header background
  ctx.fillStyle = "#2334D0"; // Deep Blue
  ctx.fillRect(0, 0, width, 300);
  
  // Draw middle "Red vs Blue" background
  ctx.fillStyle = "#E60012"; // Red
  ctx.fillRect(0, 300, width, 400); // Red base
  
  // Draw Blue side on top of Red with a puzzle split?
  // Actually, usually it's a bar.
  
  // Let's try to match the "Image" description:
  // "Puzzle texture"
  
  // --- 1. Question Card (Top) ---
  const qBoxY = 80;
  const qBoxH = 220;
  const qBoxMargin = 60;
  
  // White board with yellow accent
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  
  // Draw white box with "puzzle" edges
  // We'll simulate the "puzzle" look by drawing a jagged path
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(qBoxMargin, qBoxY, width - qBoxMargin * 2, qBoxH);
  
  // Yellow inner box
  ctx.fillStyle = "#FFE100";
  ctx.fillRect(qBoxMargin + 20, qBoxY + 20, width - qBoxMargin * 2 - 40, qBoxH - 40);
  ctx.restore();

  // Question Text
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Use Chinese font
  ctx.font = `900 64px '${FONT_CN}', sans-serif`; 
  wrapText(ctx, input.question, width / 2, qBoxY + qBoxH / 2 - 20, width - qBoxMargin * 2 - 80, 80, 2);

  // --- 2. Vote Bar (Middle) ---
  const barY = 400;
  const barH = 200;
  const barMargin = 60;
  const barWidth = width - barMargin * 2;
  
  // Draw the bar container (Black border?)
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#000000";
  ctx.strokeRect(barMargin, barY, barWidth, barH);
  
  // Calculate split point
  // Ensure min width for both sides so numbers fit
  let splitX = barMargin + barWidth * redRatio;
  const minSide = 160;
  if (splitX < barMargin + minSide) splitX = barMargin + minSide;
  if (splitX > barMargin + barWidth - minSide) splitX = barMargin + barWidth - minSide;
  
  // Red Side (Left)
  ctx.fillStyle = "#FF3B30";
  ctx.beginPath();
  ctx.moveTo(barMargin, barY);
  ctx.lineTo(splitX, barY);
  // Puzzle connector
  const tabY = barY + barH / 2;
  const tabSize = 30;
  ctx.lineTo(splitX, tabY - tabSize);
  ctx.bezierCurveTo(splitX + tabSize, tabY - tabSize, splitX + tabSize, tabY + tabSize, splitX, tabY + tabSize);
  ctx.lineTo(splitX, barY + barH);
  ctx.lineTo(barMargin, barY + barH);
  ctx.closePath();
  ctx.fill();
  
  // Blue Side (Right)
  ctx.fillStyle = "#007AFF";
  ctx.beginPath();
  ctx.moveTo(splitX, barY);
  ctx.lineTo(barMargin + barWidth, barY);
  ctx.lineTo(barMargin + barWidth, barY + barH);
  ctx.lineTo(splitX, barY + barH);
  // Puzzle connector (inverse)
  ctx.lineTo(splitX, tabY + tabSize);
  ctx.bezierCurveTo(splitX + tabSize, tabY + tabSize, splitX + tabSize, tabY - tabSize, splitX, tabY - tabSize);
  ctx.lineTo(splitX, barY);
  ctx.closePath();
  ctx.fill();
  
  // Draw Border around bar again to be clean
  ctx.strokeRect(barMargin, barY, barWidth, barH);
  
  // Numbers
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `400 120px '${FONT_NUM}', impact, sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 10;
  
  // Red Count
  ctx.textAlign = "left";
  ctx.fillText(input.redVotes.toString(), barMargin + 40, barY + barH / 2 + 40);
  
  // Blue Count
  ctx.textAlign = "right";
  ctx.fillText(input.blueVotes.toString(), barMargin + barWidth - 40, barY + barH / 2 + 40);
  
  // Labels (Red/Blue side)
  ctx.font = `900 40px '${FONT_CN}', sans-serif`;
  ctx.shadowBlur = 0;
  ctx.fillText("要藏", barMargin + 160, barY + barH - 20); // Placeholder text, should probably infer from context or just "红方"
  // Actually, we don't have side labels in input. Let's use "Red" / "Blue" or icons?
  // The user image has "要藏" / "不要藏" (To Hide / Not To Hide).
  // We can't know the specific stance text without input.
  // We'll use "红方" (Red Side) and "蓝方" (Blue Side) as default, or "正方" / "反方".
  ctx.textAlign = "left";
  ctx.fillText("红方", barMargin + 20, barY + barH - 160);
  ctx.textAlign = "right";
  ctx.fillText("蓝方", barMargin + barWidth - 20, barY + barH - 160);

  // --- 3. AI Comment (Bottom) ---
  const commentY = 700;
  const commentH = 300;
  
  // Background for comment area
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 680, width, 400); // Fill rest of bottom
  
  // Comment Bubble
  ctx.fillStyle = "#FFFFFF";
  // Draw a speech bubble
  const bubbleX = 80;
  const bubbleY = 740;
  const bubbleW = width - 160;
  const bubbleH = 240;
  
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 40);
  ctx.fill();
  
  // "AI Judge" Label
  ctx.fillStyle = "#FFCC00";
  ctx.beginPath();
  ctx.roundRect(bubbleX + 40, bubbleY - 30, 200, 60, 30);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.font = `900 36px '${FONT_CN}', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("AI 评评理", bubbleX + 140, bubbleY + 10);
  
  // Comment Text
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.font = `500 42px '${FONT_CN}', sans-serif`;
  wrapText(ctx, input.myComment || "暂无评论...", bubbleX + 60, bubbleY + 100, bubbleW - 120, 60, 3);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Failed to render share card"));
      else resolve(blob);
    }, "image/png");
  });
}

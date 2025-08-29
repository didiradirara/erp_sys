// signatureTrim.ts
export function exportTightSignatureDataURL(
  canvas: HTMLCanvasElement,
  opts?: {
    // 거의 흰색(배경)으로 간주할 임계값 (0=검정 ~ 255=흰색). 보통 250~255
    whiteThreshold?: number;
    // 잘라낸 후 바깥쪽 여백(px)
    padding?: number;
    // 결과 높이를 여기에 맞춰 리사이즈(선택). 예: 56~72 정도 추천
    targetHeight?: number;
    // 배경색. 투명으로 저장하고 싶으면 null
    background?: string | null; // '#fff' | null
  }
): string | null {
  const t = { whiteThreshold: 252, padding: 6, targetHeight: 64, background: '#fff', ...opts };

  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  // 글씨(비-흰색) 영역 찾기
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      // 알파가 거의 0이면 스킵
      if (a < 5) continue;
      // 밝기(간단 평균)로 거의 흰색 판정
      const bright = (r + g + b) / 3;
      if (bright <= t.whiteThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 선이 하나도 없으면 null
  if (maxX < 0 || maxY < 0) return null;

  // 패딩 적용 + 경계 보정
  minX = Math.max(0, minX - t.padding);
  minY = Math.max(0, minY - t.padding);
  maxX = Math.min(w - 1, maxX + t.padding);
  maxY = Math.min(h - 1, maxY + t.padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 결과 캔버스 만들고 배경/스케일링
  const out = document.createElement('canvas');
  const scale = t.targetHeight ? t.targetHeight / cropH : 1;
  out.width = Math.max(1, Math.round(cropW * scale));
  out.height = Math.max(1, Math.round(cropH * scale));
  const octx = out.getContext('2d')!;
  // 배경
  if (t.background) {
    octx.fillStyle = t.background;
    octx.fillRect(0, 0, out.width, out.height);
  } else {
    // 투명 배경
    octx.clearRect(0, 0, out.width, out.height);
  }
  // 보간 선명도
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(
    canvas,
    minX, minY, cropW, cropH,    // from
    0, 0, out.width, out.height  // to
  );

  return out.toDataURL('image/png'); // 서버 스키마 그대로 PNG data URL
}
export type AtmosphereColor = {
  r: number;
  g: number;
  b: number;
};

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function sampleAtmosphere(img: HTMLImageElement): AtmosphereColor | null {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let r = 0;
  let g = 0;
  let b = 0;
  let weightSum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i] ?? 0;
    const pg = data[i + 1] ?? 0;
    const pb = data[i + 2] ?? 0;
    const pa = data[i + 3] ?? 0;
    if (pa < 128) continue;

    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    if (max < 28 || min > 242) continue;

    const sat = max === 0 ? 0 : (max - min) / max;
    const weight = 0.3 + sat * 0.7;
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    weightSum += weight;
  }

  if (weightSum < 1) return null;

  return {
    r: Math.round(r / weightSum),
    g: Math.round(g / weightSum),
    b: Math.round(b / weightSum),
  };
}

export async function extractAtmosphereColor(
  src: string,
): Promise<AtmosphereColor | null> {
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(src, true);
    } catch {
      img = await loadImage(src, false);
    }
    return sampleAtmosphere(img);
  } catch {
    return null;
  }
}

/* eslint-disable @next/next/no-img-element -- ImageResponse needs an inline data URI image. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "DriftMap contract review logo on a dark grid";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const image = await readFile(join(process.cwd(), "public", "brand", "driftmap-social.png"));
  const dataUrl = `data:image/png;base64,${image.toString("base64")}`;

  return new ImageResponse(
    <div style={{ width: size.width, height: size.height, display: "flex", background: "#06060a" }}>
      <img src={dataUrl} width={size.width} height={size.height} alt="DriftMap full logo" style={{ display: "flex" }} />
    </div>,
    size,
  );
}

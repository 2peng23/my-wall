import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  validatePhoto,
  validatePhotoContents,
} from "@/lib/photos";

describe("photo validation", () => {
  it("allows supported raster formats within the exact size limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"])
      expect(validatePhoto({ type, size: MAX_PHOTO_BYTES })).toBeNull();
  });
  it("rejects oversized, empty, and active/non-image files", () => {
    for (const file of [
      { type: "image/png", size: MAX_PHOTO_BYTES + 1 },
      { type: "image/png", size: 0 },
      { type: "image/svg+xml", size: 100 },
      { type: "text/html", size: 100 },
    ])
      expect(validatePhoto(file)).not.toBeNull();
  });

  it("rejects documents and mismatched formats disguised as photos", async () => {
    for (const file of [
      new File(["<script>alert(1)</script>"], "photo.jpg", {
        type: "image/jpeg",
      }),
      new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
        "photo.gif",
        { type: "image/gif" },
      ),
    ])
      expect(await validatePhotoContents(file)).not.toBeNull();
  });

  it("recognizes each supported raster signature", async () => {
    for (const [type, signature] of [
      ["image/jpeg", [255, 216, 255]],
      ["image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
      ["image/gif", [71, 73, 70, 56, 57, 97]],
      ["image/webp", [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
    ] as const) {
      const file = new File([new Uint8Array(signature)], "photo", { type });
      expect(await validatePhotoContents(file)).toBeNull();
    }
  });
});

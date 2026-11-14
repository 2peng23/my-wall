import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { localTestClients } from "./local-test-clients.mjs";

const { visitor, administrator } = localTestClients();
const bucket = "wall-photos";
const paths = [];
const makePath = (extension = "png") => {
  const path = `posts/${randomUUID()}/${randomUUID()}.${extension}`;
  paths.push(path);
  return path;
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
  "base64",
);

try {
  const path = makePath();
  const upload = await visitor.storage
    .from(bucket)
    .upload(path, png, { contentType: "image/png", upsert: false });
  assert.ifError(upload.error);
  const publicUrl = visitor.storage.from(bucket).getPublicUrl(path)
    .data.publicUrl;
  assert.equal((await fetch(publicUrl)).status, 200);
  console.log("PASS Anonymous upload and public retrieval");

  const overwrite = await visitor.storage
    .from(bucket)
    .upload(path, png, { contentType: "image/png", upsert: true });
  assert.ok(overwrite.error);
  await visitor.storage.from(bucket).remove([path]);
  assert.equal((await fetch(publicUrl, { cache: "no-store" })).status, 200);
  console.log("PASS Anonymous overwrite/delete cannot alter stored photos");

  const badType = await visitor.storage
    .from(bucket)
    .upload(makePath(), Buffer.from("<svg/>"), {
      contentType: "image/svg+xml",
    });
  assert.ok(badType.error);
  const oversized = await visitor.storage
    .from(bucket)
    .upload(makePath(), Buffer.alloc(5 * 1024 * 1024 + 1), {
      contentType: "image/png",
    });
  assert.ok(oversized.error);
  console.log("PASS Bucket rejects unsupported MIME types and oversized files");

  const unsafePath = "outside-posts.png";
  paths.push(unsafePath);
  const badPath = await visitor.storage
    .from(bucket)
    .upload(unsafePath, png, { contentType: "image/png" });
  assert.ok(badPath.error);
  console.log("PASS Upload policy restricts object paths");
} finally {
  const { error } = await administrator.storage.from(bucket).remove(paths);
  if (error)
    throw new Error("Owned storage-test objects could not be cleaned up.");
}

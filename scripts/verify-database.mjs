import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { localTestClients } from "./local-test-clients.mjs";

const { visitor, administrator } = localTestClients();
const ownedIdentifiers = [];
const summary = [];
const visitorIdentifier = randomUUID();
const guestFields = { visitor_id: visitorIdentifier, author_name: null };

async function check(name, verification) {
  await verification();
  summary.push(name);
  console.log(`PASS ${name}`);
}

try {
  const identifier = randomUUID();
  ownedIdentifiers.push(identifier);
  await check(
    "Anonymous insert with visitor identity and authoritative timestamp",
    async () => {
      const { data, error } = await visitor
        .from("posts")
        .insert({
          ...guestFields,
          id: identifier,
          content: "Integration check: a real database-backed hello.",
        })
        .select()
        .single();
      assert.ifError(error);
      assert.equal(data.author_name, null);
      assert.equal(data.visitor_id, visitorIdentifier);
      assert.ok(Math.abs(Date.now() - Date.parse(data.created_at)) < 60_000);
    },
  );

  await check("A fresh client can read the persisted row", async () => {
    const { visitor: freshVisitor } = localTestClients();
    const { data, error } = await freshVisitor
      .from("posts")
      .select("id, content")
      .eq("id", identifier)
      .single();
    assert.ifError(error);
    assert.equal(data.id, identifier);
  });

  await check(
    "Database rejects blank, Unicode whitespace, and 281-character messages",
    async () => {
      const invalidMessages = [
        "",
        " \n\t",
        "\u00a0\u1680\u2000\u2028\u202f\u205f\u3000\ufeff",
        "a".repeat(281),
        "🌱".repeat(281),
      ];
      for (const content of invalidMessages) {
        const candidateIdentifier = randomUUID();
        ownedIdentifiers.push(candidateIdentifier);
        const { error } = await visitor
          .from("posts")
          .insert({ ...guestFields, id: candidateIdentifier, content });
        assert.equal(error?.code, "23514");
      }
    },
  );

  await check("Exactly 280 Unicode code points are accepted", async () => {
    const candidateIdentifier = randomUUID();
    ownedIdentifiers.push(candidateIdentifier);
    const { error } = await visitor
      .from("posts")
      .insert({
        ...guestFields,
        id: candidateIdentifier,
        content: "🌱".repeat(280),
      });
    assert.ifError(error);
  });

  await check(
    "Photo-only posts are allowed while empty and invalid posts remain blocked",
    async () => {
      const imagePath = `posts/${randomUUID()}/${randomUUID()}.png`;
      const photoOnlyIdentifier = randomUUID();
      ownedIdentifiers.push(photoOnlyIdentifier);
      const { data, error } = await visitor
        .from("posts")
        .insert({
          ...guestFields,
          id: photoOnlyIdentifier,
          content: "",
          image_path: imagePath,
        })
        .select("content, image_path")
        .single();
      assert.ifError(error);
      assert.equal(data.content, "");
      assert.equal(data.image_path, imagePath);
      for (const fields of [
        { content: "", image_path: null },
        { content: " \n ", image_path: imagePath },
        { content: "a".repeat(281), image_path: imagePath },
        { content: "", image_path: "invalid-photo-path" },
      ]) {
        const candidateIdentifier = randomUUID();
        ownedIdentifiers.push(candidateIdentifier);
        const { error } = await visitor
          .from("posts")
          .insert({ ...guestFields, id: candidateIdentifier, ...fields });
        assert.equal(error?.code, "23514");
      }
    },
  );

  await check(
    "Anonymous callers cannot forge creation timestamps",
    async () => {
      for (const forgedField of [{ created_at: "2000-01-01T00:00:00Z" }]) {
        const candidateIdentifier = randomUUID();
        ownedIdentifiers.push(candidateIdentifier);
        const { error } = await visitor
          .from("posts")
          .insert({
            ...guestFields,
            id: candidateIdentifier,
            content: "Invalid metadata",
            ...forgedField,
          });
        assert.equal(error?.code, "42501");
      }
    },
  );

  await check("Anonymous update and delete are denied", async () => {
    const update = await visitor
      .from("posts")
      .update({ content: "Changed" })
      .eq("id", identifier);
    const removal = await visitor.from("posts").delete().eq("id", identifier);
    assert.equal(update.error?.code, "42501");
    assert.equal(removal.error?.code, "42501");
    const { data } = await visitor
      .from("posts")
      .select("content")
      .eq("id", identifier)
      .single();
    assert.equal(
      data.content,
      "Integration check: a real database-backed hello.",
    );
  });

  await check("Duplicate submission IDs cannot create two rows", async () => {
    const { error } = await visitor
      .from("posts")
      .insert({ ...guestFields, id: identifier, content: "Duplicate" });
    assert.equal(error?.code, "23505");
  });

  await check("Realtime delivers actual database INSERT events", async () => {
    const realtimeIdentifier = randomUUID();
    ownedIdentifiers.push(realtimeIdentifier);
    let resolveArrival;
    const arrival = new Promise((resolve) => {
      resolveArrival = resolve;
    });
    const channel = visitor
      .channel(`integration-${randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          if (payload.new.id === realtimeIdentifier)
            resolveArrival(payload.new);
        },
      );
    try {
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(
          () => reject(new Error("Realtime subscription timed out")),
          12_000,
        );
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(deadline);
            resolve();
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            clearTimeout(deadline);
            reject(new Error("Realtime subscription failed"));
          }
        });
      });
      const { error } = await visitor
        .from("posts")
        .insert({
          ...guestFields,
          id: realtimeIdentifier,
          content: "Integration check: Realtime delivery.",
        });
      assert.ifError(error);
      let timer;
      try {
        const received = await Promise.race([
          arrival,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Realtime event timed out")),
              12_000,
            );
          }),
        ]);
        assert.equal(received.id, realtimeIdentifier);
      } finally {
        clearTimeout(timer);
      }
    } finally {
      await visitor.removeChannel(channel);
    }
  });

  await check(
    "Named posts retain the same browser visitor identity",
    async () => {
      const namedIdentifier = randomUUID();
      ownedIdentifiers.push(namedIdentifier);
      const { data, error } = await visitor
        .from("posts")
        .insert({
          ...guestFields,
          id: namedIdentifier,
          content: "Integration check: a named message.",
          author_name: "Nadia Ali",
        })
        .select()
        .single();
      assert.ifError(error);
      assert.equal(data.author_name, "Nadia Ali");
      assert.equal(data.visitor_id, visitorIdentifier);
    },
  );

  await check("Database rejects invalid names", async () => {
    for (const author_name of [
      "",
      "   ",
      "🌱".repeat(49),
      "Nadia\nAli",
      "  Nadia  ",
    ]) {
      const candidateIdentifier = randomUUID();
      ownedIdentifiers.push(candidateIdentifier);
      const { error } = await visitor
        .from("posts")
        .insert({
          ...guestFields,
          id: candidateIdentifier,
          content: "Name validation",
          author_name,
        });
      assert.equal(error?.code, "23514");
    }
  });

  await check("Anonymous writes require a visitor UUID", async () => {
    const candidateIdentifier = randomUUID();
    ownedIdentifiers.push(candidateIdentifier);
    const { error } = await visitor
      .from("posts")
      .insert({
        id: candidateIdentifier,
        content: "Missing visitor identity",
        author_name: null,
      });
    assert.equal(error?.code, "42501");
  });

  console.log(
    `Verified ${summary.length} checks against real local Supabase. Test rows are removed below.`,
  );
} finally {
  if (ownedIdentifiers.length) {
    const { error } = await administrator
      .from("posts")
      .delete()
      .in("id", ownedIdentifiers);
    if (error)
      throw new Error("Owned integration-test rows could not be cleaned up.");
  }
}

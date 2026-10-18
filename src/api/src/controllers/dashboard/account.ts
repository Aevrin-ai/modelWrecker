import type { AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { NamePatch } from "../../validators/schemas";
import { str } from "../../lib/strings";
import { userScope } from "./context";
import { profilesRepository } from "../../repositories/profiles";

// "Ada Lovelace" -> "AL", "ada@example.com" -> "AE"
function initialsOf(name: string): string {
  const words = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0].toUpperCase()).join("") || "?";
}

export async function readAccount(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const user = c.get("user");
  const profiles = profilesRepository(db);
  const profile = (await profiles.findById(owner)) ?? (await profiles.insert({ id: owner, email: user.email, display_name: user.name ?? user.email }));
  const name = str(profile.display_name) || str(user.email);
  return c.json({
    id: owner,
    name,
    email: str(profile.email ?? user.email),
    role: "owner",
    organization: "Personal workspace",
    avatarInitials: initialsOf(name),
    createdAt: str(profile.created_at),
    signInProvider: "google",
  });
}

export async function renameAccount(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const body = await parseBody(c, NamePatch);
  await profilesRepository(db).rename(owner, body.name);
  return c.json({ ok: true, name: body.name });
}

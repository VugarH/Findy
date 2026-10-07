/**
 * Who may open the admin panel (/az/admin). The first admin has to be made
 * here; after that, admins can give access to others on the panel's Users page.
 *
 *   npm run admin -- grant you@example.com     the account must exist (sign up on the site first)
 *   npm run admin -- revoke you@example.com
 *   npm run admin -- list
 */
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db/client";
import { users } from "@/db/schema";
import { setUserRoleByEmail } from "@/modules/admin/users";

const USAGE = "usage: npm run admin -- grant <email> | revoke <email> | list";

async function main() {
  const [command, email] = process.argv.slice(2);

  if (command === "list") {
    const admins = await db
      .select({ email: users.email, name: users.fullName })
      .from(users)
      .where(eq(users.role, "admin"));
    console.log(admins.length ? admins.map((a) => `  ${a.email}  ${a.name}`).join("\n") : "No admins yet.");
    return;
  }
  if ((command !== "grant" && command !== "revoke") || !email) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const done = await setUserRoleByEmail(email, command === "grant" ? "admin" : "user");
  if (!done) {
    console.error(`No account with the email ${email}. Sign up on the site first.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    command === "grant" ? `${email} can now open the admin panel at /az/admin.` : `${email} is no longer an admin.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);

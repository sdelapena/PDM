// Initial data: real companies and users, plus the Vaqueras and Dante styles from the monday.com board
// "Justin – Implementation". Mockup-only data (Cobán, sample dates, placeholder T1/T2 users) is not loaded.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { STEP_BY_NO, type Step } from "../lib/catalog";
import { addHistory, createStyle } from "../lib/styles";
import monday from "./monday.json";

const db = new PrismaClient();

function pick(map: Record<string, string>, code: string, step: Step): string {
  return map[code] ?? step.statuses[0];
}

function mapStatus(step: Step, code: string): string {
  if (code === "N") return "NA";
  const has = (f: string) => (step.fields as string[]).includes(f);
  if (has("leather") || has("material")) return pick({ P: "REQUESTED", R: "REJECTED", A: "RECEIVED" }, code, step);
  if (has("price")) return pick({ P: "CALCULATING", W: "SENT", A: "APPROVED" }, code, step);
  if (step.statuses.includes("DELIVERED")) return pick({ A: "DELIVERED", P: "PENDING", W: "IN_PROGRESS" }, code, step);
  if (step.statuses.includes("IN_PROCESS")) return pick({ P: "REQUESTED", W: "IN_PROCESS", T: "SENT", A: "APPROVED" }, code, step);
  return pick({ P: "PENDING", W: "IN_PROGRESS", A: "APPROVED" }, code, step);
}

async function company(name: string, kind: "T1" | "T2") {
  return db.company.upsert({ where: { kind_name: { kind, name } }, create: { name, kind }, update: {} });
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "";
  if (!adminEmail || adminPassword.length < 8) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ characters) before seeding.");

  const factories = { Vaqueras: await company("Vaqueras", "T1"), Dante: await company("Dante", "T1") };
  await company("Lefarc", "T2");
  await company("Proveeduría Mundial", "T2");

  const admin =
    (await db.user.findFirst({ where: { type: "ADMIN" } })) ??
    (await db.user.create({ data: { name: "Sebastián", email: adminEmail, type: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) } }));

  // Justin users start with a placeholder address; the Admin sets the real one in User Management,
  // which emails them a link to choose their password.
  const lineBuilders: Record<string, string> = {};
  for (const name of ["Paul", "Gerardo", "Edna", "Bubba"]) {
    const email = `${name.toLowerCase()}@placeholder.invalid`;
    const u = (await db.user.findFirst({ where: { name, type: "JUSTIN" } })) ?? (await db.user.create({ data: { name, email, type: "JUSTIN", isLineBuilder: true } }));
    lineBuilders[name] = u.id;
  }

  let created = 0;
  for (const m of monday) {
    if (await db.style.findUnique({ where: { pdNumber: m.pdNumber } })) continue;
    await db.$transaction(async (tx) => {
      const styleId = await createStyle(tx, {
        pdNumber: m.pdNumber,
        collection: m.collection,
        lineBuilderId: m.lineBuilder ? lineBuilders[m.lineBuilder] : null,
        t1CompanyId: factories[m.factory as "Vaqueras" | "Dante"].id,
        t2: [null, null],
        firstPoDate: new Date(m.firstPoDate + "T00:00:00Z"),
        photo: null,
        createdById: admin.id,
      });
      for (const [no, code] of Object.entries(m.steps as Record<string, string>)) {
        const step = STEP_BY_NO[+no];
        await tx.subitem.update({ where: { styleId_stepNo_round: { styleId, stepNo: step.no, round: 1 } }, data: { status: mapStatus(step, code) } });
      }
      // The monday.com price column is kept as the Final Price value.
      await tx.subitem.update({ where: { styleId_stepNo_round: { styleId, stepNo: 16, round: 1 } }, data: { price: m.price } });
      await addHistory(tx, styleId, admin.id, "Imported from monday.com board “Justin – Implementation”", { field: "created" });
      const notes = [`Price $${Number(m.price).toFixed(2)}`, `PO status: ${m.po}`, ...m.notes.map((n) => `${STEP_BY_NO[n.stepNo].name}: ${n.text}`)];
      await tx.discussionMessage.create({ data: { styleId, authorId: admin.id, text: `Imported from monday.com.\n${notes.join("\n")}` } });
    }, { timeout: 30000 });
    created++;
  }
  console.log(`Seed complete: ${created} styles imported.`);
}

main().finally(() => db.$disconnect());

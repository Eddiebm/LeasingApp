#!/usr/bin/env node
/**
 * Run migrations 001 and 002 against your Supabase Postgres database.
 * Requires: DATABASE_URL in .env.local (Supabase → Settings → Database → Connection string → URI)
 * Run from repo root: node database/run-migrations.js
 */

const fs = require("fs");
const path = require("path");

async function main() {
  const pathToEnv = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(pathToEnv)) {
    console.error("Missing .env.local. Add DATABASE_URL (Supabase → Settings → Database → Connection string → URI).");
    process.exit(1);
  }
  const envContent = fs.readFileSync(pathToEnv, "utf8");
  const match = envContent.match(/DATABASE_URL=(.+)/m);
  const databaseUrl = match ? match[1].trim().replace(/^["']|["']$/g, "") : process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Add DATABASE_URL to .env.local (Supabase → Settings → Database → Connection string → URI).");
    process.exit(1);
  }

  let pg;
  try {
    pg = require("pg");
  } catch {
    console.error("Install pg: npm install --save-dev pg");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const migrations = ["001_maintenance_and_audit.sql", "002_payments_lease_esign.sql"];
    for (const name of migrations) {
      const filePath = path.join(__dirname, "migrations", name);
      if (!fs.existsSync(filePath)) {
        console.error("Missing:", filePath);
        process.exit(1);
      }
      const sql = fs.readFileSync(filePath, "utf8");
      console.log("Running", name, "...");
      await client.query(sql);
      console.log("OK", name);
    }
    console.log("Migrations done.");
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

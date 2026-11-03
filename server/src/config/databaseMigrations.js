const fs = require("fs");
const path = require("path");
const pool = require("./database");

const runDatabaseMigrations = async () => {
  const migrationPaths = [
    "20261101_booking_sessions.sql",
    "20261102_provider_verification.sql",
    "20261103_targeted_service_requests.sql",
  ].map((filename) =>
    path.resolve(__dirname, "../../database/migrations", filename),
  );

  for (const migrationPath of migrationPaths) {
    const migration = fs.readFileSync(migrationPath, "utf8");
    await pool.query(migration);
  }
  console.log("Database migrations applied");
};

module.exports = { runDatabaseMigrations };

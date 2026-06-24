const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  try {
    await client.connect();
    console.log("Connected to local Supabase Postgres.");
    
    // Check constraints on shops table
    const res = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.shops'::regclass AND contype = 'u';
    `);
    
    console.log("Unique constraints on shops:", res.rows);

    for (const row of res.rows) {
      if (row.conname.includes('owner_id')) {
        console.log("Dropping constraint:", row.conname);
        await client.query(`ALTER TABLE public.shops DROP CONSTRAINT "${row.conname}"`);
        console.log("Constraint dropped.");
      }
    }
    
    console.log("Done.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();

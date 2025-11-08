use sqlx::{Pool, Postgres, Row};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://postgres:55258864@localhost:5432/kmarket_db".to_string()
    });

    println!("[DB] Connecting to {}", db_url);
    let pool: Pool<Postgres> = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Users CRUD
    println!("\n[Users] Create");
    let wallet = "0xdecaf0000000000000000000000000000000000";
    let _ = sqlx::query("INSERT INTO users (wallet_address, display_name, role) VALUES ($1, $2, 'user') ON CONFLICT (wallet_address) DO NOTHING")
        .bind(wallet)
        .bind("Alice")
        .execute(&pool)
        .await?;

    println!("[Users] Read");
    let user_row = sqlx::query("SELECT id, wallet_address, display_name, role FROM users WHERE wallet_address=$1")
        .bind(wallet)
        .fetch_one(&pool)
        .await?;
    let uid: i32 = user_row.get("id");
    println!("  -> id={}, wallet={}, name={}, role={}",
        uid,
        user_row.get::<String,_>("wallet_address"),
        user_row.get::<Option<String>,_>("display_name").unwrap_or_default(),
        user_row.get::<String,_>("role")
    );

    println!("[Users] Update");
    let updated = sqlx::query("UPDATE users SET display_name=$1, last_login=NOW() WHERE wallet_address=$2 RETURNING id, display_name")
        .bind("Alice 2")
        .bind(wallet)
        .fetch_one(&pool)
        .await?;
    println!("  -> id={}, name={}", updated.get::<i32,_>("id"), updated.get::<String,_>("display_name"));

    // Markets & Options
    println!("\n[Markets] Create admin and market");
    let admin_wallet = "0xfeed000000000000000000000000000000000000";
    let _ = sqlx::query("INSERT INTO users (wallet_address, display_name, role) VALUES ($1, 'Admin', 'admin') ON CONFLICT (wallet_address) DO NOTHING")
        .bind(admin_wallet)
        .execute(&pool)
        .await?;
    let admin_id_row = sqlx::query("SELECT id FROM users WHERE wallet_address=$1")
        .bind(admin_wallet)
        .fetch_one(&pool)
        .await?;
    let admin_id: i32 = admin_id_row.get("id");

    let market_id: i64 = 1001;
    let market_row = sqlx::query("INSERT INTO markets (market_id, title, category, status, admin_user_id) VALUES ($1, $2, 'sports', 'active', $3) ON CONFLICT (market_id) DO UPDATE SET title=EXCLUDED.title RETURNING id, market_id, title, status::text AS status_text")
        .bind(market_id)
        .bind("Game A")
        .bind(admin_id)
        .fetch_one(&pool)
        .await?;
    println!("  -> id={}, market_id={}, title={}, status={}",
        market_row.get::<i32,_>("id"),
        market_row.get::<i64,_>("market_id"),
        market_row.get::<String,_>("title"),
        market_row.get::<String,_>("status_text")
    );

    println!("[Options] Create option");
    let opt_row = sqlx::query("INSERT INTO market_options (market_id, code, label, initial_odds) VALUES ($1, $2, $3, $4) ON CONFLICT (market_id, code) DO UPDATE SET label=EXCLUDED.label RETURNING id, market_id, code, label")
        .bind(market_id)
        .bind(1_i16)
        .bind("HOME")
        .bind(185_i32)
        .fetch_one(&pool)
        .await?;
    println!("  -> id={}, market_id={}, code={}, label={}",
        opt_row.get::<i32,_>("id"),
        opt_row.get::<i64,_>("market_id"),
        opt_row.get::<i16,_>("code"),
        opt_row.get::<String,_>("label")
    );

    // Orders
    println!("\n[Orders] Create order with big numeric");
    let amount = "1000000000000000000"; // 1e18
    let payout = "2100000000000000000";
    let order_id: i64 = 900001;
    let order_row = sqlx::query(
        "INSERT INTO orders (order_id, user_address, market_id, amount, odds, option, potential_payout, tx_hash)
         VALUES ($1, $2, $3, CAST($4 AS NUMERIC(78,0)), $5, $6, CAST($7 AS NUMERIC(78,0)), $8)
         ON CONFLICT (order_id) DO UPDATE SET tx_hash=EXCLUDED.tx_hash
         RETURNING id, order_id, amount::text AS amount_text, potential_payout::text AS payout_text, settled, claimed"
    )
        .bind(order_id)
        .bind(wallet)
        .bind(market_id)
        .bind(amount)
        .bind(210_i32)
        .bind(1_i16)
        .bind(payout)
        .bind("0xhash900001")
        .fetch_one(&pool)
        .await?;
    println!("  -> id={}, order_id={}, amount={}, payout={}, settled={}, claimed={}",
        order_row.get::<i32,_>("id"),
        order_row.get::<i64,_>("order_id"),
        order_row.get::<String,_>("amount_text"),
        order_row.get::<String,_>("payout_text"),
        order_row.get::<bool,_>("settled"),
        order_row.get::<bool,_>("claimed")
    );

    println!("[Orders] Update claimed=true");
    let claimed_row = sqlx::query("UPDATE orders SET claimed=true WHERE order_id=$1 RETURNING order_id, claimed")
        .bind(order_id)
        .fetch_one(&pool)
        .await?;
    println!("  -> order_id={}, claimed={}", claimed_row.get::<i64,_>("order_id"), claimed_row.get::<bool,_>("claimed"));

    println!("\n[Constraints] Duplicate option should fail");
    let dup = sqlx::query("INSERT INTO market_options (market_id, code, label) VALUES ($1, $2, 'DUP')")
        .bind(market_id)
        .bind(1_i16)
        .execute(&pool)
        .await;
    match dup {
        Ok(_) => println!("  !! Unexpected success on duplicate option"),
        Err(e) => println!("  -> Expected error: {}", e),
    }

    println!("\n[Indexes] List main indexes");
    let idx_rows = sqlx::query(
        "SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' AND tablename IN
         ('users','markets','market_options','orders','order_claims','chain_events','admin_actions') ORDER BY tablename, indexname;"
    )
        .fetch_all(&pool)
        .await?;
    for r in idx_rows { println!("  -> {} on {}", r.get::<String,_>("indexname"), r.get::<String,_>("tablename")); }

    // Cleanup a few rows (not strictly necessary)
    println!("\n[Cleanup] Delete order and market option");
    let _ = sqlx::query("DELETE FROM orders WHERE order_id=$1")
        .bind(order_id)
        .execute(&pool)
        .await?;
    let _ = sqlx::query("DELETE FROM market_options WHERE market_id=$1 AND code=$2")
        .bind(market_id)
        .bind(1_i16)
        .execute(&pool)
        .await?;

    println!("\n[Done] CRUD and constraints verified.");
    Ok(())
}
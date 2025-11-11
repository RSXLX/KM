use actix_web::{App, HttpServer, web, middleware};
use actix_files::Files;
use actix_cors::Cors;
use tracing_subscriber;

mod state;
mod routes;
mod repository;
mod models;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into())
        )
        .init();

    let app_state = state::AppState::new()
        .await
        .expect("Failed to initialize AppState");

    let server_addr = std::env::var("SERVER_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    tracing::info!("Server listening on http://{}", server_addr);

    // 壁纸静态目录：可通过环境变量 WALLPAPER_DIR 覆盖；默认指向前端仓库中的资源目录
    // 注意：默认目录名按现有路径拼写为 "wallpapaer"
    let wallpaper_dir = std::env::var("WALLPAPER_DIR")
        .unwrap_or_else(|_| "../fronted/lib/wallpapaer".to_string());

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            // 静态壁纸服务：直接映射文件系统目录到 /api/wallpaper
            .service(
                Files::new("/api/wallpaper", wallpaper_dir.clone())
                    .prefer_utf8(true)
                    .use_last_modified(true)
            )
            .service(
                web::scope("/api/v1")
                    .route("/markets", web::get().to(routes::markets::get_markets))
                    .route("/markets", web::post().to(routes::markets::create_market))
                    .route("/markets/{id}", web::get().to(routes::markets::get_market_detail))
                    .route("/markets/{id}", web::delete().to(routes::markets::delete_market))
                    .route("/markets/{id}", web::put().to(routes::markets::update_market_status))
                    .route("/markets/{id}/stats", web::get().to(routes::markets::get_market_stats))
                    .route("/orders", web::post().to(routes::orders::create_order))
                    .route("/orders/{id}", web::get().to(routes::orders::get_order))
                    .route("/orders/{id}", web::put().to(routes::orders::update_order_status))
                    .route("/orders/{id}", web::delete().to(routes::orders::delete_order))
                    .route("/users/{address}/orders", web::get().to(routes::orders::get_user_orders))
                    .route("/users/{address}/stats", web::get().to(routes::orders::get_user_stats))
                    .route("/users", web::post().to(routes::users::create_user))
                    .route("/users/{id}", web::get().to(routes::users::get_user))
                    .route("/users/{id}", web::put().to(routes::users::update_user_email))
                    .route("/users/{id}", web::delete().to(routes::users::delete_user))
                    .route("/sports/fixtures", web::get().to(routes::sports::get_fixtures))
                    .route("/admin/auth/login", web::post().to(routes::admin_auth::login))
                    // Admin markets
                    .route("/admin/markets", web::get().to(routes::admin_markets::list_markets))
                    .route("/admin/markets", web::post().to(routes::admin_markets::create_market))
                    .route("/admin/markets/{id}", web::put().to(routes::admin_markets::update_market))
                    .route("/admin/markets/{id}/deactivate", web::post().to(routes::admin_markets::deactivate_market))
                    .route("/admin/markets/{id}/settle", web::post().to(routes::admin_markets::settle_market))
                    // Admin orders
                    .route("/admin/orders", web::get().to(routes::admin_orders::list_orders))
                    .route("/admin/orders/{id}", web::get().to(routes::admin_orders::get_order_detail))
                    .route("/admin/orders/{id}/cancel", web::post().to(routes::admin_orders::cancel_order))
                    .route("/admin/orders/{id}/settle", web::post().to(routes::admin_orders::settle_order))
                    // Admin users
                    .route("/admin/users", web::get().to(routes::admin_users::list_users))
                    .route("/admin/users/{id}", web::get().to(routes::admin_users::get_user_detail))
                    .route("/admin/users/{id}/status", web::put().to(routes::admin_users::update_user_status))
                    .route("/admin/users/{id}/blacklist", web::post().to(routes::admin_users::set_blacklist))
                    .route("/admin/users/{id}/whitelist", web::post().to(routes::admin_users::set_whitelist))
                    .route("/admin/users/{id}/stats", web::get().to(routes::admin_users::get_user_stats))
                    // Admin carousel
                    .route("/admin/carousel", web::get().to(routes::admin_carousel::list_items))
                    .route("/admin/carousel", web::post().to(routes::admin_carousel::create_item))
                    .route("/admin/carousel/{id}", web::put().to(routes::admin_carousel::update_item))
                    .route("/admin/carousel/{id}", web::delete().to(routes::admin_carousel::delete_item))
                    // 兼容输出：前端 database.ts 对齐结构
                    .service(
                        web::scope("/compat")
                            .route("/markets", web::get().to(routes::compat::get_frontend_markets))
                            .route("/users/{address}/positions", web::get().to(routes::compat::get_frontend_positions))
                            .route("/positions", web::post().to(routes::compat::create_frontend_position))
                            .route("/positions/close", web::post().to(routes::compat::close_frontend_position))
                    )
            )
            .route("/health", web::get().to(routes::health::health_check))
    })
    .bind(&server_addr)?
    .run()
    .await
}
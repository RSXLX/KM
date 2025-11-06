# syntax=docker/dockerfile:1

FROM rust:1.81 AS builder
WORKDIR /app
COPY . .
# cache deps
RUN cargo build --release && rm -rf target/release/deps/kmarket_backend*
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/kmarket-backend /usr/local/bin/kmarket-backend
ENV RUST_LOG=info
EXPOSE 8080
CMD ["/usr/local/bin/kmarket-backend"]
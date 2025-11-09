use thiserror::Error;

#[derive(Debug, Error)]
pub enum DataAccessError {
    #[error("invalid argument: {0}")]
    InvalidArgument(String),
    #[error("duplicate key: {0}")]
    DuplicateKey(String),
    #[error("referential integrity violation: {0}")]
    ReferentialIntegrity(String),
    #[error("constraint violation: {0}")]
    ConstraintViolation(String),
    #[error("not null violation: {0}")]
    NotNullViolation(String),
    #[error("concurrency conflict on {0}")]
    ConcurrencyConflict(String),
    #[error("database error: {0}")]
    Database(String),
}

pub fn translate_sqlx_error(e: sqlx::Error) -> DataAccessError {
    match e {
        sqlx::Error::Database(db_err) => {
            // Map common PostgreSQL SQLSTATE codes
            match db_err.code().as_deref() {
                Some("23505") => DataAccessError::DuplicateKey(db_err.message().to_string()),
                Some("23503") => DataAccessError::ReferentialIntegrity(db_err.message().to_string()),
                Some("23514") => DataAccessError::ConstraintViolation(db_err.message().to_string()),
                Some("23502") => DataAccessError::NotNullViolation(db_err.message().to_string()),
                Some("40001") => DataAccessError::ConcurrencyConflict(db_err.message().to_string()),
                _ => DataAccessError::Database(db_err.message().to_string()),
            }
        }
        other => DataAccessError::Database(other.to_string()),
    }
}
import logging
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.engine import Engine
from backend.app.config import settings

logger = logging.getLogger("chroniccare.database")
logging.basicConfig(level=logging.INFO)

DATABASE_URL = settings.DATABASE_URL
engine = None

# Attempt primary database connection (e.g. PostgreSQL or configured DB)
try:
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False}
        )
    else:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=300
        )
        # Test connection immediately
        with engine.connect() as conn:
            pass
        logger.info(f"Connected to primary database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
except Exception as e:
    logger.warning(f"Primary database connection failed ({e}). Falling back to SQLite WAL mode.")
    DATABASE_URL = settings.FALLBACK_SQLITE_URL
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

# Configure SQLite pragmas for WAL mode and foreign key enforcement
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in str(engine.url):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
        except Exception as e:
            logger.debug(f"SQLite PRAGMA error: {e}")
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Import all models to ensure metadata is registered
    import backend.app.models # noqa
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified and initialized successfully.")

    # Automatically seed verified doctors and baseline dataset if database is newly initialized
    db = SessionLocal()
    try:
        from backend.app.models import DoctorProfile
        if db.query(DoctorProfile).count() == 0:
            logger.info("Database empty: Auto-seeding certified clinical doctors directory...")
            from backend.seed_data import seed_clinical_database
            seed_clinical_database()
    except Exception as e:
        logger.debug(f"Auto-seed check note: {e}")
    finally:
        db.close()


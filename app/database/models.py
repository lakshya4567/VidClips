"""
app/database/models.py

SQLite-backed job tracking (via SQLAlchemy). Keeps a durable record of
every analysis run so the API can answer "what's the status of job X"
and the outputs directory can be correlated back to a request, even
after a server restart.
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, Column, DateTime, Float, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config.settings import settings


class Base(DeclarativeBase):
    pass


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    run_id = Column(String, primary_key=True)
    video_path = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending|running|completed|failed
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_sec = Column(Float, nullable=True)
    output_files = Column(JSON, nullable=True)
    error = Column(String, nullable=True)


engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, Enum):
    admin = "admin"
    user = "user"


class DirectionMode(str, Enum):
    auto = "auto"
    forward = "forward"
    backward = "backward"
    clockwise = "clockwise"
    anticlockwise = "anticlockwise"
    manual = "manual"


class TransferType(str, Enum):
    same_station = "same_station"
    paid_link = "paid_link"
    out_of_station = "out_of_station"
    virtual = "virtual"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.user)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class PhysicalStation(Base):
    __tablename__ = "physical_stations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name_en: Mapped[str] = mapped_column(String(128), unique=True)
    name_zh: Mapped[Optional[str]] = mapped_column(String(128))
    name_ms: Mapped[Optional[str]] = mapped_column(String(128))
    name_ta: Mapped[Optional[str]] = mapped_column(String(128))
    lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    lng: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)


class Line(Base):
    __tablename__ = "lines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String(128))
    name_zh: Mapped[Optional[str]] = mapped_column(String(128))
    name_ms: Mapped[Optional[str]] = mapped_column(String(128))
    name_ta: Mapped[Optional[str]] = mapped_column(String(128))
    color: Mapped[str] = mapped_column(String(7), default="#64748b")
    is_loop: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    stations: Mapped[List["LineStation"]] = relationship(back_populates="line")


class LineStation(Base):
    __tablename__ = "line_stations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    line_id: Mapped[int] = mapped_column(ForeignKey("lines.id"))
    physical_station_id: Mapped[int] = mapped_column(ForeignKey("physical_stations.id"))
    station_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    display_name_en: Mapped[str] = mapped_column(String(128))
    display_name_zh: Mapped[Optional[str]] = mapped_column(String(128))
    display_name_ms: Mapped[Optional[str]] = mapped_column(String(128))
    display_name_ta: Mapped[Optional[str]] = mapped_column(String(128))
    branch_code: Mapped[str] = mapped_column(String(32), default="main")
    sequence_index: Mapped[int] = mapped_column(Integer)
    diagram_x: Mapped[Optional[float]] = mapped_column(Numeric(10, 3))
    diagram_y: Mapped[Optional[float]] = mapped_column(Numeric(10, 3))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    line: Mapped[Line] = relationship(back_populates="stations")
    physical_station: Mapped[PhysicalStation] = relationship()


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    line_id: Mapped[int] = mapped_column(ForeignKey("lines.id"))
    from_line_station_id: Mapped[int] = mapped_column(ForeignKey("line_stations.id"))
    to_line_station_id: Mapped[int] = mapped_column(ForeignKey("line_stations.id"))
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric(8, 3))
    direction_hint: Mapped[Optional[str]] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_counted: Mapped[bool] = mapped_column(Boolean, default=True)
    geometry_json: Mapped[Optional[dict]] = mapped_column(JSON)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    line: Mapped[Line] = relationship()
    from_station: Mapped[LineStation] = relationship(foreign_keys=[from_line_station_id])
    to_station: Mapped[LineStation] = relationship(foreign_keys=[to_line_station_id])


class StationTransfer(Base):
    __tablename__ = "station_transfers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    from_line_station_id: Mapped[int] = mapped_column(ForeignKey("line_stations.id"))
    to_line_station_id: Mapped[int] = mapped_column(ForeignKey("line_stations.id"))
    transfer_type: Mapped[TransferType] = mapped_column(SAEnum(TransferType), default=TransferType.same_station)
    walk_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)


class RideRecord(Base):
    __tablename__ = "ride_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    ride_date: Mapped[date] = mapped_column(Date)
    title: Mapped[Optional[str]] = mapped_column(String(160))
    comment: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    legs: Mapped[List["RideLeg"]] = relationship(back_populates="record", cascade="all, delete-orphan")


class RideLeg(Base):
    __tablename__ = "ride_legs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ride_record_id: Mapped[int] = mapped_column(ForeignKey("ride_records.id"))
    line_id: Mapped[int] = mapped_column(ForeignKey("lines.id"))
    from_line_station_id: Mapped[int] = mapped_column(ForeignKey("line_stations.id"))
    to_line_station_id: Mapped[int] = mapped_column(ForeignKey("line_stations.id"))
    sequence_index: Mapped[int] = mapped_column(Integer)
    direction_mode: Mapped[DirectionMode] = mapped_column(SAEnum(DirectionMode), default=DirectionMode.auto)
    comment: Mapped[Optional[str]] = mapped_column(Text)

    record: Mapped[RideRecord] = relationship(back_populates="legs")
    segments: Mapped[List["RideLegSegment"]] = relationship(back_populates="leg", cascade="all, delete-orphan")


class RideLegSegment(Base):
    __tablename__ = "ride_leg_segments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ride_leg_id: Mapped[int] = mapped_column(ForeignKey("ride_legs.id"))
    segment_id: Mapped[int] = mapped_column(ForeignKey("segments.id"))
    sequence_index: Mapped[int] = mapped_column(Integer)

    leg: Mapped[RideLeg] = relationship(back_populates="segments")
    segment: Mapped[Segment] = relationship()


class DisplayPreference(Base):
    __tablename__ = "display_preferences"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    preference_key: Mapped[str] = mapped_column(String(64))
    value_json: Mapped[dict] = mapped_column(JSON)

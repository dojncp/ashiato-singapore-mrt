from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import DirectionMode, UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class BootstrapAdminRequest(BaseModel):
    token: str
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=8)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = UserRole.user


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool


class PhysicalStationCreate(BaseModel):
    name_en: str
    name_zh: Optional[str] = None
    name_ms: Optional[str] = None
    name_ta: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None


class PhysicalStationRead(PhysicalStationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class LineCreate(BaseModel):
    code: str
    name_en: str
    name_zh: Optional[str] = None
    name_ms: Optional[str] = None
    name_ta: Optional[str] = None
    color: str = "#64748b"
    is_loop: bool = False
    display_order: int = 0


class LineRead(LineCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class LineStationCreate(BaseModel):
    line_id: int
    physical_station_id: int
    station_code: str
    display_name_en: str
    display_name_zh: Optional[str] = None
    display_name_ms: Optional[str] = None
    display_name_ta: Optional[str] = None
    branch_code: str = "main"
    sequence_index: int
    diagram_x: Optional[float] = None
    diagram_y: Optional[float] = None


class LineStationRead(LineStationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class SegmentCreate(BaseModel):
    line_id: int
    from_line_station_id: int
    to_line_station_id: int
    distance_km: Optional[float] = None
    direction_hint: Optional[str] = None
    is_counted: bool = True
    geometry_json: Optional[Dict[str, Any]] = None
    display_order: int = 0


class SegmentRead(SegmentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class RideLegCreate(BaseModel):
    line_id: int
    from_line_station_id: int
    to_line_station_id: int
    direction_mode: DirectionMode = DirectionMode.auto
    comment: Optional[str] = None


class RideRecordCreate(BaseModel):
    ride_date: date
    title: Optional[str] = None
    comment: Optional[str] = None
    legs: List[RideLegCreate] = Field(min_length=1)


class RideRecordRead(BaseModel):
    id: int
    ride_date: date
    title: Optional[str]
    comment: Optional[str]
    segment_count: int


class DisplayPreferenceIn(BaseModel):
    preference_key: Literal["network_style"] = "network_style"
    value_json: Dict[str, Any]


class DisplayPreferenceRead(DisplayPreferenceIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]

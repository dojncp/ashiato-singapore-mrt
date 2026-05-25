from __future__ import annotations

from typing import Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import (
    DisplayPreference,
    Line,
    LineStation,
    PhysicalStation,
    RideLeg,
    RideLegSegment,
    RideRecord,
    Segment,
    User,
    UserRole,
)
from app.schemas import (
    BootstrapAdminRequest,
    DisplayPreferenceIn,
    DisplayPreferenceRead,
    LineCreate,
    LineRead,
    LineStationCreate,
    LineStationRead,
    LoginRequest,
    PhysicalStationCreate,
    PhysicalStationRead,
    RideRecordCreate,
    RideRecordRead,
    SegmentCreate,
    SegmentRead,
    TokenResponse,
    UserCreate,
    UserRead,
)
from app.security import create_access_token, hash_password, verify_password
from app.services.routing import resolve_leg_segments


router = APIRouter(prefix="/api")


def update_model(instance, payload):
    for key, value in payload.model_dump().items():
        setattr(instance, key, value)
    return instance


@router.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@router.post("/auth/bootstrap-admin", response_model=TokenResponse)
def bootstrap_admin(payload: BootstrapAdminRequest, db: Session = Depends(get_db)) -> TokenResponse:
    settings = get_settings()
    if payload.token != settings.bootstrap_admin_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid bootstrap token")
    admin_count = db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.admin))
    if admin_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admin already exists")
    user = User(
        username=payload.username,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        role=UserRole.admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(str(user.id), user.role.value), role=user.role)


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    return TokenResponse(access_token=create_access_token(str(user.id), user.role.value), role=user.role)


@router.post("/users", response_model=UserRead, dependencies=[Depends(require_admin)])
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    user = User(
        username=payload.username,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/physical-stations", response_model=PhysicalStationRead, dependencies=[Depends(require_admin)])
def create_physical_station(payload: PhysicalStationCreate, db: Session = Depends(get_db)) -> PhysicalStation:
    station = PhysicalStation(**payload.model_dump())
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


@router.get("/physical-stations", response_model=List[PhysicalStationRead])
def list_physical_stations(db: Session = Depends(get_db)) -> List[PhysicalStation]:
    return list(db.scalars(select(PhysicalStation).order_by(PhysicalStation.name_en)))


@router.put("/physical-stations/{station_id}", response_model=PhysicalStationRead, dependencies=[Depends(require_admin)])
def update_physical_station(station_id: int, payload: PhysicalStationCreate, db: Session = Depends(get_db)) -> PhysicalStation:
    station = db.get(PhysicalStation, station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical station not found")
    update_model(station, payload)
    db.commit()
    db.refresh(station)
    return station


@router.post("/lines", response_model=LineRead, dependencies=[Depends(require_admin)])
def create_line(payload: LineCreate, db: Session = Depends(get_db)) -> Line:
    line = Line(**payload.model_dump())
    db.add(line)
    db.commit()
    db.refresh(line)
    return line


@router.get("/lines", response_model=List[LineRead])
def list_lines(db: Session = Depends(get_db)) -> List[Line]:
    return list(db.scalars(select(Line).order_by(Line.display_order, Line.code)))


@router.put("/lines/{line_id}", response_model=LineRead, dependencies=[Depends(require_admin)])
def update_line(line_id: int, payload: LineCreate, db: Session = Depends(get_db)) -> Line:
    line = db.get(Line, line_id)
    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Line not found")
    update_model(line, payload)
    db.commit()
    db.refresh(line)
    return line


@router.post("/line-stations", response_model=LineStationRead, dependencies=[Depends(require_admin)])
def create_line_station(payload: LineStationCreate, db: Session = Depends(get_db)) -> LineStation:
    line_station = LineStation(**payload.model_dump())
    db.add(line_station)
    db.commit()
    db.refresh(line_station)
    return line_station


@router.get("/line-stations", response_model=List[LineStationRead])
def list_line_stations(line_id: Optional[int] = None, db: Session = Depends(get_db)) -> List[LineStation]:
    query = select(LineStation).order_by(LineStation.line_id, LineStation.branch_code, LineStation.sequence_index)
    if line_id is not None:
        query = query.where(LineStation.line_id == line_id)
    return list(db.scalars(query))


@router.put("/line-stations/{line_station_id}", response_model=LineStationRead, dependencies=[Depends(require_admin)])
def update_line_station(line_station_id: int, payload: LineStationCreate, db: Session = Depends(get_db)) -> LineStation:
    line_station = db.get(LineStation, line_station_id)
    if not line_station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Line station not found")
    update_model(line_station, payload)
    db.commit()
    db.refresh(line_station)
    return line_station


@router.post("/segments", response_model=SegmentRead, dependencies=[Depends(require_admin)])
def create_segment(payload: SegmentCreate, db: Session = Depends(get_db)) -> Segment:
    segment = Segment(**payload.model_dump())
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


@router.get("/segments", response_model=List[SegmentRead])
def list_segments(line_id: Optional[int] = None, db: Session = Depends(get_db)) -> List[Segment]:
    query = select(Segment).order_by(Segment.line_id, Segment.display_order, Segment.id)
    if line_id is not None:
        query = query.where(Segment.line_id == line_id)
    return list(db.scalars(query))


@router.put("/segments/{segment_id}", response_model=SegmentRead, dependencies=[Depends(require_admin)])
def update_segment(segment_id: int, payload: SegmentCreate, db: Session = Depends(get_db)) -> Segment:
    segment = db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")
    update_model(segment, payload)
    db.commit()
    db.refresh(segment)
    return segment


@router.delete("/segments/{segment_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, dependencies=[Depends(require_admin)])
def delete_segment(segment_id: int, db: Session = Depends(get_db)) -> Response:
    segment = db.get(Segment, segment_id)
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")
    ride_usage_count = db.scalar(select(func.count()).select_from(RideLegSegment).where(RideLegSegment.segment_id == segment_id)) or 0
    if ride_usage_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Segment is used by ride records and cannot be deleted")
    db.delete(segment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/rides", response_model=RideRecordRead)
def create_ride(
    payload: RideRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RideRecordRead:
    record = RideRecord(
        user_id=current_user.id,
        ride_date=payload.ride_date,
        title=payload.title,
        comment=payload.comment,
    )
    db.add(record)
    db.flush()

    segment_count = 0
    for leg_index, leg_payload in enumerate(payload.legs, start=1):
        leg = RideLeg(
            ride_record_id=record.id,
            line_id=leg_payload.line_id,
            from_line_station_id=leg_payload.from_line_station_id,
            to_line_station_id=leg_payload.to_line_station_id,
            sequence_index=leg_index,
            direction_mode=leg_payload.direction_mode,
            comment=leg_payload.comment,
        )
        db.add(leg)
        db.flush()
        segments = resolve_leg_segments(
            db,
            leg_payload.line_id,
            leg_payload.from_line_station_id,
            leg_payload.to_line_station_id,
            leg_payload.direction_mode,
        )
        for segment_index, segment in enumerate(segments, start=1):
            db.add(RideLegSegment(ride_leg_id=leg.id, segment_id=segment.id, sequence_index=segment_index))
        segment_count += len(segments)

    db.commit()
    return RideRecordRead(
        id=record.id,
        ride_date=record.ride_date,
        title=record.title,
        comment=record.comment,
        segment_count=segment_count,
    )


@router.get("/rides", response_model=List[RideRecordRead])
def list_rides(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> List[RideRecordRead]:
    records = db.scalars(
        select(RideRecord).where(RideRecord.user_id == current_user.id).order_by(RideRecord.ride_date.desc(), RideRecord.id.desc())
    )
    result = []
    for record in records:
        count = db.scalar(
            select(func.count())
            .select_from(RideLegSegment)
            .join(RideLeg)
            .where(RideLeg.ride_record_id == record.id)
        )
        result.append(RideRecordRead(id=record.id, ride_date=record.ride_date, title=record.title, comment=record.comment, segment_count=count or 0))
    return result


@router.get("/stats/overview")
def stats_overview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    total = db.scalar(select(func.count()).select_from(Segment).where(Segment.is_active.is_(True), Segment.is_counted.is_(True))) or 0
    ridden = (
        db.scalar(
            select(func.count(func.distinct(RideLegSegment.segment_id)))
            .select_from(RideLegSegment)
            .join(RideLeg)
            .join(RideRecord)
            .join(Segment, Segment.id == RideLegSegment.segment_id)
            .where(RideRecord.user_id == current_user.id, Segment.is_active.is_(True), Segment.is_counted.is_(True))
        )
        or 0
    )
    return {"total_segments": total, "ridden_segments": ridden, "completion_rate": (ridden / total if total else 0)}


@router.get("/network")
def network(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    ridden_segment_ids = set(
        db.scalars(
            select(RideLegSegment.segment_id)
            .join(RideLeg)
            .join(RideRecord)
            .where(RideRecord.user_id == current_user.id)
        )
    )
    return {
        "lines": [LineRead.model_validate(line).model_dump() for line in db.scalars(select(Line).order_by(Line.display_order, Line.code))],
        "lineStations": [LineStationRead.model_validate(station).model_dump() for station in db.scalars(select(LineStation).order_by(LineStation.line_id, LineStation.branch_code, LineStation.sequence_index))],
        "segments": [
            {**SegmentRead.model_validate(segment).model_dump(), "is_ridden": segment.id in ridden_segment_ids}
            for segment in db.scalars(select(Segment).order_by(Segment.line_id, Segment.display_order, Segment.id))
        ],
    }


@router.get("/preferences/network-style", response_model=Union[DisplayPreferenceRead, Dict])
def get_network_style(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pref = db.scalar(
        select(DisplayPreference).where(
            DisplayPreference.user_id == current_user.id,
            DisplayPreference.preference_key == "network_style",
        )
    )
    return pref or {}


@router.put("/preferences/network-style", response_model=DisplayPreferenceRead)
def save_network_style(
    payload: DisplayPreferenceIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DisplayPreference:
    pref = db.scalar(
        select(DisplayPreference).where(
            DisplayPreference.user_id == current_user.id,
            DisplayPreference.preference_key == payload.preference_key,
        )
    )
    if pref:
        pref.value_json = payload.value_json
    else:
        pref = DisplayPreference(user_id=current_user.id, preference_key=payload.preference_key, value_json=payload.value_json)
        db.add(pref)
    db.commit()
    db.refresh(pref)
    return pref

from __future__ import annotations

from typing import List

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DirectionMode, Line, LineStation, Segment


def resolve_leg_segments(
    db: Session,
    line_id: int,
    from_line_station_id: int,
    to_line_station_id: int,
    direction_mode: DirectionMode,
) -> List[Segment]:
    line = db.get(Line, line_id)
    start = db.get(LineStation, from_line_station_id)
    end = db.get(LineStation, to_line_station_id)
    if not line or not start or not end:
        raise HTTPException(status_code=400, detail="Line or station does not exist")
    if start.line_id != line_id or end.line_id != line_id:
        raise HTTPException(status_code=400, detail="Both stations must belong to the selected line")
    if start.id == end.id:
        raise HTTPException(status_code=400, detail="A leg must contain at least one segment")
    if start.branch_code != end.branch_code:
        raise HTTPException(status_code=400, detail="Different branches require manual segment selection in this version")

    stations = list(
        db.scalars(
            select(LineStation)
            .where(
                LineStation.line_id == line_id,
                LineStation.branch_code == start.branch_code,
                LineStation.is_active.is_(True),
            )
            .order_by(LineStation.sequence_index)
        )
    )
    station_ids = [station.id for station in stations]
    try:
        start_idx = station_ids.index(start.id)
        end_idx = station_ids.index(end.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Station order is not available") from exc

    ordered_ids = _ordered_station_ids(line.is_loop, station_ids, start_idx, end_idx, direction_mode)
    return [_find_segment_between(db, line_id, a, b) for a, b in zip(ordered_ids, ordered_ids[1:])]


def _ordered_station_ids(
    is_loop: bool,
    station_ids: List[int],
    start_idx: int,
    end_idx: int,
    direction_mode: DirectionMode,
) -> List[int]:
    if not is_loop:
        if start_idx < end_idx:
            return station_ids[start_idx : end_idx + 1]
        return list(reversed(station_ids[end_idx : start_idx + 1]))

    if direction_mode not in {DirectionMode.clockwise, DirectionMode.anticlockwise}:
        raise HTTPException(status_code=400, detail="Loop lines require clockwise or anticlockwise direction")

    if direction_mode == DirectionMode.clockwise:
        path = []
        i = start_idx
        while True:
            path.append(station_ids[i])
            if i == end_idx:
                return path
            i = (i + 1) % len(station_ids)

    path = []
    i = start_idx
    while True:
        path.append(station_ids[i])
        if i == end_idx:
            return path
        i = (i - 1) % len(station_ids)


def _find_segment_between(db: Session, line_id: int, a: int, b: int) -> Segment:
    segment = db.scalar(
        select(Segment).where(
            Segment.line_id == line_id,
            Segment.is_active.is_(True),
            (
                ((Segment.from_line_station_id == a) & (Segment.to_line_station_id == b))
                | ((Segment.from_line_station_id == b) & (Segment.to_line_station_id == a))
            ),
        )
    )
    if not segment:
        raise HTTPException(status_code=400, detail=f"No segment found between line stations {a} and {b}")
    return segment

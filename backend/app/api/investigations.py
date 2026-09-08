from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.investigation_note import NoteCreate
from app.services.alert_service import add_note, get_alert

router = APIRouter(prefix="/api/investigations", tags=["investigations"])

@router.post("/{alert_id}/notes", status_code=201)
def create_note(alert_id: int, payload: NoteCreate, db: Session = Depends(get_db)):
    if not get_alert(db, alert_id):
        raise HTTPException(404, "Alert not found")
    note = add_note(db, alert_id, note=payload.note, analyst=payload.analyst)
    return {"id": note.id, "alert_id": note.alert_id, "note": note.note,
            "analyst": note.analyst, "created_at": note.created_at.isoformat()}

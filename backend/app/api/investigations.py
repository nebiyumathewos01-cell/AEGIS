from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.investigation_note import NoteCreate
from app.services.alert_service import add_note

router = APIRouter(prefix="/api/investigations", tags=["investigations"])

@router.post("/{alert_id}/notes", status_code=201)
def create_note(
    alert_id: int,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = add_note(db, alert_id, owner_id=current_user.id,
                    note=payload.note, analyst=current_user.full_name)
    if not note:
        raise HTTPException(404, "Alert not found")
    return {"id": note.id, "alert_id": note.alert_id, "note": note.note,
            "analyst": note.analyst, "created_at": note.created_at.isoformat()}

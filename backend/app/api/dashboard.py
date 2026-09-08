from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.alert_service import get_dashboard_stats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    return get_dashboard_stats(db)

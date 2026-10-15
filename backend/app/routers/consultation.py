import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import (
    User, ConsultationRequest, ConsultationMessage, Appointment, Notification,
    DoctorProfile
)
from backend.app.schemas import (
    MessageCreate, MessageResponse, AppointmentCreate, AppointmentResponse
)
from backend.app.auth import get_current_user, log_audit

router = APIRouter(prefix="/consultation", tags=["One-to-One Consultation & Telehealth"])

@router.get("/{req_id}/messages", response_model=List[MessageResponse])
def get_consultation_messages(
    req_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(ConsultationRequest).filter(ConsultationRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Consultation relationship not found")
        
    # Security check: User must be either patient or doctor in this relationship
    if current_user.id != req.patient_id and current_user.id != req.doctor_id:
        raise HTTPException(status_code=403, detail="Forbidden: You are not a participant in this consultation")
        
    # Must be accepted for messaging
    if req.status != "accepted":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Messaging is only available for accepted consultation relationships"
        )
        
    # Mark incoming unread messages as read
    db.query(ConsultationMessage).filter(
        ConsultationMessage.request_id == req_id,
        ConsultationMessage.recipient_id == current_user.id,
        ConsultationMessage.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    messages = db.query(ConsultationMessage).filter(
        ConsultationMessage.request_id == req_id
    ).order_by(ConsultationMessage.created_at.asc()).all()
    
    results = []
    for m in messages:
        sender_user = db.query(User).filter(User.id == m.sender_id).first()
        results.append({
            "id": m.id,
            "request_id": m.request_id,
            "sender_id": m.sender_id,
            "sender_name": sender_user.full_name if sender_user else "User",
            "sender_role": sender_user.role if sender_user else "user",
            "recipient_id": m.recipient_id,
            "message_text": m.message_text,
            "attachments": m.attachments_json,
            "is_read": m.is_read,
            "created_at": m.created_at
        })
    return results

@router.post("/{req_id}/messages", response_model=MessageResponse)
def send_consultation_message(
    req_id: int,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(ConsultationRequest).filter(ConsultationRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Consultation relationship not found")
        
    if current_user.id != req.patient_id and current_user.id != req.doctor_id:
        raise HTTPException(status_code=403, detail="Forbidden: You are not a participant in this consultation")
        
    if req.status != "accepted":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Consultation request must be accepted before messages can be exchanged"
        )
        
    recipient_id = req.doctor_id if current_user.id == req.patient_id else req.patient_id
    
    msg = ConsultationMessage(
        request_id=req_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        message_text=msg_in.message_text,
        attachments_json=msg_in.attachments or [],
        is_read=False,
        created_at=datetime.datetime.utcnow()
    )
    db.add(msg)
    
    # Notify recipient
    notif = Notification(
        user_id=recipient_id,
        title=f"New Message from {current_user.full_name}",
        message=f"{msg_in.message_text[:120]}...",
        type="consultation"
    )
    db.add(notif)
    db.commit()
    db.refresh(msg)
    
    return {
        "id": msg.id,
        "request_id": msg.request_id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.full_name,
        "sender_role": current_user.role,
        "recipient_id": msg.recipient_id,
        "message_text": msg.message_text,
        "attachments": msg.attachments_json,
        "is_read": msg.is_read,
        "created_at": msg.created_at
    }

@router.post("/appointments", response_model=AppointmentResponse)
def schedule_appointment(
    apt_in: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Determine doctor and patient ids
    if current_user.role == "patient":
        patient_id = current_user.id
        doctor_id = apt_in.doctor_id
        if not doctor_id:
            # Try to lookup active doctor
            req = db.query(ConsultationRequest).filter(
                ConsultationRequest.patient_id == patient_id,
                ConsultationRequest.status == "accepted"
            ).first()
            if req:
                doctor_id = req.doctor_id
            else:
                raise HTTPException(status_code=400, detail="Doctor ID must be specified")
    elif current_user.role == "doctor":
        doctor_id = current_user.id
        patient_id = apt_in.patient_id
        if not patient_id:
            raise HTTPException(status_code=400, detail="Patient ID must be specified")
    else:
        patient_id = apt_in.patient_id
        doctor_id = apt_in.doctor_id
        if not patient_id or not doctor_id:
            raise HTTPException(status_code=400, detail="Both patient and doctor must be provided")
            
    # Verify relationship
    req = db.query(ConsultationRequest).filter(
        ConsultationRequest.patient_id == patient_id,
        ConsultationRequest.doctor_id == doctor_id,
        ConsultationRequest.status == "accepted"
    ).first()
    if not req:
        raise HTTPException(status_code=400, detail="An active accepted consultation relationship is required to book appointments")
        
    apt = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        scheduled_time=apt_in.scheduled_time,
        duration_minutes=apt_in.duration_minutes,
        mode=apt_in.mode,
        status="scheduled",
        notes=apt_in.notes,
        created_at=datetime.datetime.utcnow()
    )
    db.add(apt)
    
    # Notify other party
    other_party_id = doctor_id if current_user.id == patient_id else patient_id
    notif = Notification(
        user_id=other_party_id,
        title="New Clinical Appointment Scheduled",
        message=f"Appointment booked for {apt_in.scheduled_time.strftime('%b %d, %Y at %I:%M %p')} ({apt_in.mode.title()}).",
        type="consultation"
    )
    db.add(notif)
    db.commit()
    db.refresh(apt)
    
    pat_user = db.query(User).filter(User.id == patient_id).first()
    doc_prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor_id).first()
    
    return {
        "id": apt.id,
        "patient_id": apt.patient_id,
        "patient_name": pat_user.full_name if pat_user else "Patient",
        "doctor_id": apt.doctor_id,
        "doctor_name": doc_prof.full_name if doc_prof else "Doctor",
        "scheduled_time": apt.scheduled_time,
        "duration_minutes": apt.duration_minutes,
        "mode": apt.mode,
        "status": apt.status,
        "notes": apt.notes,
        "created_at": apt.created_at
    }

@router.get("/appointments", response_model=List[AppointmentResponse])
def get_user_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "patient":
        query = db.query(Appointment).filter(Appointment.patient_id == current_user.id)
    elif current_user.role == "doctor":
        query = db.query(Appointment).filter(Appointment.doctor_id == current_user.id)
    else:
        query = db.query(Appointment)
        
    apts = query.order_by(Appointment.scheduled_time.desc()).all()
    
    results = []
    for a in apts:
        pat_user = db.query(User).filter(User.id == a.patient_id).first()
        doc_prof = db.query(DoctorProfile).filter(DoctorProfile.user_id == a.doctor_id).first()
        results.append({
            "id": a.id,
            "patient_id": a.patient_id,
            "patient_name": pat_user.full_name if pat_user else "Patient",
            "doctor_id": a.doctor_id,
            "doctor_name": doc_prof.full_name if doc_prof else "Doctor",
            "scheduled_time": a.scheduled_time,
            "duration_minutes": a.duration_minutes,
            "mode": a.mode,
            "status": a.status,
            "notes": a.notes,
            "created_at": a.created_at
        })
    return results

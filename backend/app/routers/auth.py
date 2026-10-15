from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import User, PatientProfile, DoctorProfile
from backend.app.schemas import UserRegister, UserLogin, TokenResponse, UserResponse
from backend.app.auth import hash_password, verify_password, create_access_token, get_current_user, log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
def register(user_in: UserRegister, request: Request, db: Session = Depends(get_db)):
    # Check if attempting admin registration without specific admin code
    if user_in.role == "admin":
        if not user_in.admin_code or user_in.admin_code.strip() != settings.ADMIN_ACCESS_CODE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: A valid Administrator Security Access Code is required to create an admin account."
            )

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user account with this email address already exists"
        )
        
    # Create User
    new_user = User(
        email=user_in.email.lower(),
        password_hash=hash_password(user_in.password),
        role=user_in.role,
        full_name=user_in.full_name,
        phone=user_in.phone,
        is_active=True,
        questionnaire_completed=False if user_in.role == "patient" else True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create role-specific profile
    if new_user.role == "patient":
        patient_profile = PatientProfile(
            user_id=new_user.id,
            primary_disease="none",
            raw_questionnaire_json={}
        )
        db.add(patient_profile)
    elif new_user.role == "doctor":
        doctor_profile = DoctorProfile(
            user_id=new_user.id,
            full_name=user_in.full_name,
            specialty=user_in.specialty or "General Medicine",
            qualifications=user_in.qualifications or "MD",
            experience_years=user_in.experience_years or 5,
            consultation_mode=user_in.consultation_mode or "Online",
            fee=user_in.fee or 75.0,
            languages=user_in.languages or "English",
            bio=user_in.bio or f"Specialist in {user_in.specialty or 'General Medicine'}",
            clinic_address=user_in.clinic_address,
            is_verified=False
        )
        db.add(doctor_profile)
        
    db.commit()
    
    log_audit(db, new_user.id, "REGISTER", "user", str(new_user.id), {"role": new_user.role}, request.client.host if request.client else None)
    
    # Mirror new user to MongoDB Atlas if connected
    try:
        from backend.app.mongodb import mongo_manager
        if mongo_manager.is_connected and mongo_manager.db is not None:
            mongo_manager.db.users.update_one(
                {"id": new_user.id},
                {"$set": {
                    "id": new_user.id,
                    "email": new_user.email,
                    "password_hash": new_user.password_hash,
                    "role": new_user.role,
                    "full_name": new_user.full_name,
                    "phone": new_user.phone,
                    "is_active": new_user.is_active,
                    "questionnaire_completed": new_user.questionnaire_completed,
                    "created_at": new_user.created_at.isoformat() if new_user.created_at else None
                }},
                upsert=True
            )
    except Exception:
        pass

    access_token = create_access_token({"sub": str(new_user.id), "role": new_user.role})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
            "full_name": new_user.full_name,
            "questionnaire_completed": new_user.questionnaire_completed,
            "is_active": new_user.is_active
        }
    }

@router.post("/login", response_model=TokenResponse)
def login(login_in: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email.lower()).first()
    if not user or not verify_password(login_in.password, user.password_hash):
        log_audit(db, None, "LOGIN_FAILED", "auth", login_in.email, {"reason": "invalid_credentials"}, request.client.host if request.client else None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated or suspended. Please contact platform administration."
        )
        
    log_audit(db, user.id, "LOGIN_SUCCESS", "auth", str(user.id), {"role": user.role}, request.client.host if request.client else None)
    
    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name,
            "questionnaire_completed": user.questionnaire_completed,
            "is_active": user.is_active
        }
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile_data = {}
    if current_user.role == "patient" and current_user.patient_profile:
        p = current_user.patient_profile
        profile_data = {
            "primary_disease": p.primary_disease,
            "age": p.age,
            "sex": p.sex,
            "height_cm": p.height_cm,
            "weight_kg": p.weight_kg,
            "preferred_specialty": p.preferred_specialty,
            "consent_signed_at": p.consent_signed_at
        }
    elif current_user.role == "doctor" and current_user.doctor_profile:
        d = current_user.doctor_profile
        profile_data = {
            "specialty": d.specialty,
            "qualifications": d.qualifications,
            "experience_years": d.experience_years,
            "fee": d.fee,
            "is_verified": d.is_verified,
            "consultation_mode": d.consultation_mode
        }
        
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "questionnaire_completed": current_user.questionnaire_completed,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "profile": profile_data
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log_audit(db, current_user.id, "LOGOUT", "auth", str(current_user.id), {})
    return {"message": "Logged out successfully"}

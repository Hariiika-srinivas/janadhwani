"""
Administration, SLA Configuration, Officer Management & QR Poster Generator Router
"""
import io
import base64
import sqlite3
import qrcode
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.db import get_connection
from app.auth import hash_password, hash_phone
from engine.clock import now_iso

router = APIRouter(prefix="/api/admin", tags=["Admin"])

class CreateHospitalRequest(BaseModel):
    department_code: str = "HEALTH"
    name: str
    kannada_name: str
    district: str
    lat: float
    lng: float
    address: Optional[str] = None

class CreateWardRequest(BaseModel):
    organization_id: int
    name: str
    kannada_name: str
    code: str
    is_vulnerable: bool = False

class UpdateSLARequest(BaseModel):
    category_id: int
    sla_hours: int = Field(..., ge=1, le=720)
    weight: int = Field(..., ge=1, le=100)

@router.post("/organizations")
def create_organization(req: CreateHospitalRequest):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO organizations (department_code, name, kannada_name, district, lat, lng, address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (req.department_code, req.name, req.kannada_name, req.district, req.lat, req.lng, req.address, now_iso()))
    org_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "id": org_id, "message": f"Organization '{req.name}' created."}

@router.post("/wards")
def create_ward(req: CreateWardRequest):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO wards (organization_id, name, kannada_name, code, is_vulnerable, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (req.organization_id, req.name, req.kannada_name, req.code, 1 if req.is_vulnerable else 0, now_iso()))
    ward_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "id": ward_id, "message": f"Ward '{req.name}' added."}

@router.post("/sla-config")
def update_sla_configuration(req: UpdateSLARequest):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        UPDATE categories
        SET default_sla_hours = ?, weight = ?
        WHERE id = ?
    """, (req.sla_hours, req.weight, req.category_id))
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": f"Category #{req.category_id} updated with SLA {req.sla_hours}h and weight {req.weight}."}

@router.get("/qr-poster")
def generate_qr_poster(organization_id: int, ward_id: Optional[int] = None, format: str = "png"):
    """
    Generates downloadable QR code poster for hospital entrance or ward notice board.
    When scanned by a citizen, opens the assisted/voice portal with hospital and ward pre-selected!
    """
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT name, kannada_name, district FROM organizations WHERE id = ?", (organization_id,))
    org = c.fetchone()
    if not org:
        conn.close()
        raise HTTPException(status_code=404, detail="Organization not found")

    ward_text = ""
    target_url = f"http://localhost:3000/?org_id={organization_id}"
    if ward_id:
        c.execute("SELECT name, kannada_name FROM wards WHERE id = ?", (ward_id,))
        w = c.fetchone()
        if w:
            ward_text = f" - {w[0]} ({w[1]})"
            target_url += f"&ward_id={ward_id}"

    conn.close()

    # Generate QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0F172A", back_color="#FFFFFF")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    if format == "json":
        b64_str = base64.b64encode(png_bytes).decode("utf-8")
        return {
            "organization_name": org[0],
            "organization_kannada": org[1],
            "ward_name": ward_text,
            "target_url": target_url,
            "qr_base64": f"data:image/png;base64,{b64_str}"
        }

    return Response(content=png_bytes, media_type="image/png")

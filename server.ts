import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====================================================================
// Native In-Process JanaDhwani Backend Engine (Node.js / Express)
// Guarantees 100% reliable execution in Cloud Run and serverless runtimes
// ====================================================================

const PHONE_SALT = process.env.PHONE_SALT || 'kalyana-phone-salt-98765';
const GENESIS_HASH = '0'.repeat(64);

function hashPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return crypto.createHash('sha256').update(`${PHONE_SALT}:${clean}`).digest('hex');
}

function calculateEntryHash(
  prevHash: string,
  entityType: string,
  entityId: number,
  action: string,
  actorId: string,
  payloadJson: string,
  timestamp: string
): string {
  const content = `${prevHash}|${entityType}|${entityId}|${action}|${actorId}|${payloadJson}|${timestamp}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

// --------------------------------------------------------------------
// Master In-Memory Data Store (Seeded with 40 realistic complaints)
// --------------------------------------------------------------------
interface Organization {
  id: number;
  department_code: string;
  name: string;
  kannada_name: string;
  district: string;
  lat: number;
  lng: number;
  address: string;
}

interface Ward {
  id: number;
  organization_id: number;
  name: string;
  kannada_name: string;
  code: string;
  is_vulnerable: boolean;
}

interface Category {
  id: number;
  department_code: string;
  name: string;
  kannada_name: string;
  default_sla_hours: number;
  weight: number;
  urgency: string;
  keywords: string[];
}

interface Officer {
  id: number;
  organization_id: number;
  name: string;
  kannada_name: string;
  designation: string;
  role: string;
  level: number;
  username: string;
  department_code: string;
  is_on_leave: boolean;
  substitute_officer_id?: number;
}

interface Action {
  id: number;
  complaint_id: number;
  officer_id?: number;
  action_type: string;
  old_status?: string;
  new_status?: string;
  notes: string;
  photo_url?: string | null;
  location_gps?: string | null;
  created_at: string;
}

interface AuditRecord {
  id: number;
  prev_hash: string;
  entry_hash: string;
  entity_type: string;
  entity_id: number;
  action: string;
  actor_id: string;
  payload: any;
  timestamp: string;
}

interface Complaint {
  id: number;
  public_id: string;
  department_code: string;
  organization_id: number;
  ward_id?: number | null;
  category_id: number;
  language: string;
  original_text: string;
  english_summary: string;
  channel: string;
  citizen_name: string;
  citizen_phone_hash: string;
  assigned_officer_id: number;
  priority_score: number;
  duplicate_count: number;
  status: string;
  sla_deadline: string;
  escalation_level: number;
  is_overdue: boolean;
  opened_at?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  resolution_photo_url?: string | null;
  resolution_location?: string | null;
  verified_by_citizen?: number | null;
  verification_notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Global state
let clockOffsetSeconds = 0;
function getSimulatedNow(): Date {
  return new Date(Date.now() + clockOffsetSeconds * 1000);
}

const organizations: Organization[] = [
  { id: 1, department_code: 'HEALTH', name: 'District Hospital Kalaburagi', kannada_name: 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಕಲಬುರಗಿ', district: 'Kalaburagi', lat: 17.3297, lng: 76.8343, address: 'Station Road, Kalaburagi' },
  { id: 2, department_code: 'HEALTH', name: 'District Hospital Bidar', kannada_name: 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಬೀದರ್', district: 'Bidar', lat: 17.9104, lng: 77.5199, address: 'Near Ambedkar Circle, Bidar' },
  { id: 3, department_code: 'HEALTH', name: 'District Hospital Raichur', kannada_name: 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ರಾಯಚೂರು', district: 'Raichur', lat: 16.2076, lng: 77.3463, address: 'Station Road, Raichur' },
  { id: 4, department_code: 'HEALTH', name: 'District Hospital Koppal', kannada_name: 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಕೊಪ್ಪಳ', district: 'Koppal', lat: 15.3463, lng: 76.1550, address: 'Hospital Road, Koppal' },
  { id: 5, department_code: 'HEALTH', name: 'District Hospital Yadgir', kannada_name: 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಯಾದಗಿರಿ', district: 'Yadgir', lat: 16.7644, lng: 77.1378, address: 'Chittapur Road, Yadgir' }
];

const wards: Ward[] = [];
for (let hId = 1; hId <= 5; hId++) {
  wards.push(
    { id: (hId - 1) * 6 + 1, organization_id: hId, name: 'Maternity & Neonatal Ward', kannada_name: 'ಹೆರಿಗೆ ಮತ್ತು ನವಜಾತ ಶಿಶು ವಿಭಾಗ', code: `MAT-H${hId}`, is_vulnerable: true },
    { id: (hId - 1) * 6 + 2, organization_id: hId, name: 'Pediatric Child Care', kannada_name: 'ಮಕ್ಕಳ ತಜ್ಞರ ಚಿಕಿತ್ಸಾ ವಿಭಾಗ', code: `PED-H${hId}`, is_vulnerable: true },
    { id: (hId - 1) * 6 + 3, organization_id: hId, name: 'Emergency & Trauma ICU', kannada_name: 'ತುರ್ತು ಚಿಕಿತ್ಸೆ ಮತ್ತು ತೀವ್ರ ನಿಗಾ ಘಟಕ (ICU)', code: `EMG-H${hId}`, is_vulnerable: true },
    { id: (hId - 1) * 6 + 4, organization_id: hId, name: 'General Inpatient Ward', kannada_name: 'ಸಾಮಾನ್ಯ ಒಳರೋಗಿ ವಿಭಾಗ', code: `GEN-H${hId}`, is_vulnerable: false },
    { id: (hId - 1) * 6 + 5, organization_id: hId, name: 'OPD Outpatient Consultation', kannada_name: 'ಹೊರರೋಗಿ ತಪಾಸಣಾ ವಿಭಾಗ (OPD)', code: `OPD-H${hId}`, is_vulnerable: false },
    { id: (hId - 1) * 6 + 6, organization_id: hId, name: 'Pharmacy, Lab & Diagnostics', kannada_name: 'ಔಷಧಾಲಯ ಮತ್ತು ಪ್ರಯೋಗಾಲಯ ವಿಭಾಗ', code: `PHARM-H${hId}`, is_vulnerable: false }
  );
}

const categories: Category[] = [
  { id: 1, department_code: 'HEALTH', name: 'Doctor/Staff Absent', kannada_name: 'ವೈದ್ಯರು ಮತ್ತು ಸಿಬ್ಬಂದಿ ಗೈರುಹಾಜರಿ', default_sla_hours: 12, weight: 85, urgency: 'HIGH', keywords: ['doctor', 'absent', 'ವೈದ್ಯರು', 'ಡಾಕ್ಟರ್', 'ಗೈರು', 'nurse', 'missing', 'late', 'ಸಮಯಕ್ಕೆ ಬಂದಿಲ್ಲ'] },
  { id: 2, department_code: 'HEALTH', name: 'Medicine Shortage', kannada_name: 'ಔಷಧಿ ಮತ್ತು ಇಂಜೆಕ್ಷನ್ ಕೊರತೆ', default_sla_hours: 48, weight: 75, urgency: 'HIGH', keywords: ['medicine', 'tablet', 'ಔಷಧಿ', 'ಮಾತ್ರೆ', 'ಕೊರತೆ', 'injection', 'pharmacy', 'ಸಿರಪ್', 'syrup', 'ಇನ್ಸುಲಿನ್'] },
  { id: 3, department_code: 'HEALTH', name: 'Hygiene & Cleanliness', kannada_name: 'ಸ್ವಚ್ಛತೆ ಮತ್ತು ನೈರ್ಮಲ್ಯ ಕೊರತೆ', default_sla_hours: 24, weight: 65, urgency: 'MEDIUM', keywords: ['cleanliness', 'dirty', 'ಸ್ವಚ್ಛತೆ', 'ಕಸ', 'ಗಲೀಜು', 'ವಾಸನೆ', 'waste', 'smell', 'ದುರ್ನಾತ'] },
  { id: 4, department_code: 'HEALTH', name: 'Drinking Water & Sanitation', kannada_name: 'ಕುಡಿಯುವ ನೀರು ಮತ್ತು ಶೌಚಾಲಯ', default_sla_hours: 24, weight: 70, urgency: 'HIGH', keywords: ['water', 'toilet', 'ಕುಡಿಯುವ ನೀರು', 'ಶೌಚಾಲಯ', 'ನಲ್ಲಿ', 'ನೀರಿಲ್ಲ', 'filter', 'ಫಿಲ್ಟರ್', 'ಬಚ್ಚಲುಮನೆ'] },
  { id: 5, department_code: 'HEALTH', name: 'Beds, Wheelchairs & Stretchers', kannada_name: 'ಹಾಸಿಗೆ, ವೀಲ್‌ಚೇರ್ ಮತ್ತು ಸ್ಟ್ರೆಚರ್', default_sla_hours: 48, weight: 60, urgency: 'MEDIUM', keywords: ['bed', 'wheelchair', 'ಹಾಸಿಗೆ', 'ಮಲಗಲು ಜಾಗವಿಲ್ಲ', 'ವೀಲ್‌ಚೇರ್', 'stretcher', 'ಸ್ಟ್ರೆಚರ್', 'fan'] },
  { id: 6, department_code: 'HEALTH', name: 'Infrastructure & Electrical Maintenance', kannada_name: 'ಕಟ್ಟಡ, ಲಿಫ್ಟ್ ಮತ್ತು ವಿದ್ಯುತ್ ದುರಸ್ತಿ', default_sla_hours: 120, weight: 45, urgency: 'NORMAL', keywords: ['building', 'electricity', 'ವಿದ್ಯುತ್', 'ಕಟ್ಟಡ', 'ಲಿಫ್ಟ್', 'light', 'leakage', 'ಸೋರುವಿಕೆ'] },
  { id: 7, department_code: 'HEALTH', name: 'Staff Behaviour & Bribery', kannada_name: 'ಸಿಬ್ಬಂದಿಯ ಅನುಚಿತ ವರ್ತನೆ ಮತ್ತು ಲಂಚ', default_sla_hours: 48, weight: 70, urgency: 'HIGH', keywords: ['behaviour', 'rude', 'ವರ್ತನೆ', 'ದುರ್ವರ್ತನೆ', 'ಲಂಚ', 'bribe', 'ದೌರ್ಜನ್ಯ'] },
  { id: 8, department_code: 'HEALTH', name: 'Ambulance & Emergency Desk', kannada_name: 'ಆಂಬ್ಯುಲೆನ್ಸ್ ಮತ್ತು ತುರ್ತು ಸೇವೆಗಳು', default_sla_hours: 12, weight: 90, urgency: 'HIGH', keywords: ['ambulance', 'ಆಂಬ್ಯುಲೆನ್ಸ್', 'ತುರ್ತು', 'emergency', 'oxygen', 'ಆಮ್ಲಜನಕ'] }
];

const officers: Officer[] = [
  { id: 1, organization_id: 1, name: 'Dr. Sneha Kulkarni', kannada_name: 'ಡಾ. ಸ್ನೇಹಾ ಕುಲಕರ್ಣಿ', designation: 'Duty Medical Officer L1', role: 'OFFICER', level: 1, username: 'officer_sneha', department_code: 'HEALTH', is_on_leave: false },
  { id: 2, organization_id: 1, name: 'Dr. Ramesh Patil', kannada_name: 'ಡಾ. ರಮೇಶ್ ಪಾಟೀಲ್', designation: 'Senior Resident Medical Officer L1', role: 'OFFICER', level: 1, username: 'officer_patil', department_code: 'HEALTH', is_on_leave: false },
  { id: 3, organization_id: 1, name: 'Dr. K. S. Deshmukh', kannada_name: 'ಡಾ. ಕೆ. ಎಸ್. ದೇಶಮುಖ್', designation: 'Medical Superintendent L2', role: 'SUPERVISOR', level: 2, username: 'sup_deshmukh', department_code: 'HEALTH', is_on_leave: false },
  { id: 4, organization_id: 1, name: 'Dr. Sharanappa K', kannada_name: 'ಡಾ. ಶರಣಪ್ಪ ಕೆ', designation: 'District Health Officer (DHO) L3', role: 'DISTRICT_OFFICER', level: 3, username: 'dho_kalaburagi', department_code: 'HEALTH', is_on_leave: false },
  { id: 5, organization_id: 1, name: 'Sri Naveen Kumar IAS', kannada_name: 'ಶ್ರೀ ನವೀನ್ ಕುಮಾರ್ ಐಎಎಸ್', designation: 'Commissioner Health & Family Welfare L4', role: 'COMMISSIONER', level: 4, username: 'commissioner_health', department_code: 'HEALTH', is_on_leave: false },
  { id: 6, organization_id: 3, name: 'Dr. Vijaykumar Raichur', kannada_name: 'ಡಾ. ವಿಜಯಕುಮಾರ್ ರಾಯಚೂರು', designation: 'Hospital Resident Officer L1', role: 'OFFICER', level: 1, username: 'officer_raichur', department_code: 'HEALTH', is_on_leave: false },
  { id: 7, organization_id: 3, name: 'Dr. Renuka Devi', kannada_name: 'ಡಾ. ರೇಣುಕಾ ದೇವಿ', designation: 'Medical Superintendent L2', role: 'SUPERVISOR', level: 2, username: 'sup_raichur', department_code: 'HEALTH', is_on_leave: false },
  { id: 8, organization_id: 2, name: 'Dr. Mohammed Arif', kannada_name: 'ಡಾ. ಮಹಮ್ಮದ್ ಆರಿಫ್', designation: 'Duty Medical Officer L1', role: 'OFFICER', level: 1, username: 'officer_bidar', department_code: 'HEALTH', is_on_leave: false },
  { id: 9, organization_id: 2, name: 'Dr. S. B. Hiremath', kannada_name: 'ಡಾ. ಎಸ್. ಬಿ. ಹಿರೇಮಠ', designation: 'Medical Superintendent L2', role: 'SUPERVISOR', level: 2, username: 'sup_bidar', department_code: 'HEALTH', is_on_leave: false },
  { id: 10, organization_id: 4, name: 'Dr. Basavaraj Patil', kannada_name: 'ಡಾ. ಬಸವರಾಜ್ ಪಾಟೀಲ್', designation: 'Medical Superintendent L2', role: 'SUPERVISOR', level: 2, username: 'sup_koppal', department_code: 'HEALTH', is_on_leave: false },
  { id: 11, organization_id: 5, name: 'Dr. Anitha S', kannada_name: 'ಡಾ. ಅನಿತಾ ಎಸ್', designation: 'Medical Superintendent L2', role: 'SUPERVISOR', level: 2, username: 'sup_yadgir', department_code: 'HEALTH', is_on_leave: false },
  { id: 12, organization_id: 1, name: 'Vinay Rao', kannada_name: 'ವಿನಯ್ ರಾವ್', designation: 'Chief Healthcare Auditor', role: 'AUDITOR', level: 3, username: 'auditor_demo', department_code: 'HEALTH', is_on_leave: false },
  { id: 13, organization_id: 1, name: 'System Administrator', kannada_name: 'ವ್ಯವಸ್ಥಾ ನಿರ್ವಾಹಕ', designation: 'System Administrator', role: 'ADMIN', level: 4, username: 'admin_demo', department_code: 'HEALTH', is_on_leave: false }
];

let complaints: Complaint[] = [];
let actions: Action[] = [];
let auditLog: AuditRecord[] = [];
let ratings: { complaint_id: number; stars: number; feedback: string; created_at: string }[] = [];

function appendAudit(entityType: string, entityId: number, actionName: string, actorId: string, payload: any): string {
  const lastEntry = auditLog.length > 0 ? auditLog[auditLog.length - 1] : null;
  const prevHash = lastEntry ? lastEntry.entry_hash : GENESIS_HASH;
  const timestamp = getSimulatedNow().toISOString();
  const payloadJson = JSON.stringify(payload);
  const entryHash = calculateEntryHash(prevHash, entityType, entityId, actionName, actorId, payloadJson, timestamp);

  auditLog.push({
    id: auditLog.length + 1,
    prev_hash: prevHash,
    entry_hash: entryHash,
    entity_type: entityType,
    entity_id: entityId,
    action: actionName,
    actor_id: actorId,
    payload,
    timestamp
  });
  return entryHash;
}

// Emergency keywords detector
const EMERGENCY_WORDS: { [key: string]: string } = {
  'ಎದೆ ನೋವು': 'CHEST_PAIN', 'ede novu': 'CHEST_PAIN', 'ಹೃದಯಾಘಾತ': 'HEART_ATTACK',
  'ರಕ್ತಸ್ರಾವ': 'SEVERE_BLEEDING', 'ರಕ್ತ ಸುರಿಯುತ್ತಿದೆ': 'SEVERE_BLEEDING', 'ಪ್ರಜ್ಞೆ ತಪ್ಪಿದೆ': 'UNCONSCIOUS',
  'ಅಪಘಾತ': 'ACCIDENT', 'ಹಾವು ಕಡಿತ': 'SNAKE_BITE', 'ಹೆರಿಗೆ ನೋವು': 'DELIVERY_PAIN',
  'ಉಸಿರಾಟ ತೊಂದರೆ': 'BREATHING_DIFFICULTY', 'ವಿಷ': 'POISON', 'ತುರ್ತು': 'EMERGENCY',
  'chest pain': 'CHEST_PAIN', 'heart attack': 'HEART_ATTACK', 'severe bleeding': 'SEVERE_BLEEDING',
  'unconscious': 'UNCONSCIOUS', 'accident': 'ACCIDENT', 'snake bite': 'SNAKE_BITE',
  'delivery pain': 'DELIVERY_PAIN', 'breathing difficulty': 'BREATHING_DIFFICULTY'
};

function checkEmergency(text: string): { isEmergency: boolean; details?: any } {
  const norm = text.toLowerCase();
  for (const [kw, concept] of Object.entries(EMERGENCY_WORDS)) {
    if (norm.includes(kw)) {
      return {
        isEmergency: true,
        details: {
          concept,
          detected_phrase: kw,
          helpline: '108',
          message_kn: 'ಇದು ಗಂಭೀರ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾಗಿದೆ. ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ಆಸ್ಪತ್ರೆಯ ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗಕ್ಕೆ ತೆರಳಿ ಅಥವಾ 108 ಗೆ ಕರೆ ಮಾಡಿ!',
          message_en: 'This is a serious medical emergency. Please go directly to the hospital Emergency Desk right now or call 108 immediately!'
        }
      };
    }
  }
  return { isEmergency: false };
}

// Classification
function classifyGrievance(text: string, deptCode: string): Category {
  const norm = text.toLowerCase();
  let bestCat = categories.find(c => c.department_code === deptCode);
  let bestScore = 0;

  for (const cat of categories) {
    if (cat.department_code !== deptCode) continue;
    let score = 0;
    for (const kw of cat.keywords) {
      if (norm.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  return bestCat || categories[0];
}

// Priority calculation
function calculatePriority(weight: number, dupCount: number, slaProgress: number, isVuln: boolean, isUrgent: boolean): number {
  let score = weight * 0.40;
  score += Math.min(30, Math.max(0, dupCount - 1) * 5);
  score += Math.min(20, slaProgress * 15);
  if (slaProgress >= 1.0) score += 5;
  if (isVuln) score += 25;
  if (isUrgent) score += 10;
  return Math.max(5, Math.min(100, Math.round(score)));
}

// Seed the in-memory database with 40 realistic complaints
function seedData() {
  complaints = [];
  actions = [];
  auditLog = [];
  ratings = [{ complaint_id: 1, stars: 5, feedback: 'Prompt resolution', created_at: new Date().toISOString() }];

  const now = getSimulatedNow();
  const sampleComplaints = [
    { org: 1, ward: 1, cat: 4, text: 'ಕುಡಿಯುವ ನೀರಿನ ಫಿಲ್ಟರ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ, ರೋಗಿಗಳಿಗೆ ನೀರಿಲ್ಲ', eng: 'Drinking water filter broken in Maternity ward', status: 'SUBMITTED', prio: 78 },
    { org: 1, ward: 1, cat: 4, text: 'Maternity ward water tap has no water since yesterday', eng: 'Drinking water tap dry in Maternity ward', status: 'ASSIGNED', prio: 82 },
    { org: 1, ward: 1, cat: 4, text: 'ಕುಡಿಯುವ ನೀರು ಸಿಗುತ್ತಿಲ್ಲ, ತುರ್ತಾಗಿ ಸರಿಪಡಿಸಿ', eng: 'No drinking water available in Maternity ward', status: 'IN_PROGRESS', prio: 85 },
    { org: 1, ward: 2, cat: 3, text: 'ಮಕ್ಕಳ ವಾರ್ಡ್ ಶೌಚಾಲಯ ಅತ್ಯಂತ ಗಲೀಜಾಗಿದೆ, ಕಸ ತುಂಬಿದೆ', eng: 'Pediatric ward toilets are extremely unhygienic with garbage', status: 'ASSIGNED', prio: 88 },
    { org: 1, ward: 2, cat: 1, text: 'Doctor absent during duty hours in Pediatric ward', eng: 'Doctor absent in Pediatric ward', status: 'ESCALATED', prio: 95 },
    { org: 1, ward: 3, cat: 2, text: 'ಇನ್ಸುಲಿನ್ ಮತ್ತು ಬಿಪಿ ಮಾತ್ರೆಗಳು ಔಷಧಾಲಯದಲ್ಲಿ ಇಲ್ಲ', eng: 'Insulin and BP tablets out of stock in General ward', status: 'RESOLVED', prio: 60 },
    { org: 1, ward: 4, cat: 7, text: 'ಹೊರರೋಗಿ ವಿಭಾಗದ ಸಿಬ್ಬಂದಿ ಲಂಚ ಕೇಳುತ್ತಿದ್ದಾರೆ', eng: 'OPD staff demanding bribe from patients', status: 'IN_PROGRESS', prio: 80 },
    { org: 1, ward: 5, cat: 5, text: 'ರೋಗಿಗಳಿಗೆ ಮಲಗಲು ಹಾಸಿಗೆ ಇಲ್ಲ, ನೆಲದ ಮೇಲೆ ಮಲಗಿಸಿದ್ದಾರೆ', eng: 'Bed shortage in General ward, patients sleeping on floor', status: 'ESCALATED', prio: 92 },
    { org: 2, ward: 6, cat: 4, text: 'ಬೀದರ್ ಆಸ್ಪತ್ರೆಯ ಶೌಚಾಲಯಗಳಲ್ಲಿ ನೀರಿನ ಪೂರೈಕೆ ಸ್ಥಗಿತಗೊಂಡಿದೆ', eng: 'Toilets have no water supply in Bidar Hospital', status: 'ASSIGNED', prio: 72 },
    { org: 2, ward: 7, cat: 1, text: 'Emergency doctor arrived 2 hours late in Bidar', eng: 'Duty doctor arrived very late', status: 'ESCALATED', prio: 88 },
    { org: 2, ward: 8, cat: 2, text: 'ಆ್ಯಂಟಿಬಯೋಟಿಕ್ ಇಂಜೆಕ್ಷನ್ ಖಾಲಿಯಾಗಿದೆ', eng: 'Antibiotic injections out of stock in Bidar', status: 'IN_PROGRESS', prio: 68 },
    { org: 2, ward: 9, cat: 3, text: 'ಕಸದ ಬುಟ್ಟಿಗಳು ತುಂಬಿ ಹರಿಯುತ್ತಿವೆ, ದುರ್ನಾತ ಬರುತ್ತಿದೆ', eng: 'Overflowing garbage bins causing foul smell', status: 'RESOLVED', prio: 58 },
    { org: 2, ward: 10, cat: 6, text: 'ವಿದ್ಯುತ್ ಕಡಿತದಿಂದ ಫ್ಯಾನ್ ಮತ್ತು ಲೈಟ್ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ', eng: 'Power outage, fans and lights not working', status: 'CLOSED', prio: 45 },
    { org: 2, ward: 6, cat: 5, text: 'Wheelchairs are broken and not enough for elderly patients', eng: 'Wheelchairs broken in Bidar hospital', status: 'ASSIGNED', prio: 65 },
    { org: 3, ward: 11, cat: 4, text: 'ರಾಯಚೂರು ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಯ ಹೆರಿಗೆ ವಾರ್ಡ್‌ನಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿಲ್ಲ', eng: 'No drinking water in Raichur maternity ward', status: 'ASSIGNED', prio: 84 },
    { org: 3, ward: 11, cat: 4, text: 'Drinking water RO plant stopped working in Raichur', eng: 'Water purifier defunct in Raichur', status: 'IN_PROGRESS', prio: 80 },
    { org: 3, ward: 12, cat: 1, text: 'ಮಕ್ಕಳ ವಿಭಾಗದ ವೈದ್ಯರು ಗೈರುಹಾಜರಾಗಿದ್ದಾರೆ', eng: 'Pediatrician absent during evening rounds', status: 'ESCALATED', prio: 96 },
    { org: 3, ward: 13, cat: 3, text: 'General ward is extremely unhygienic with stagnant water', eng: 'Stagnant water and mosquito breeding in General ward', status: 'RESOLVED', prio: 62 },
    { org: 3, ward: 14, cat: 2, text: 'ಔಷಧಾಲಯದಲ್ಲಿ ಪ್ಯಾರಸಿಟಮಾಲ್ ಸಿರಪ್ ಲಭ್ಯವಿಲ್ಲ', eng: 'Paracetamol syrup out of stock in Raichur', status: 'ASSIGNED', prio: 70 },
    { org: 3, ward: 15, cat: 7, text: 'Security staff misbehaving with rural villagers', eng: 'Security guards rude to rural visitors', status: 'IN_PROGRESS', prio: 65 },
    { org: 4, ward: 16, cat: 4, text: 'ಕೊಪ್ಪಳ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿನ ನಲ್ಲಿ ಮುರಿದುಬಿದ್ದಿದೆ', eng: 'Water tap broken in Koppal hospital', status: 'RESOLVED', prio: 60 },
    { org: 4, ward: 17, cat: 3, text: 'Pediatric toilets have no running water and filthy smell', eng: 'No water in toilets and bad odour', status: 'IN_PROGRESS', prio: 75 },
    { org: 4, ward: 18, cat: 1, text: 'ವೈದ್ಯರು ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ಬರುತ್ತಿಲ್ಲ, ರೋಗಿಗಳು ಕಾಯುತ್ತಿದ್ದಾರೆ', eng: 'Doctors coming very late, patients waiting', status: 'ASSIGNED', prio: 78 },
    { org: 4, ward: 19, cat: 2, text: 'Iron and folic acid tablets shortage in Koppal', eng: 'Iron tablets shortage for pregnant women', status: 'ESCALATED', prio: 89 },
    { org: 4, ward: 20, cat: 6, text: 'ಲಿಫ್ಟ್ ಕೆಟ್ಟು ನಿಂತಿದ್ದು ರೋಗಿಗಳನ್ನು ಮೆಟ್ಟಿಲಲ್ಲಿ ಹೊತ್ತುಕೊಂಡು ಹೋಗಬೇಕಿದೆ', eng: 'Elevator broken, carrying patients by stairs', status: 'ASSIGNED', prio: 72 },
    { org: 5, ward: 21, cat: 4, text: 'ಯಾದಗಿರಿ ಆಸ್ಪತ್ರೆಯ ಹೆರಿಗೆ ವಿಭಾಗದಲ್ಲಿ ನೀರು ಸೋರುತ್ತಿದೆ', eng: 'Water leakage in Maternity ward in Yadgir', status: 'IN_PROGRESS', prio: 82 },
    { org: 5, ward: 22, cat: 1, text: 'Doctor not available for newborn screening in Yadgir', eng: 'Doctor unavailable in Pediatric ward', status: 'ESCALATED', prio: 98 },
    { org: 5, ward: 23, cat: 3, text: 'ಆಸ್ಪತ್ರೆಯ ಆವರಣದಲ್ಲಿ ಎಲ್ಲೆಂದರಲ್ಲಿ ಕಸ ಬಿದ್ದಿದೆ', eng: 'Hospital compound littered with medical waste', status: 'RESOLVED', prio: 64 },
    { org: 5, ward: 24, cat: 2, text: 'Emergency saline bottles out of stock in Yadgir', eng: 'Saline bottles shortage in Yadgir', status: 'ASSIGNED', prio: 74 },
    { org: 5, ward: 25, cat: 7, text: 'ನರ್ಸ್ ರೋಗಿಗಳಿಗೆ ಕೆಟ್ಟದಾಗಿ ಮಾತನಾಡುತ್ತಿದ್ದಾರೆ', eng: 'Nurse shouting and insulting rural patients', status: 'IN_PROGRESS', prio: 69 },
    { org: 1, ward: 3, cat: 8, text: 'ಕಲಬುರಗಿ ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗದಲ್ಲಿ ಆಂಬ್ಯುಲೆನ್ಸ್ ಚಾಲಕ ಲಭ್ಯವಿಲ್ಲ', eng: 'Ambulance driver unavailable at Emergency Desk in Kalaburagi', status: 'IN_PROGRESS', prio: 85 },
    { org: 1, ward: 6, cat: 2, text: 'ರಕ್ತನಿಧಿ ಕೇಂದ್ರದಲ್ಲಿ ತುರ್ತು O+ ರಕ್ತದ ಬಾಟಲಿಗಳ ತೀವ್ರ ಕೊರತೆ', eng: 'Blood bank shortage of emergency O+ blood units', status: 'ASSIGNED', prio: 88 },
    { org: 2, ward: 9, cat: 8, text: 'ಬೀದರ್ ತುರ್ತು ಚಿಕಿತ್ಸಾ ಘಟಕದಲ್ಲಿ ಆಕ್ಸಿಜನ್ ಸಿಲಿಂಡರ್ ಪೂರೈಕೆ ಕೊರತೆ', eng: 'Oxygen cylinder shortage reported in Bidar hospital', status: 'ASSIGNED', prio: 92 },
    { org: 3, ward: 15, cat: 5, text: 'ರಾಯಚೂರು ಒಳರೋಗಿ ವಾರ್ಡ್‌ನಲ್ಲಿ ರೋಗಿಗಳಿಗೆ ಗ್ಲೂಕೋಸ್ ಸ್ಟ್ಯಾಂಡ್ ಮತ್ತು ವೀಲ್‌ಚೇರ್ ಇಲ್ಲ', eng: 'Lack of IV drip stands and wheel stretchers in Raichur', status: 'RESOLVED', prio: 55 },
    { org: 4, ward: 21, cat: 4, text: 'ಕೊಪ್ಪಳ ಆಸ್ಪತ್ರೆಯ ನೀರಿನ ಟ್ಯಾಂಕ್ ಕಳೆದ ೩ ತಿಂಗಳಿಂದ ಸ್ವಚ್ಛಗೊಳಿಸಿಲ್ಲ', eng: 'Hospital overhead water tank not cleaned since 3 months', status: 'IN_PROGRESS', prio: 78 },
    { org: 5, ward: 30, cat: 1, text: 'ಯಾದಗಿರಿ ರಕ್ತ ಪರೀಕ್ಷಾ ಲ್ಯಾಬ್‌ನಲ್ಲಿ ಟೆಕ್ನೀಷಿಯನ್ ಗೈರುಹಾಜರಿ', eng: 'Lab technician absent in diagnostic center Yadgir', status: 'ASSIGNED', prio: 80 },
    { org: 2, ward: 7, cat: 7, text: 'ಹೆರಿಗೆ ವಾರ್ಡ್ ಸಿಬ್ಬಂದಿ ರೋಗಿಯ ಸಂಬಂಧಿಕರಿಂದ ಹಣ ವಸೂಲಿ ಮಾಡುತ್ತಿದ್ದಾರೆ', eng: 'Ward attendant demanding illegal cash from patient family', status: 'ESCALATED', prio: 94 },
    { org: 3, ward: 16, cat: 2, text: 'ಹಾವು ಕಡಿತದ ಆ್ಯಂಟಿ-ವೆನಮ್ ಇಂಜೆಕ್ಷನ್ ರಾಯಚೂರು ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಖಾಲಿಯಾಗಿದೆ', eng: 'Anti-snake venom injection stock depleted in Raichur', status: 'ESCALATED', prio: 99 },
    { org: 4, ward: 19, cat: 3, text: 'ಕೊಪ್ಪಳ ಹೆರಿಗೆ ವಾರ್ಡ್ ಬೆಡ್ ಶೀಟ್ ಬದಲಾಯಿಸಿಲ್ಲ, ಗಲೀಜಾಗಿದೆ', eng: 'Bed linens not changed and dirty in Koppal maternity ward', status: 'RESOLVED', prio: 65 },
    { org: 5, ward: 28, cat: 6, text: 'ಯಾದಗಿರಿ ಆಸ್ಪತ್ರೆ ಆವರಣದಲ್ಲಿ ಬೀದಿ ದೀಪಗಳು ಕೆಟ್ಟು ಕತ್ತಲೆಯಾಗಿದೆ', eng: 'Hospital compound lights not functioning causing dark hazard', status: 'CLOSED', prio: 42 }
  ];

  sampleComplaints.forEach((s, idx) => {
    const id = idx + 1;
    const publicId = `JD-2026-${1000 + id}`;
    const deptCode = 'HEALTH';
    const isOverdue = s.status === 'ESCALATED';
    const deadline = new Date(now.getTime() + (isOverdue ? -6 : 24) * 3600 * 1000).toISOString();
    const createdAt = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const officerId = s.org === 3 ? 6 : s.org === 2 ? 8 : s.org === 4 ? 10 : s.org === 5 ? 11 : 1;

    complaints.push({
      id,
      public_id: publicId,
      department_code: deptCode,
      organization_id: s.org,
      ward_id: s.ward,
      category_id: s.cat,
      language: 'kn',
      original_text: s.text,
      english_summary: s.eng,
      channel: 'VOICE',
      citizen_name: 'Citizen ' + id,
      citizen_phone_hash: hashPhone('984501' + String(1000 + id)),
      assigned_officer_id: officerId,
      priority_score: s.prio,
      duplicate_count: 1,
      status: s.status,
      sla_deadline: deadline,
      escalation_level: isOverdue ? 2 : 1,
      is_overdue: isOverdue,
      resolved_at: s.status === 'RESOLVED' || s.status === 'CLOSED' ? new Date().toISOString() : null,
      resolution_notes: s.status === 'RESOLVED' || s.status === 'CLOSED' ? 'Field inspection completed and fixed.' : null,
      verified_by_citizen: s.status === 'CLOSED' ? 1 : null,
      created_at: createdAt,
      updated_at: new Date().toISOString()
    });

    actions.push({
      id: actions.length + 1,
      complaint_id: id,
      officer_id: 1,
      action_type: 'STATUS_CHANGE',
      old_status: 'SUBMITTED',
      new_status: s.status,
      notes: 'Initial intake registered in JanaDhwani',
      created_at: createdAt
    });

    appendAudit('complaint', id, 'CREATED', 'CITIZEN', {
      public_id: publicId,
      department: deptCode,
      category_id: s.cat,
      priority: s.prio
    });
  });
}

// Initial seed
seedData();

// --------------------------------------------------------------------
// Express Server Setup
// --------------------------------------------------------------------
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // 1. Organization & Reference Endpoints
  app.get('/api/orgs', (req, res) => {
    const dept = req.query.dept as string;
    const filtered = dept ? organizations.filter(o => o.department_code === dept) : organizations;
    res.json(filtered);
  });

  app.get('/api/wards', (req, res) => {
    const orgId = req.query.org_id ? parseInt(req.query.org_id as string) : null;
    const filtered = orgId ? wards.filter(w => w.organization_id === orgId) : wards;
    res.json(filtered);
  });

  app.get('/api/categories', (req, res) => {
    const dept = req.query.dept as string;
    const filtered = dept ? categories.filter(c => c.department_code === dept) : categories;
    res.json(filtered);
  });

  // 2. Public Statistics
  app.get('/api/public/stats', (_req, res) => {
    const total = complaints.length;
    const resolved = complaints.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const overdue = complaints.filter(c => c.is_overdue).length;

    const byOrg = organizations.map(o => ({
      name: o.name,
      count: complaints.filter(c => c.organization_id === o.id).length
    }));

    res.json({
      total_grievances_registered: total,
      resolved_grievances: resolved,
      resolution_rate_pct: total > 0 ? Math.round((resolved / total) * 1000) / 10 : 100,
      overdue_grievances: overdue,
      citizen_satisfaction_stars: 4.8,
      by_organization: byOrg
    });
  });

  // 3. Officer Login
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const officer = officers.find(o => o.username === username);
    if (!officer || password !== 'password123') {
      return res.status(401).json({ detail: 'Invalid username or password' });
    }
    const org = organizations.find(o => o.id === officer.organization_id);
    res.json({
      token: `token-${officer.id}-${Date.now()}`,
      user: {
        ...officer,
        org_name: org ? org.name : 'Karnataka Health Dept'
      }
    });
  });

  // 4. Complaint Intake Pipeline
  app.post('/api/complaints', (req, res) => {
    const body = req.body;
    const text = body.text || '';

    // Step 1: Emergency Check
    const emCheck = checkEmergency(text);
    if (emCheck.isEmergency) {
      return res.json({
        is_emergency: true,
        emergency_details: emCheck.details,
        status: 'EMERGENCY_REFERRED',
        message_kn: emCheck.details.message_kn,
        message_en: emCheck.details.message_en,
        helpline: '108'
      });
    }

    const orgId = parseInt(body.organization_id) || 1;
    const wardId = body.ward_id ? parseInt(body.ward_id) : null;
    const deptCode = body.department_code || (orgId <= 5 ? 'HEALTH' : 'POLICE');
    const org = organizations.find(o => o.id === orgId) || organizations[0];

    // Step 2: Classification
    const cat = classifyGrievance(text, deptCode);

    // Step 3: Deduplication (Check open complaints with same org & category)
    const existing = complaints.find(c =>
      c.organization_id === orgId &&
      c.category_id === cat.id &&
      (!wardId || c.ward_id === wardId) &&
      c.status !== 'CLOSED' && c.status !== 'RESOLVED'
    );

    if (existing) {
      existing.duplicate_count += 1;
      const isVuln = wardId ? (wards.find(w => w.id === wardId)?.is_vulnerable || false) : false;
      existing.priority_score = calculatePriority(cat.weight, existing.duplicate_count, 0.2, isVuln, false);
      appendAudit('complaint', existing.id, 'DUPLICATE_ATTACHED', 'SYSTEM', {
        duplicate_count: existing.duplicate_count,
        priority: existing.priority_score
      });

      return res.json({
        is_emergency: false,
        is_duplicate: true,
        public_id: existing.public_id,
        duplicate_count: existing.duplicate_count,
        priority_score: existing.priority_score,
        category_name: cat.name,
        category_kannada: cat.kannada_name,
        organization_name: org.name,
        responsible_authority: 'Dr. Vijaykumar Raichur (Duty Officer L1)',
        deadline: existing.sla_deadline.substring(0, 16).replace('T', ' '),
        kannada_ack: `ಇದೇ ಸಮಸ್ಯೆಯನ್ನು ಈಗಾಗಲೇ ಇತರ ನಾಗರಿಕರು ದಾಖಲಿಸಿದ್ದಾರೆ. ನಿಮ್ಮ ದೂರು ಸಂಖ್ಯೆ #${existing.public_id} ಗೆ ಸೇರಿಸಲಾಗಿದೆ (ಒಟ್ಟು ವರದಿಗಳು: ${existing.duplicate_count}). ಆದ್ಯತೆ ಹೆಚ್ಚಿಸಲಾಗಿದೆ!`,
        english_ack: `This identical issue was already reported. Attached to parent complaint #${existing.public_id} (total reports: ${existing.duplicate_count}). Priority raised to ${existing.priority_score}!`
      });
    }

    // Step 4: Create New Complaint
    const newId = complaints.length + 1;
    const publicId = `JD-2026-${1000 + newId}`;
    const deadline = new Date(getSimulatedNow().getTime() + (cat.default_sla_hours || 24) * 3600 * 1000).toISOString();
    const isVuln = wardId ? (wards.find(w => w.id === wardId)?.is_vulnerable || false) : false;
    const priority = calculatePriority(cat.weight, 1, 0.0, isVuln, false);
    const assignedOfficer = officers.find(o => o.organization_id === orgId && o.level === 1) || officers[0];

    const newComp: Complaint = {
      id: newId,
      public_id: publicId,
      department_code: deptCode,
      organization_id: orgId,
      ward_id: wardId,
      category_id: cat.id,
      language: body.language || 'kn',
      original_text: text,
      english_summary: text,
      channel: body.channel || 'VOICE',
      citizen_name: body.is_anonymous ? 'Anonymous Citizen' : (body.citizen_name || 'Citizen'),
      citizen_phone_hash: hashPhone(body.phone || '9845000000'),
      assigned_officer_id: assignedOfficer.id,
      priority_score: priority,
      duplicate_count: 1,
      status: 'ASSIGNED',
      sla_deadline: deadline,
      escalation_level: 1,
      is_overdue: false,
      created_at: getSimulatedNow().toISOString(),
      updated_at: getSimulatedNow().toISOString()
    };

    complaints.push(newComp);

    actions.push({
      id: actions.length + 1,
      complaint_id: newId,
      officer_id: assignedOfficer.id,
      action_type: 'STATUS_CHANGE',
      old_status: 'SUBMITTED',
      new_status: 'ASSIGNED',
      notes: `Routed to ${assignedOfficer.name} (${assignedOfficer.designation})`,
      created_at: newComp.created_at
    });

    appendAudit('complaint', newId, 'CREATED', 'CITIZEN', {
      public_id: publicId,
      department: deptCode,
      category_id: cat.id,
      priority
    });

    res.json({
      is_emergency: false,
      is_duplicate: false,
      public_id: publicId,
      complaint_id: newId,
      category_name: cat.name,
      category_kannada: cat.kannada_name,
      responsible_authority: `${assignedOfficer.name} (${assignedOfficer.designation})`,
      organization_name: org.name,
      deadline: deadline.substring(0, 16).replace('T', ' '),
      priority_score: priority,
      kannada_ack: `ಜನಧ್ವನಿ: ನಿಮ್ಮ ದೂರು #${publicId} ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ. ನಿಗದಿತ ಪರಿಹಾರ ದಿನಾಂಕ: ${deadline.substring(0, 16).replace('T', ' ')}. ಪರಿಶೀಲಿಸಲು: janadhwani.gov.in/status`,
      english_ack: `JanaDhwani: Your grievance #${publicId} is registered. Responsible authority: ${assignedOfficer.name}. Resolution deadline: ${deadline.substring(0, 16).replace('T', ' ')}.`
    });
  });

  // Helper for flexible complaint ID matching (supports "JD-2026-1015", "1015", "jd-2026-1015", etc.)
  function findComplaint(idParam: string): Complaint | undefined {
    if (!idParam) return undefined;
    const raw = idParam.trim();
    // 1. Direct match
    let match = complaints.find(c => c.public_id === raw || String(c.id) === raw);
    if (match) return match;

    // 2. Case-insensitive & strip '#'
    const upper = raw.toUpperCase().replace(/^#/, '');
    match = complaints.find(c => c.public_id.toUpperCase() === upper);
    if (match) return match;

    // 3. Numeric ID (e.g. "1015" -> "JD-2026-1015")
    if (/^\d+$/.test(upper)) {
      match = complaints.find(c => c.public_id.endsWith(`-${upper}`) || c.id === parseInt(upper));
      if (match) return match;
    }

    // 4. Compact prefix variations like "JD20261015"
    const digits = upper.replace(/\D/g, '');
    if (digits.length >= 4) {
      const lastFour = digits.slice(-4);
      match = complaints.find(c => c.public_id.endsWith(`-${lastFour}`));
      if (match) return match;
    }

    return undefined;
  }

  // 5. Complaint Status Lookup
  app.get('/api/complaints/:id/status', (req, res) => {
    const comp = findComplaint(req.params.id);
    if (!comp) {
      return res.status(404).json({ detail: 'Complaint not found. Please verify the grievance ID.' });
    }

    const org = organizations.find(o => o.id === comp.organization_id);
    const cat = categories.find(c => c.id === comp.category_id);
    const off = officers.find(o => o.id === comp.assigned_officer_id);
    const ward = comp.ward_id ? wards.find(w => w.id === comp.ward_id) : null;

    const timeline = actions.filter(a => a.complaint_id === comp.id);

    const statusKn = comp.status === 'RESOLVED' ? 'ಪರಿಹಾರವಾಗಿದೆ' :
                     comp.status === 'IN_PROGRESS' ? 'ಪ್ರಗತಿಯಲ್ಲಿದೆ' :
                     comp.status === 'CLOSED' ? 'ಮುಕ್ತಾಯಗೊಂಡಿದೆ' :
                     comp.status === 'ESCALATED' ? 'ಮೇಲಧಿಕಾರಿಗೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ' : 'ದಾಖಲಾಗಿದೆ';

    const audioKn = `ದೂರು ಸಂಖ್ಯೆ ${comp.public_id}. ನಿಮ್ಮ ದೂರಿನ ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: ${statusKn}. ಜವಾಬ್ದಾರಿಯುತ ಅಧಿಕಾರಿ: ${off ? off.name : 'ಕರ್ತವ್ಯ ಅಧಿಕಾರಿ'} (${off ? off.designation : 'ವಿಭಾಗ ಮುಖ್ಯಸ್ಥರು'}). ನಿಗದಿತ ಪರಿಹಾರ ದಿನಾಂಕ: ${comp.sla_deadline.substring(0, 10)}.`;
    const audioEn = `Grievance ID ${comp.public_id}. Current status is ${comp.status}. Assigned authority: ${off ? off.name : 'Duty Officer'} (${off ? off.designation : 'In-Charge'}). Resolution target date: ${comp.sla_deadline.substring(0, 10)}.`;

    res.json({
      complaint: {
        ...comp,
        org_name: org?.name || 'District Hospital',
        org_kn_name: org?.kannada_name || 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ',
        cat_name: cat?.name || 'General Grievance',
        cat_kn_name: cat?.kannada_name || 'ದೂರು',
        ward_name: ward?.name || 'General Area',
        officer_name: off?.name || 'Duty Team',
        officer_desig: off?.designation || 'In-Charge'
      },
      timeline,
      audio_text_kn: audioKn,
      audio_text_en: audioEn
    });
  });

  // 6. Citizen Verification
  app.post('/api/complaints/:id/verify', (req, res) => {
    const comp = findComplaint(req.params.id);
    if (!comp) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }
    const { action, notes } = req.body;

    const now = getSimulatedNow().toISOString();
    if (action === 'confirm') {
      comp.status = 'CLOSED';
      comp.verified_by_citizen = 1;
      comp.verification_notes = notes || 'Confirmed by citizen';
      comp.updated_at = now;

      actions.push({
        id: actions.length + 1,
        complaint_id: comp.id,
        action_type: 'VERIFIED',
        old_status: 'RESOLVED',
        new_status: 'CLOSED',
        notes: 'Citizen confirmed resolution in portal',
        created_at: now
      });

      appendAudit('complaint', comp.id, 'VERIFIED_CLOSED', 'CITIZEN', { public_id: comp.public_id, notes });
      return res.json({
        status: 'SUCCESS',
        message: 'Grievance successfully verified and closed. Thank you!',
        message_kn: 'ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ದೂರು ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲಿಸಲ್ಪಟ್ಟು ಮುಕ್ತಾಯಗೊಂಡಿದೆ.'
      });
    } else {
      comp.status = 'REOPENED';
      comp.escalation_level = 2;
      comp.verified_by_citizen = 0;
      comp.verification_notes = notes || 'Issue persists';
      comp.updated_at = now;

      actions.push({
        id: actions.length + 1,
        complaint_id: comp.id,
        action_type: 'REOPENED',
        old_status: 'RESOLVED',
        new_status: 'REOPENED',
        notes: `Citizen rejected resolution: ${notes || 'Issue persists'}`,
        created_at: now
      });

      appendAudit('complaint', comp.id, 'VERIFIED_REOPENED', 'CITIZEN', { public_id: comp.public_id, notes });
      return res.json({
        status: 'REOPENED',
        message: 'Grievance reopened and escalated to Medical Superintendent / Circle Inspector.',
        message_kn: 'ದೂರು ಮರುತೆರೆಯಲಾಗಿದೆ ಹಾಗೂ ಮೇಲ್ವಿಚಾರಕ ವೈದ್ಯಕೀಯ ಅಧೀಕ್ಷಕರಿಗೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ.'
      });
    }
  });

  // 7. Citizen Rating
  app.post('/api/complaints/:id/rating', (req, res) => {
    const comp = findComplaint(req.params.id);
    if (comp) {
      const { stars, feedback } = req.body;
      ratings.push({
        complaint_id: comp.id,
        stars: stars || 5,
        feedback: feedback || '',
        created_at: getSimulatedNow().toISOString()
      });
    }
    res.json({
      status: 'SUCCESS',
      message: 'Rating recorded',
      message_kn: 'ನಿಮ್ಮ ಅಮೂಲ್ಯವಾದ ಪ್ರತಿಕ್ರಿಯೆ ದಾಖಲಾಗಿದೆ. ಧನ್ಯವಾದಗಳು!'
    });
  });

  // 7a. Officer Snooze SLA Extension
  app.post('/api/complaints/:id/snooze', (req, res) => {
    const comp = findComplaint(req.params.id);
    if (!comp) return res.status(404).json({ detail: 'Complaint not found' });
    const { hours, reason, officer_id } = req.body;
    const extendHours = parseInt(hours) || 24;
    const deadline = new Date(comp.sla_deadline);
    deadline.setHours(deadline.getHours() + extendHours);
    comp.sla_deadline = deadline.toISOString();
    comp.updated_at = getSimulatedNow().toISOString();

    actions.push({
      id: actions.length + 1,
      complaint_id: comp.id,
      officer_id: officer_id || comp.assigned_officer_id,
      action_type: 'SNOOZE_EXTENDED',
      old_status: comp.status,
      new_status: comp.status,
      notes: `SLA extended by ${extendHours}h: ${reason || 'Awaiting specialist or parts shipment'}`,
      created_at: getSimulatedNow().toISOString()
    });

    appendAudit('complaint', comp.id, 'SNOOZE_EXTENDED', String(officer_id || 1), {
      public_id: comp.public_id,
      extendHours,
      reason,
      new_deadline: comp.sla_deadline
    });

    res.json({
      status: 'SUCCESS',
      message: `SLA deadline extended by ${extendHours} hours.`,
      new_deadline: comp.sla_deadline.substring(0, 16).replace('T', ' ')
    });
  });

  // 7b. Officer Reassignment
  app.post('/api/complaints/:id/reassign', (req, res) => {
    const comp = findComplaint(req.params.id);
    if (!comp) return res.status(404).json({ detail: 'Complaint not found' });
    const { new_officer_id, reason, actor_id } = req.body;
    const targetOfficer = officers.find(o => o.id === parseInt(new_officer_id));
    if (!targetOfficer) return res.status(400).json({ detail: 'Target officer not found' });
    const oldOfficer = officers.find(o => o.id === comp.assigned_officer_id);
    comp.assigned_officer_id = targetOfficer.id;
    comp.updated_at = getSimulatedNow().toISOString();

    actions.push({
      id: actions.length + 1,
      complaint_id: comp.id,
      officer_id: targetOfficer.id,
      action_type: 'REASSIGNED',
      old_status: comp.status,
      new_status: comp.status,
      notes: `Reassigned from ${oldOfficer?.name || 'Officer'} to ${targetOfficer.name}: ${reason || 'Transferred for specialised action'}`,
      created_at: getSimulatedNow().toISOString()
    });

    appendAudit('complaint', comp.id, 'REASSIGNED', String(actor_id || 1), {
      public_id: comp.public_id,
      from_officer: oldOfficer?.name,
      to_officer: targetOfficer.name,
      reason
    });

    res.json({
      status: 'SUCCESS',
      message: `Complaint reassigned to ${targetOfficer.name} (${targetOfficer.designation})`
    });
  });

  // 8. Officer Queue
  app.get('/api/officer/complaints', (req, res) => {
    const dept = req.query.department as string;
    let list = dept ? complaints.filter(c => c.department_code === dept) : complaints;

    const enriched = list.map(c => {
      const org = organizations.find(o => o.id === c.organization_id);
      const cat = categories.find(cat => cat.id === c.category_id);
      const off = officers.find(o => o.id === c.assigned_officer_id);
      return {
        ...c,
        org_name: org?.name || 'District Hospital',
        cat_name: cat?.name || 'Grievance',
        officer_name: off?.name || 'Duty Officer',
        officer_desig: off?.designation || ''
      };
    });

    enriched.sort((a, b) => b.priority_score - a.priority_score);
    res.json(enriched);
  });

  // 9. Officer Action Logging
  app.post('/api/complaints/:id/action', (req, res) => {
    const comp = findComplaint(req.params.id);
    if (!comp) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }
    const { action_type, notes, officer_id, photo_url, location_gps } = req.body;

    const now = getSimulatedNow().toISOString();
    const oldStatus = comp.status;

    if (action_type === 'RESOLVED') {
      comp.status = 'RESOLVED';
      comp.resolved_at = now;
      comp.resolution_notes = notes || 'Action completed by field team';
      comp.resolution_photo_url = photo_url || '/static/uploads/water_filter_fixed.jpg';
      comp.resolution_location = location_gps || '16.2076, 77.3463';
    } else if (action_type === 'IN_PROGRESS') {
      comp.status = 'IN_PROGRESS';
      if (!comp.opened_at) comp.opened_at = now;
    }
    comp.updated_at = now;

    actions.push({
      id: actions.length + 1,
      complaint_id: comp.id,
      officer_id: officer_id || comp.assigned_officer_id,
      action_type,
      old_status: oldStatus,
      new_status: comp.status,
      notes: notes || `Action ${action_type} executed`,
      photo_url: photo_url || null,
      location_gps: location_gps || null,
      created_at: now
    });

    appendAudit('complaint', comp.id, `ACTION_${action_type}`, String(officer_id || comp.assigned_officer_id), {
      public_id: comp.public_id,
      old_status: oldStatus,
      new_status: comp.status,
      notes
    });

    res.json({
      status: 'SUCCESS',
      new_status: comp.status,
      message: `Action ${action_type} successfully recorded for complaint #${comp.public_id}`
    });
  });

  // 9a. Officers list
  app.get('/api/officers/list', (req, res) => {
    const dept = req.query.dept as string;
    let list = dept ? officers.filter(o => o.department_code === dept) : officers;
    res.json(list);
  });

  // 9b. Public Transparency Portal Feed
  app.get('/api/transparency/complaints', (req, res) => {
    const dept = req.query.dept as string;
    let list = dept ? complaints.filter(c => c.department_code === dept) : complaints;
    const anonymized = list.map(c => {
      const org = organizations.find(o => o.id === c.organization_id);
      const cat = categories.find(cat => cat.id === c.category_id);
      const off = officers.find(o => o.id === c.assigned_officer_id);
      const ward = c.ward_id ? wards.find(w => w.id === c.ward_id) : null;
      return {
        public_id: c.public_id,
        department_code: c.department_code,
        organization_name: org?.name || 'Hospital',
        organization_kn: org?.kannada_name || 'ಆಸ್ಪತ್ರೆ',
        district: org?.district || 'Kalaburagi',
        ward_name: ward?.name || 'General Ward',
        category_name: cat?.name || 'General Grievance',
        category_kn: cat?.kannada_name || 'ದೂರು',
        original_text: c.original_text,
        status: c.status,
        priority_score: c.priority_score,
        sla_deadline: c.sla_deadline,
        is_overdue: c.is_overdue,
        escalation_level: c.escalation_level,
        duplicate_count: c.duplicate_count,
        created_at: c.created_at,
        resolved_at: c.resolved_at,
        verified_by_citizen: c.verified_by_citizen,
        assigned_officer: off?.name || 'Duty Team',
        assigned_officer_desig: off?.designation || 'In-Charge'
      };
    });
    res.json(anonymized);
  });

  // 10. Dashboard Analytics
  app.get('/api/dashboard/summary', (req, res) => {
    const dept = req.query.dept as string;
    const list = dept ? complaints.filter(c => c.department_code === dept) : complaints;
    const total = list.length;
    const pending = list.filter(c => c.status !== 'RESOLVED' && c.status !== 'CLOSED').length;
    const resolved = list.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const overdue = list.filter(c => c.is_overdue).length;

    res.json({
      total_complaints: total,
      pending_complaints: pending,
      resolved_complaints: resolved,
      overdue_complaints: overdue,
      resolution_rate_pct: total > 0 ? Math.round((resolved / total) * 1000) / 10 : 100,
      citizen_satisfaction_stars: 4.8
    });
  });

  app.get('/api/dashboard/by-category', (req, res) => {
    const dept = req.query.dept as string;
    const catList = dept ? categories.filter(c => c.department_code === dept) : categories;

    const data = catList.map(cat => {
      const match = complaints.filter(c => c.category_id === cat.id);
      return {
        name: cat.name,
        kannada_name: cat.kannada_name,
        total: match.length,
        resolved: match.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length
      };
    });
    res.json(data);
  });

  app.get('/api/dashboard/hospital-scores', (_req, res) => {
    const healthOrgs = organizations.filter(o => o.department_code === 'HEALTH');
    const scores = healthOrgs.map(org => {
      const orgComps = complaints.filter(c => c.organization_id === org.id);
      const total = orgComps.length;
      const resolved = orgComps.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
      const overdue = orgComps.filter(c => c.is_overdue).length;
      const score = Math.max(35, Math.min(95, Math.round(((total - overdue) / (total || 1)) * 50 + (resolved / (total || 1)) * 40 + 10)));

      return {
        id: org.id,
        name: org.name,
        kannada_name: org.kannada_name,
        district: org.district,
        total_complaints: total,
        resolved_complaints: resolved,
        overdue_complaints: overdue,
        composite_score: score,
        health_status: score >= 75 ? 'Good' : score >= 60 ? 'Moderate' : 'Critical'
      };
    });
    res.json(scores);
  });

  app.get('/api/dashboard/early-warnings', (_req, res) => {
    const warnings = [
      {
        organization_name: 'District Hospital Raichur',
        category_name: 'Drinking Water/Sanitation',
        category_kannada: 'ಕುಡಿಯುವ ನೀರು/ಶೌಚಾಲಯ',
        current_weekly_volume: 12,
        previous_weekly_baseline: 3,
        surge_multiplier: '4.0x',
        severity: 'CRITICAL',
        recommendation_kn: 'ರಾಯಚೂರು ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿನ ದೂರುಗಳು ೪ ಪಟ್ಟು ಹೆಚ್ಚಾಗಿವೆ. ತಕ್ಷಣ ಪರಿಶೀಲನಾ ತಂಡ ನಿಯೋಜಿಸಿ!',
        recommendation_en: 'Complaint surge of 4.0x detected for Drinking Water at District Hospital Raichur. Immediate preventive inspection recommended.'
      }
    ];
    res.json(warnings);
  });

  app.get('/api/dashboard/overdue', (req, res) => {
    const dept = req.query.dept as string;
    let list = complaints.filter(c => c.is_overdue && c.status !== 'CLOSED' && c.status !== 'RESOLVED');
    if (dept) list = list.filter(c => c.department_code === dept);

    const enriched = list.map(c => {
      const org = organizations.find(o => o.id === c.organization_id);
      const cat = categories.find(cat => cat.id === c.category_id);
      const off = officers.find(o => o.id === c.assigned_officer_id);
      return {
        ...c,
        org_name: org?.name || 'Hospital',
        cat_name: cat?.name || 'Category',
        officer_name: off?.name || 'Duty Officer',
        designation: off?.designation || ''
      };
    });
    res.json(enriched);
  });

  app.get('/api/dashboard/export-csv', (_req, res) => {
    let csv = 'Public ID,Department,Organization,Category,Status,Priority,Duplicate Count,SLA Deadline,Is Overdue\n';
    complaints.forEach(c => {
      const org = organizations.find(o => o.id === c.organization_id)?.name || '';
      const cat = categories.find(cat => cat.id === c.category_id)?.name || '';
      csv += `"${c.public_id}","${c.department_code}","${org}","${cat}","${c.status}",${c.priority_score},${c.duplicate_count},"${c.sla_deadline}",${c.is_overdue}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=janadhwani_grievances.csv');
    res.send(csv);
  });

  // 11. Hackathon Demonstration Controls
  app.post('/api/demo/advance-time', (req, res) => {
    const hours = parseFloat(req.body.hours) || 24.0;
    clockOffsetSeconds += Math.round(hours * 3600);
    const simulatedNow = getSimulatedNow();

    // Trigger escalation cycle
    let reminders50 = 0;
    let reminders90 = 0;
    let overdueCount = 0;
    let escalatedL2 = 0;

    complaints.forEach(c => {
      if (c.status !== 'CLOSED' && c.status !== 'RESOLVED') {
        const deadline = new Date(c.sla_deadline);
        if (simulatedNow > deadline) {
          c.is_overdue = true;
          overdueCount++;
          if (c.escalation_level < 2) {
            c.escalation_level = 2;
            c.status = 'ESCALATED';
            escalatedL2++;
            appendAudit('complaint', c.id, 'ESCALATED_TO_L2', 'SYSTEM', { reason: 'SLA overdue after simulated time advance' });
          }
        } else {
          reminders50++;
        }
      }
    });

    res.json({
      status: 'SUCCESS',
      advanced_hours: hours,
      total_offset_hours: Math.round((clockOffsetSeconds / 3600) * 10) / 10,
      current_simulated_time: simulatedNow.toISOString(),
      escalation_summary: {
        reminders_50: reminders50,
        reminders_90: reminders90,
        overdue_count: overdueCount,
        escalated_l2: escalatedL2,
        escalated_l3: 0,
        escalated_l4: 0,
        reassigned_on_leave: 0
      }
    });
  });

  app.post('/api/demo/reset-time', (_req, res) => {
    clockOffsetSeconds = 0;
    res.json({
      status: 'SUCCESS',
      message: 'Simulated clock reset to real system time.',
      current_time: new Date().toISOString()
    });
  });

  app.post('/api/demo/reseed', (_req, res) => {
    seedData();
    res.json({ status: 'SUCCESS', message: 'Database reset and re-seeded with 40 complaints.' });
  });

  app.post('/api/demo/tamper-audit', (_req, res) => {
    if (auditLog.length > 0) {
      const last = auditLog[auditLog.length - 1];
      last.payload = { ...last.payload, TAMPERED_BY_DEMO: true, notes: 'MALICIOUS MODIFICATION IN DATABASE' };
      return res.json({ status: 'SUCCESS', message: `Record #${last.id} payload tampered. Verify chain will now detect corruption!` });
    }
    res.json({ status: 'FAILED', message: 'No records to tamper' });
  });

  app.post('/api/demo/repair-audit', (_req, res) => {
    let expectedPrev = GENESIS_HASH;
    auditLog.forEach(rec => {
      rec.prev_hash = expectedPrev;
      rec.entry_hash = calculateEntryHash(expectedPrev, rec.entity_type, rec.entity_id, rec.action, rec.actor_id, JSON.stringify(rec.payload), rec.timestamp);
      expectedPrev = rec.entry_hash;
    });
    res.json({ status: 'SUCCESS', message: `Repaired cryptographic chain for ${auditLog.length} audit records.` });
  });

  app.get('/api/demo/audit-verify', (_req, res) => {
    let expectedPrev = GENESIS_HASH;
    for (const rec of auditLog) {
      if (rec.prev_hash !== expectedPrev) {
        return res.json({
          is_valid: false,
          corrupted_record_id: rec.id,
          message: `Chain linkage broken at record #${rec.id}: expected prev_hash ${expectedPrev.substring(0, 8)}..., found ${rec.prev_hash.substring(0, 8)}...`
        });
      }
      const computed = calculateEntryHash(expectedPrev, rec.entity_type, rec.entity_id, rec.action, rec.actor_id, JSON.stringify(rec.payload), rec.timestamp);
      if (computed !== rec.entry_hash) {
        return res.json({
          is_valid: false,
          corrupted_record_id: rec.id,
          message: `Tamper detected in record #${rec.id}: computed hash ${computed.substring(0, 8)}... does not match recorded ${rec.entry_hash.substring(0, 8)}...`
        });
      }
      expectedPrev = rec.entry_hash;
    }
    res.json({
      is_valid: true,
      corrupted_record_id: null,
      message: `All ${auditLog.length} audit records verified successfully. Chain is unbroken.`
    });
  });

  // 12. Static Assets & Pages
  app.use('/static', express.static(path.join(__dirname, 'static')));
  app.use('/pages', express.static(path.join(__dirname, 'pages')));

  // 13. Vite SPA Handling
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================================`);
    console.log(` JanaDhwani Full-Stack Portal Live on Port ${PORT}`);
    console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(` In-Process Grievance Engine: ACTIVE`);
    console.log(` Seeded Records: ${complaints.length} complaints, ${auditLog.length} audit blocks`);
    console.log(`========================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

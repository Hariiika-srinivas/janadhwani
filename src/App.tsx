import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, ShieldAlert, CheckCircle, Clock, AlertTriangle,
  Building, Search, RefreshCw, Send, Lock, User, FileText, ArrowRight,
  TrendingUp, BarChart3, MapPin, Eye, Play, Award, Check, X, QrCode,
  Flame, ChevronRight, PhoneCall, Sparkles, Download, Layers, ShieldCheck,
  Printer, Square, VolumeX, Pause, HeartPulse, Stethoscope
} from 'lucide-react';

type TabType = 'voice' | 'kiosk' | 'status' | 'officer' | 'dashboard' | 'transparency' | 'admin' | 'demo';

interface Organization {
  id: number;
  name: string;
  kannada_name: string;
  district: string;
  department_code: string;
}

interface Ward {
  id: number;
  name: string;
  kannada_name: string;
  is_vulnerable: boolean;
}

interface Officer {
  id: number;
  name: string;
  kannada_name: string;
  designation: string;
  role: string;
  level: number;
  username: string;
  department_code: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('voice');
  const [lang, setLang] = useState<'kn' | 'en'>('kn');

  // Organizations & Wards (100% Pure Government Hospitals)
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<number>(1); // Kalaburagi default
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<number>(1);
  const [allOfficers, setAllOfficers] = useState<Officer[]>([]);

  // Voice State & Synthesis
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("ಹೆರಿಗೆ ವಾರ್ಡ್‌ನಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿನ ಫಿಲ್ಟರ್ ಕೆಟ್ಟುಹೋಗಿದೆ, ರೋಗಿಗಳಿಗೆ ಕುಡಿಯಲು ನೀರಿಲ್ಲ");
  const [citizenName, setCitizenName] = useState("Kavita Bai");
  const [citizenPhone, setCitizenPhone] = useState("9845012345");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<any>(null);

  // Audio Playback State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudioText, setCurrentAudioText] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Status Search
  const [searchId, setSearchId] = useState("JD-2026-1001");
  const [complaintDetails, setComplaintDetails] = useState<any>(null);
  const [verificationFeedback, setVerificationFeedback] = useState("");
  const [statusSearchLoading, setStatusSearchLoading] = useState(false);

  // Kiosk Modal State
  const [kioskModalItem, setKioskModalItem] = useState<any>(null);
  const [kioskSuccessSlip, setKioskSuccessSlip] = useState<any>(null);

  // Officer Portal State
  const [officerUser, setOfficerUser] = useState<any>({
    id: 1,
    name: "Dr. Sneha Kulkarni",
    role: "OFFICER",
    level: 1,
    designation: "Duty Medical Officer L1",
    org_name: "District Hospital Kalaburagi",
    department_code: "HEALTH"
  });
  const [officerQueue, setOfficerQueue] = useState<any[]>([]);
  const [selectedComplaintForAction, setSelectedComplaintForAction] = useState<any>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionType, setActionType] = useState<string>("RESOLVED");
  const [snoozeHours, setSnoozeHours] = useState<number>(24);
  const [reassignOfficerId, setReassignOfficerId] = useState<number>(2);

  // Dashboard Data
  const [kpiSummary, setKpiSummary] = useState<any>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [hospitalScores, setHospitalScores] = useState<any[]>([]);
  const [earlyWarnings, setEarlyWarnings] = useState<any[]>([]);
  const [overdueList, setOverdueList] = useState<any[]>([]);

  // Transparency Data
  const [transparencyList, setTransparencyList] = useState<any[]>([]);
  const [transparencyFilter, setTransparencyFilter] = useState<string>("ALL");
  const [transparencySearch, setTransparencySearch] = useState<string>("");

  // Demo Controls State
  const [simulatedTime, setSimulatedTime] = useState<string>("");
  const [demoLog, setDemoLog] = useState<string[]>([]);
  const [auditStatus, setAuditStatus] = useState<any>(null);

  // Admin Poster State
  const [posterOrgId, setPosterOrgId] = useState<number>(1);
  const [posterWardId, setPosterWardId] = useState<number>(1);

  // Speech Recognition ref
  const recognitionRef = useRef<any>(null);

  // Helper to convert technical strings to pure, natural Kannada audio
  const toKannadaAudioPhrase = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/JD-2026-(\d+)/g, (_m, d) => `ಜೆ ಡಿ ೨೦೨೬ ${d}`)
      .replace(/SUBMITTED/g, 'ದೂರು ದಾಖಲಾಗಿದೆ')
      .replace(/ASSIGNED/g, 'ಕರ್ತವ್ಯ ವೈದ್ಯಾಧಿಕಾರಿಗೆ ವಹಿಸಲಾಗಿದೆ')
      .replace(/IN_PROGRESS/g, 'ಸ್ಥಳ ಪರಿಶೀಲನೆ ಮತ್ತು ದುರಸ್ತಿ ಪ್ರಗತಿಯಲ್ಲಿದೆ')
      .replace(/RESOLVED/g, 'ಸಮಸ್ಯೆ ಪರಿಹಾರವಾಗಿದೆ, ನಿಮ್ಮ ಪರಿಶೀಲನೆಗೆ ಕಾಯುತ್ತಿದೆ')
      .replace(/CLOSED/g, 'ಮುಕ್ತಾಯಗೊಂಡಿದೆ')
      .replace(/ESCALATED/g, 'ಮೇಲ್ವಿಚಾರಕ ಜಿಲ್ಲಾ ವೈದ್ಯಾಧಿಕಾರಿಗಳಿಗೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ')
      .replace(/REOPENED/g, 'ಮರುತೆರೆಯಲಾಗಿದೆ')
      .replace(/HIGH/g, 'ಹೆಚ್ಚಿನ ತುರ್ತು')
      .replace(/MEDIUM/g, 'ಮಧ್ಯಮ ತುರ್ತು')
      .replace(/NORMAL/g, 'ಸಾಮಾನ್ಯ');
  };

  // 1. Initial Load & Voice List Listener
  useEffect(() => {
    fetchOrganizations();
    loadDashboardData();
    checkAuditChain();
    loadOfficers();

    // Cache available speech voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setAvailableVoices(v);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchWards(selectedOrg);
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (activeTab === 'officer') {
      loadOfficerQueue();
    } else if (activeTab === 'transparency') {
      loadTransparencyData();
    }
  }, [activeTab]);

  // Load organizations (purely Government Hospitals)
  const fetchOrganizations = async () => {
    try {
      const res = await fetch(`/api/orgs?dept=HEALTH`);
      const data = await res.json();
      setOrganizations(data);
      if (data.length > 0) {
        setSelectedOrg(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWards = async (orgId: number) => {
    try {
      const res = await fetch(`/api/wards?org_id=${orgId}`);
      const data = await res.json();
      setWards(data);
      if (data.length > 0) {
        setSelectedWard(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadOfficers = async () => {
    try {
      const res = await fetch(`/api/officers/list?dept=HEALTH`);
      const data = await res.json();
      setAllOfficers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [sumRes, catRes, scoresRes, warnRes, overRes] = await Promise.all([
        fetch(`/api/dashboard/summary?dept=HEALTH`).then(r => r.json()),
        fetch(`/api/dashboard/by-category?dept=HEALTH`).then(r => r.json()),
        fetch(`/api/dashboard/hospital-scores`).then(r => r.json()),
        fetch(`/api/dashboard/early-warnings`).then(r => r.json()),
        fetch(`/api/dashboard/overdue?dept=HEALTH`).then(r => r.json())
      ]);
      setKpiSummary(sumRes);
      setCategoryBreakdown(catRes);
      setHospitalScores(scoresRes);
      setEarlyWarnings(warnRes);
      setOverdueList(overRes);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    }
  };

  const loadOfficerQueue = async () => {
    try {
      const res = await fetch(`/api/officer/complaints?department=HEALTH`);
      const data = await res.json();
      setOfficerQueue(data);
    } catch (e) {
      console.error("Officer queue error:", e);
    }
  };

  const loadTransparencyData = async () => {
    try {
      const res = await fetch(`/api/transparency/complaints?dept=HEALTH`);
      const data = await res.json();
      setTransparencyList(data);
    } catch (e) {
      console.error("Transparency fetch error:", e);
    }
  };

  const checkAuditChain = async () => {
    try {
      const res = await fetch('/api/demo/audit-verify');
      const data = await res.json();
      setAuditStatus(data);
    } catch (e) {
      console.error("Audit check error:", e);
    }
  };

  // 100% Pure Kannada Speech Synthesis
  const speakText = (text: string, speechLang: 'kn' | 'en' = 'kn') => {
    if (!text || typeof window === 'undefined') return;

    const finalText = speechLang === 'kn' ? toKannadaAudioPhrase(text) : text;
    setCurrentAudioText(finalText);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(finalText);
      utter.rate = speechLang === 'kn' ? 0.90 : 0.95;
      utter.pitch = 1.0;

      const currentVoices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();

      if (speechLang === 'kn') {
        // Priority 1: Native Kannada voice
        let matched = currentVoices.find(v =>
          v.lang.toLowerCase().startsWith('kn') ||
          v.name.toLowerCase().includes('kannada')
        );
        // Priority 2: Indian phonetic voices (Hindi, Telugu, Marathi naturally pronounce Kannada)
        if (!matched) {
          matched = currentVoices.find(v =>
            v.lang.toLowerCase().startsWith('hi') ||
            v.lang.toLowerCase().startsWith('te') ||
            v.lang.toLowerCase().startsWith('ta') ||
            v.lang.toLowerCase().startsWith('mr') ||
            v.name.toLowerCase().includes('india')
          );
        }
        // Priority 3: Indian English voice
        if (!matched) {
          matched = currentVoices.find(v => v.lang.toLowerCase() === 'en-in');
        }

        if (matched) {
          utter.voice = matched;
          utter.lang = matched.lang;
        } else {
          utter.lang = 'kn-IN';
        }
      } else {
        const matched = currentVoices.find(v =>
          v.lang.toLowerCase() === 'en-in' ||
          v.name.toLowerCase().includes('india')
        ) || currentVoices.find(v => v.lang.toLowerCase().startsWith('en'));

        if (matched) {
          utter.voice = matched;
          utter.lang = matched.lang;
        } else {
          utter.lang = 'en-IN';
        }
      }

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utter);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Switch Language & Immediately Confirm in Spoken Voice
  const switchLanguage = (newLang: 'kn' | 'en') => {
    setLang(newLang);
    if (newLang === 'kn') {
      speakText('ಕನ್ನಡ ಭಾಷೆ ಆಯ್ಕೆಯಾಗಿದೆ. ಜನಧ್ವನಿ ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಗಳ ಸಾರ್ವಜನಿಕ ಕುಂದುಕೊರತೆ ನಿವಾರಣಾ ವೇದಿಕೆಗೆ ಸ್ವಾಗತ.', 'kn');
    } else {
      speakText('English language selected. Welcome to JanaDhwani Government Hospitals Public Grievance Platform.', 'en');
    }
  };

  // Toggle Voice Recognition
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert("Browser Speech Recognition not supported in this browser. Please type or use sample hospital grievances.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';

    rec.onresult = (event: any) => {
      let current = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        current += event.results[i][0].transcript;
      }
      setVoiceText(current);
    };

    rec.onerror = (e: any) => {
      console.warn("Speech recognition error:", e);
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  // Submit Complaint via Voice / Web
  const handleComplaintSubmit = async () => {
    if (!voiceText.trim()) {
      alert("Please enter or speak your hospital grievance details.");
      return;
    }

    const payload = {
      text: voiceText.trim(),
      organization_id: selectedOrg,
      ward_id: selectedWard,
      department_code: 'HEALTH',
      language: lang,
      channel: 'VOICE',
      phone: citizenPhone,
      citizen_name: citizenName,
      is_anonymous: isAnonymous
    };

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.is_emergency) {
        setEmergencyAlert(data);
        speakText(data.message_kn || data.message_en, 'kn');
        return;
      }

      setSubmissionResult(data);
      setEmergencyAlert(null);

      // ALWAYS announce in 100% natural Kannada when Kannada is selected!
      const currentOrg = organizations.find(o => o.id === selectedOrg);
      const hospitalNameKn = currentOrg?.kannada_name || 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ';
      const ackMessageKn = `ಜನಧ್ವನಿ: ನಿಮ್ಮ ದೂರು ಸಂಖ್ಯೆ ${data.public_id} ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ. ಆಸ್ಪತ್ರೆ: ${hospitalNameKn}. ನಿಯೋಜಿತ ಕರ್ತವ್ಯ ವೈದ್ಯಾಧಿಕಾರಿ: ${data.responsible_authority}. ನಿಗದಿತ ಪರಿಹಾರ ದಿನಾಂಕ: ${data.deadline}. ರೋಗಿಗಳ ಹಿತರಕ್ಷಣೆಗೆ ನಾವು ಬದ್ಧರಾಗಿದ್ದೇವೆ.`;

      speakText(lang === 'kn' ? ackMessageKn : (data.english_ack || ackMessageKn), lang);
      loadDashboardData();
    } catch (e: any) {
      alert("Submission error: " + e.message);
    }
  };

  // 1-Click Kiosk Quick Submission
  const handleKioskQuickSubmit = async (item: any) => {
    const payload = {
      text: item.text,
      organization_id: selectedOrg,
      ward_id: selectedWard,
      department_code: 'HEALTH',
      language: 'kn',
      channel: 'KIOSK',
      phone: '9845000000',
      citizen_name: 'ಆಸ್ಪತ್ರೆ ಕಿಯೋಸ್ಕ್ ನಾಗರಿಕ',
      is_anonymous: false
    };

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setKioskSuccessSlip(data);
      setKioskModalItem(null);

      // Announce completely in pure Kannada for rural & illiterate hospital visitors
      const currentHospital = organizations.find(o => o.id === selectedOrg)?.kannada_name || 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ';
      speakText(`ಜನಧ್ವನಿ: ನಿಮ್ಮ ${item.title} ದೂರು ಸಂಖ್ಯೆ ${data.public_id} ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ. ${currentHospital} ಕರ್ತವ್ಯ ವೈದ್ಯಾಧಿಕಾರಿಗಳು ತಕ್ಷಣ ಪರಿಶೀಲಿಸಲಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ರಸೀದಿ ಮುದ್ರಿಸಿಕೊಳ್ಳಿ.`, 'kn');
      loadDashboardData();
    } catch (e: any) {
      alert("Kiosk registration failed: " + e.message);
    }
  };

  // Status Search with Normalization & Pure Kannada Voice Output
  const handleSearchStatus = async (idToSearch?: string) => {
    let raw = (idToSearch || searchId).trim();
    if (!raw) return;

    // Auto-normalize if user typed just digits like "1001" or "1015"
    if (/^\d+$/.test(raw)) {
      raw = `JD-2026-${raw}`;
      setSearchId(raw);
    }

    setStatusSearchLoading(true);
    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(raw)}/status`);
      if (!res.ok) {
        alert(`ದೂರು ಸಂಖ್ಯೆ '${raw}' ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಸರಿಯಾದ ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ (ಉದಾ: JD-2026-1001).`);
        setStatusSearchLoading(false);
        return;
      }
      const data = await res.json();
      setComplaintDetails(data);
      setStatusSearchLoading(false);

      // Speak complete grievance details in pure Kannada if Kannada selected!
      if (lang === 'kn') {
        const c = data.complaint;
        const statusKn = c.status === 'RESOLVED' ? 'ಸಮಸ್ಯೆ ಪರಿಹಾರವಾಗಿದೆ, ನಿಮ್ಮ ಅನುಮೋದನೆಗೆ ಕಾಯುತ್ತಿದೆ' :
                         c.status === 'IN_PROGRESS' ? 'ದುರಸ್ತಿ ಮತ್ತು ಸ್ಥಳ ಪರಿಶೀಲನೆ ಪ್ರಗತಿಯಲ್ಲಿದೆ' :
                         c.status === 'CLOSED' ? 'ಪರಿಶೀಲಿಸಲ್ಪಟ್ಟು ಯಶಸ್ವಿಯಾಗಿ ಮುಕ್ತಾಯಗೊಂಡಿದೆ' :
                         c.status === 'ESCALATED' ? 'ಗಡುವು ಮೀರಿದ್ದರಿಂದ ಜಿಲ್ಲಾ ವೈದ್ಯಾಧಿಕಾರಿಗಳಿಗೆ ವರ್ಗಾಯಿಸಲಾಗಿದೆ' :
                         c.status === 'REOPENED' ? 'ದೂರನ್ನು ಮರುತೆರೆಯಲಾಗಿದೆ' : 'ದಾಖಲಾಗಿ ವೈದ್ಯಾಧಿಕಾರಿಗೆ ವಹಿಸಲಾಗಿದೆ';

        const speechKn = `ದೂರು ಸಂಖ್ಯೆ ${c.public_id}. ಆಸ್ಪತ್ರೆ: ${c.org_kn_name}. ವಾರ್ಡ್: ${c.ward_name}. ದೂರಿನ ವಿಷಯ: ${c.original_text}. ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: ${statusKn}. ಜವಾಬ್ದಾರಿಯುತ ವೈದ್ಯಾಧಿಕಾರಿ: ${c.officer_name}. ಪರಿಹಾರ ನೀಡಬೇಕಾದ ದಿನಾಂಕ: ${c.sla_deadline.substring(0, 10)}.`;
        speakText(speechKn, 'kn');
      } else {
        speakText(data.audio_text_en, 'en');
      }
    } catch (e: any) {
      alert("Status lookup error: " + e.message);
      setStatusSearchLoading(false);
    }
  };

  // Citizen Verification Action with Kannada voice confirmation
  const handleCitizenVerify = async (action: 'confirm' | 'reject') => {
    if (!complaintDetails?.complaint?.public_id) return;
    const pubId = complaintDetails.complaint.public_id;

    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(pubId)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: verificationFeedback || 'Citizen verified via hospital portal' })
      });
      const data = await res.json();
      alert(data.message_kn || data.message);

      // Voice acknowledgement in pure Kannada
      if (action === 'confirm') {
        speakText('ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಆಸ್ಪತ್ರೆ ದೂರು ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲಿಸಲ್ಪಟ್ಟು ಮುಕ್ತಾಯಗೊಂಡಿದೆ. ಉತ್ತಮ ಆರೋಗ್ಯ ಸೇವೆ ಒದಗಿಸಲು ನಿಮ್ಮ ಸಹಕಾರಕ್ಕೆ ಧನ್ಯವಾದಗಳು.', 'kn');
      } else {
        speakText('ದೂರನ್ನು ಮರುತೆರೆಯಲಾಗಿದೆ ಹಾಗೂ ಆಸ್ಪತ್ರೆಯ ಮೇಲ್ವಿಚಾರಕ ಜಿಲ್ಲಾ ವೈದ್ಯಾಧಿಕಾರಿಗಳಿಗೆ ಮತ್ತು ಅಧೀಕ್ಷಕರಿಗೆ ತುರ್ತಾಗಿ ವರ್ಗಾಯಿಸಲಾಗಿದೆ.', 'kn');
      }

      handleSearchStatus(pubId);
      loadDashboardData();
    } catch (e: any) {
      alert("Verification error: " + e.message);
    }
  };

  // Submit Rating with Kannada gratitude voice
  const handleRating = async (stars: number) => {
    if (!complaintDetails?.complaint?.public_id) return;
    const pubId = complaintDetails.complaint.public_id;
    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(pubId)}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, feedback: 'Rating from hospital portal' })
      });
      const data = await res.json();
      alert(`ಧನ್ಯವಾದಗಳು! ${stars} Star rating recorded.`);
      speakText(`ನಿಮ್ಮ ${stars} ಸ್ಟಾರ್ ರೇಟಿಂಗ್ ದಾಖಲಾಗಿದೆ. ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಗಳ ಸೇವೆಯನ್ನು ಸುಧಾರಿಸಲು ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಅತ್ಯಂತ ಅಮೂಲ್ಯವಾಗಿದೆ. ಧನ್ಯವಾದಗಳು!`, 'kn');
      loadDashboardData();
    } catch (e: any) {
      console.error(e);
    }
  };

  // Speak Live Hospital Performance Dashboard in Pure Kannada
  const speakDashboardSummary = () => {
    if (!kpiSummary) return;
    const total = kpiSummary.total_complaints || 40;
    const resolved = kpiSummary.resolved_complaints || 28;
    const pending = kpiSummary.pending_complaints || 12;
    const overdue = kpiSummary.overdue_complaints || 0;
    const rate = kpiSummary.resolution_rate_pct || 70;

    const speechKn = `ಕಲ್ಯಾಣ ಕರ್ನಾಟಕದ ೫ ಜಿಲ್ಲಾ ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಗಳ ಒಟ್ಟಾರೆ ಕಾರ್ಯಕ್ಷಮತೆ ವರದಿ: ಒಟ್ಟು ${total} ಸಾರ್ವಜನಿಕ ದೂರುಗಳು ದಾಖಲಾಗಿವೆ. ಇದರಲ್ಲಿ ${resolved} ದೂರುಗಳು ಸ್ಥಳದಲ್ಲಿಯೇ ಯಶಸ್ವಿಯಾಗಿ ಪರಿಹಾರವಾಗಿದ್ದು, ಒಟ್ಟಾರೆ ಪರಿಹಾರ ದರ ಶೇಕಡಾ ${rate} ಆಗಿದೆ. ಪ್ರಸ್ತುತ ${pending} ದೂರುಗಳು ಪರಿಶೀಲನೆಯಲ್ಲಿದ್ದು, ${overdue} ದೂರುಗಳು ಗಡುವು ಮೀರಿದ್ದರಿಂದ ಜಿಲ್ಲಾ ವೈದ್ಯಾಧಿಕಾರಿಗಳ ಮೇಲ್ವಿಚಾರಣೆಗೆ ವರ್ಗಾಯಿಸಲ್ಪಟ್ಟಿವೆ. ರಾಯಚೂರು, ಕಲಬುರಗಿ, ಬೀದರ್, ಕೊಪ್ಪಳ ಮತ್ತು ಯಾದಗಿರಿ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ ಗುಣಮಟ್ಟದ ಚಿಕಿತ್ಸೆ ಖಾತರಿಪಡಿಸಲಾಗುತ್ತಿದೆ.`;

    speakText(lang === 'kn' ? speechKn : `Performance report of 5 district hospitals across Kalyana Karnataka: Total ${total} grievances recorded, ${resolved} resolved with ${rate}% resolution rate.`, lang);
  };

  // Officer Action Handler (Resolve / In Progress / Note / Snooze / Reassign)
  const handleOfficerActionSubmit = async () => {
    if (!selectedComplaintForAction) return;

    try {
      if (actionType === 'SNOOZE') {
        const res = await fetch(`/api/complaints/${selectedComplaintForAction.public_id}/snooze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hours: snoozeHours,
            reason: actionNotes || 'Awaiting specialist medical equipment arrival',
            officer_id: officerUser.id
          })
        });
        const data = await res.json();
        alert(data.message);
      } else if (actionType === 'REASSIGN') {
        const res = await fetch(`/api/complaints/${selectedComplaintForAction.public_id}/reassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_officer_id: reassignOfficerId,
            reason: actionNotes || 'Transferred for specialised clinical review',
            actor_id: officerUser.id
          })
        });
        const data = await res.json();
        alert(data.message);
      } else {
        const res = await fetch(`/api/complaints/${selectedComplaintForAction.id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_type: actionType,
            notes: actionNotes || 'Hospital ward inspection and clinical repair executed.',
            officer_id: officerUser.id,
            photo_url: actionType === 'RESOLVED' ? '/static/uploads/water_filter_fixed.jpg' : null,
            location_gps: '16.2076, 77.3463'
          })
        });
        const data = await res.json();
        alert(data.message);
      }

      setSelectedComplaintForAction(null);
      setActionNotes("");
      loadOfficerQueue();
      loadDashboardData();
    } catch (e: any) {
      alert("Action error: " + e.message);
    }
  };

  // Demo Time Travel
  const handleAdvanceTime = async (hours: number) => {
    try {
      const res = await fetch('/api/demo/advance-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      });
      const data = await res.json();
      setSimulatedTime(data.current_simulated_time);
      const log = `Advanced +${hours}h: Reminders 50% (${data.escalation_summary.reminders_50}), Reminders 90% (${data.escalation_summary.reminders_90}), Overdue (${data.escalation_summary.overdue_count}), Escalated (${data.escalation_summary.escalated_l2 + data.escalation_summary.escalated_l3})`;
      setDemoLog(prev => [log, ...prev]);
      loadDashboardData();
      loadOfficerQueue();
      checkAuditChain();
    } catch (e: any) {
      alert("Time travel error: " + e.message);
    }
  };

  const handleTamper = async () => {
    const res = await fetch('/api/demo/tamper-audit', { method: 'POST' });
    const data = await res.json();
    alert("⚠️ " + data.message);
    checkAuditChain();
  };

  const handleRepair = async () => {
    const res = await fetch('/api/demo/repair-audit', { method: 'POST' });
    const data = await res.json();
    alert("✓ " + data.message);
    checkAuditChain();
  };

  const switchOfficerPersona = (username: string, designation: string, level: number, role: string, orgName: string) => {
    setOfficerUser({
      id: level,
      username,
      designation,
      level,
      role,
      name: username.replace('_', ' ').toUpperCase(),
      org_name: orgName,
      department_code: 'HEALTH'
    });
  };

  // Filtered Transparency complaints
  const filteredTransparency = transparencyList.filter(c => {
    if (transparencyFilter !== 'ALL' && c.status !== transparencyFilter) return false;
    if (transparencySearch.trim()) {
      const q = transparencySearch.toLowerCase();
      return (
        c.public_id.toLowerCase().includes(q) ||
        c.category_name.toLowerCase().includes(q) ||
        c.organization_name.toLowerCase().includes(q) ||
        c.original_text.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. TOP BAR CONTRACT: Single text brand — clean text links — 1 primary action */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Zone: 1 single text element */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-base shadow-xs">
              ಜ
            </span>
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              JanaDhwani <span className="text-teal-400 font-normal text-xs ml-1">ಜನಧ್ವನಿ</span>
            </span>
          </div>

          {/* Clean single-line text nav links */}
          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-300">
            <button
              onClick={() => setActiveTab('voice')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'voice' ? 'text-teal-400 font-bold border-b-2 border-teal-400' : ''}`}
            >
              {lang === 'kn' ? 'ಧ್ವನಿ ದೂರು' : 'Voice Intake'}
            </button>
            <button
              onClick={() => setActiveTab('kiosk')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'kiosk' ? 'text-teal-400 font-bold border-b-2 border-teal-400' : ''}`}
            >
              {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆ ಕಿಯೋಸ್ಕ್' : 'Hospital Kiosk'}
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'status' ? 'text-teal-400 font-bold border-b-2 border-teal-400' : ''}`}
            >
              {lang === 'kn' ? 'ಸ್ಥಿತಿ & ಪರಿಶೀಲನೆ' : 'Status & Verification'}
            </button>
            <button
              onClick={() => setActiveTab('officer')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'officer' ? 'text-teal-400 font-bold border-b-2 border-teal-400' : ''}`}
            >
              {lang === 'kn' ? 'ವೈದ್ಯಾಧಿಕಾರಿ ಸರತಿ' : 'Doctor Queue'}
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'dashboard' ? 'text-teal-400 font-bold border-b-2 border-teal-400' : ''}`}
            >
              {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' : 'Hospital Dashboard'}
            </button>
            <button
              onClick={() => setActiveTab('transparency')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'transparency' ? 'text-teal-400 font-bold border-b-2 border-teal-400' : ''}`}
            >
              {lang === 'kn' ? 'ಪಾರದರ್ಶಕತೆ' : 'Transparency'}
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'admin' ? 'text-teal-400 font-bold border-b-2 border-teal-400' : ''}`}
            >
              {lang === 'kn' ? 'ವಾರ್ಡ್ ಕ್ಯೂಆರ್' : 'Ward Posters'}
            </button>
            <button
              onClick={() => setActiveTab('demo')}
              className={`hover:text-white transition whitespace-nowrap pb-1 ${activeTab === 'demo' ? 'text-amber-400 font-bold border-b-2 border-amber-400' : ''}`}
            >
              ⚡ {lang === 'kn' ? 'ಸಾಲ್ವಥಾನ್ ಡೆಮೊ' : 'Solvathon Demo'}
            </button>
          </nav>

          {/* Action Zone: Language toggle & Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                onClick={() => switchLanguage('kn')}
                className={`px-3 py-1 rounded font-bold transition cursor-pointer ${lang === 'kn' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                title="ಕನ್ನಡ ಧ್ವನಿ ಮತ್ತು ಇಂಟರ್ಫೇಸ್ ಸಕ್ರಿಯಗೊಳಿಸಿ"
              >
                🔊 ಕನ್ನಡ
              </button>
              <button
                onClick={() => switchLanguage('en')}
                className={`px-3 py-1 rounded font-bold transition cursor-pointer ${lang === 'en' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                title="Switch to English"
              >
                English
              </button>
            </div>

            <button
              onClick={() => setActiveTab('voice')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-xs transition whitespace-nowrap cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{lang === 'kn' ? 'ಧ್ವನಿ ದೂರು' : 'Record'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Audio Playing Notification Bar */}
      {isSpeaking && (
        <div className="bg-teal-900 text-teal-100 px-4 py-2 text-xs border-b border-teal-700 sticky top-16 z-40 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <Volume2 className="w-4 h-4 text-teal-400 animate-pulse shrink-0" />
            <span className="font-semibold text-teal-300 shrink-0">
              {lang === 'kn' ? '🔊 ಕನ್ನಡ ಧ್ವನಿ ಪ್ರಕಟಣೆ:' : 'Playing Voice Audio:'}
            </span>
            <span className="truncate italic text-teal-100">{currentAudioText}</span>
          </div>
          <button
            onClick={stopSpeaking}
            className="px-2.5 py-0.5 bg-teal-800 hover:bg-teal-700 text-white rounded text-[11px] font-bold shrink-0 ml-2 cursor-pointer"
          >
            {lang === 'kn' ? 'ನಿಲ್ಲಿಸಿ (Stop)' : 'Stop Audio'}
          </button>
        </div>
      )}

      {/* Emergency Global Banner if detected */}
      {emergencyAlert && (
        <div className="bg-red-600 text-white px-4 py-4 shadow-xl sticky top-16 z-50 animate-pulse">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-white shrink-0" />
              <div>
                <h3 className="font-black text-lg">⚠️ {emergencyAlert.message_kn}</h3>
                <p className="text-xs text-red-100">{emergencyAlert.message_en}</p>
              </div>
            </div>
            <a
              href="tel:108"
              className="px-5 py-2.5 bg-white text-red-700 font-black text-sm rounded-xl shadow-lg flex items-center gap-2 hover:bg-red-50 shrink-0"
            >
              <PhoneCall className="w-4 h-4" /> 108 ತುರ್ತು ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗೆ ಕರೆ ಮಾಡಿ
            </a>
          </div>
        </div>
      )}

      {/* Pure Government Hospital Subheader Banner */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
              <HeartPulse className="w-4 h-4 text-teal-700" />
            </span>
            <span className="font-bold text-slate-800">
              {lang === 'kn'
                ? 'ಕರ್ನಾಟಕ ಸರ್ಕಾರ · ಆರೋಗ್ಯ ಮತ್ತು ಕುಟುಂಬ ಕಲ್ಯಾಣ ಇಲಾಖೆ · ಕಲ್ಯಾಣ ಕರ್ನಾಟಕ ಸರ್ಕಾರಿ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗಳು'
                : 'Govt of Karnataka · Health & Family Welfare · Kalyana Karnataka District Hospitals'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
            {simulatedTime ? (
              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ⏱️ Simulated: {simulatedTime.substring(0, 16).replace('T', ' ')}
              </span>
            ) : (
              <span>UTC Active Hospital Clock</span>
            )}
            <span className="hidden sm:inline">·</span>
            <span className={auditStatus?.is_valid ? 'text-emerald-700 font-semibold' : 'text-red-700 font-bold'}>
              🛡️ Audit: {auditStatus?.is_valid ? 'SHA-256 Unbroken' : 'Tamper Detected!'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {/* ================================================================= */}
        {/* TAB 1: CITIZEN VOICE GRIEVANCE (/voice) */}
        {/* ================================================================= */}
        {activeTab === 'voice' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {lang === 'kn' ? 'ಧ್ವನಿಯ ಮೂಲಕ ನಿಮ್ಮ ಆಸ್ಪತ್ರೆ ದೂರನ್ನು ಸುಲಭವಾಗಿ ದಾಖಲಿಸಿ' : 'Record Your Hospital Grievance via Voice'}
                </h2>
                <p className="text-slate-600 text-xs sm:text-sm mt-1">
                  {lang === 'kn'
                    ? 'ಕಲ್ಯಾಣ ಕರ್ನಾಟಕದ ಗ್ರಾಮೀಣ ರೋಗಿಗಳು ಹಾಗೂ ಹಿರಿಯ ನಾಗರಿಕರಿಗಾಗಿ ಸರಳ ಧ್ವನಿ ವ್ಯವಸ್ಥೆ'
                    : 'Accessible, multilingual grievance intake designed for Kalyana Karnataka district hospital patients'}
                </p>
              </div>

              {/* Hospital & Ward Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'kn' ? 'ಸರ್ಕಾರಿ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ:' : 'Government District Hospital:'}
                  </label>
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-teal-600"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {lang === 'kn' ? org.kannada_name : org.name} ({org.district})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆಯ ವಾರ್ಡ್ / ಚಿಕಿತ್ಸಾ ವಿಭಾಗ:' : 'Hospital Ward / Clinical Unit:'}
                  </label>
                  <select
                    value={selectedWard}
                    onChange={(e) => setSelectedWard(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-teal-600"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {lang === 'kn' ? w.kannada_name : w.name} {w.is_vulnerable ? '★ (+25 pts Priority)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Big Voice Microphone Button */}
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mb-6">
                <button
                  onClick={toggleRecording}
                  className={`w-20 h-20 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95 text-white cursor-pointer ${
                    isRecording ? 'bg-red-600 animate-pulse' : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                  title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                <span className="text-sm font-semibold text-slate-700 mt-3">
                  {isRecording
                    ? (lang === 'kn' ? 'ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ... ಮಾತನಾಡಿ' : 'Listening... please speak')
                    : (lang === 'kn' ? 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಲು ಪ್ರಾರಂಭಿಸಿ' : 'Click microphone to speak')}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  ಕನ್ನಡ (Kannada) / English supported
                </span>
              </div>

              {/* Editable Transcript */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {lang === 'kn' ? 'ದೂರಿನ ವಿವರ (Transcript - ಪರಿಶೀಲಿಸಿ ಅಥವಾ ತಿದ್ದಿ):' : 'Complaint Transcript (Edit if needed):'}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => speakText(voiceText, 'kn')}
                      className="text-xs text-teal-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      title="Play in Kannada"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> 🔊 ಕನ್ನಡ ಧ್ವನಿ
                    </button>
                    <button
                      onClick={() => speakText(voiceText, 'en')}
                      className="text-xs text-slate-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      title="Play in English"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> English
                    </button>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-600 focus:bg-white transition"
                  placeholder="ಮಾತನಾಡಿದ ದೂರು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ..."
                />
              </div>

              {/* Quick Sample Prompts for Testing (100% Hospital Issues) */}
              <div className="mb-6">
                <span className="text-xs font-semibold text-slate-500 block mb-2">
                  {lang === 'kn' ? 'ಪರೀಕ್ಷಾರ್ಥ ಆಸ್ಪತ್ರೆ ಮಾದರಿ ದೂರುಗಳು (Sample Grievances):' : 'Sample Hospital Grievances:'}
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => {
                      const t = "ಹೆರಿಗೆ ವಾರ್ಡ್‌ನಲ್ಲಿ ಕುಡಿಯುವ ನೀರಿನ ಫಿಲ್ಟರ್ ಕೆಟ್ಟುಹೋಗಿದೆ, ರೋಗಿಗಳಿಗೆ ಕುಡಿಯಲು ನೀರಿಲ್ಲ";
                      setVoiceText(t);
                      speakText(t, 'kn');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    🚰 ಕುಡಿಯುವ ನೀರು (Water)
                  </button>
                  <button
                    onClick={() => {
                      const t = "ವೈದ್ಯರು ಬಂದಿಲ್ಲ ರೋಗಿಗಳು ೪ ಗಂಟೆಯಿಂದ ಕಾಯುತ್ತಿದ್ದಾರೆ";
                      setVoiceText(t);
                      speakText(t, 'kn');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    👨‍⚕️ ವೈದ್ಯರು ಗೈರು (Doctor Absent)
                  </button>
                  <button
                    onClick={() => {
                      const t = "ಔಷಧಾಲಯದಲ್ಲಿ ಇನ್ಸುಲಿನ್ ಮತ್ತು ಬಿಪಿ ಮಾತ್ರೆಗಳ ಕೊರತೆ ಇದೆ";
                      setVoiceText(t);
                      speakText(t, 'kn');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    💊 ಔಷಧಿ ಕೊರತೆ (Medicine)
                  </button>
                  <button
                    onClick={() => {
                      const t = "ಮಕ್ಕಳ ವಾರ್ಡ್ ಶೌಚಾಲಯ ಸ್ವಚ್ಛತೆ ಇಲ್ಲ, ದುರ್ನಾತ ಬರುತ್ತಿದೆ";
                      setVoiceText(t);
                      speakText(t, 'kn');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
                  >
                    🧹 ಸ್ವಚ್ಛತೆ ಕೊರತೆ (Hygiene)
                  </button>
                  <button
                    onClick={() => {
                      const t = "ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗದಲ್ಲಿ ಆಂಬ್ಯುಲೆನ್ಸ್ ಚಾಲಕ ಲಭ್ಯವಿಲ್ಲ";
                      setVoiceText(t);
                      speakText(t, 'kn');
                    }}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg text-amber-900 font-medium cursor-pointer"
                  >
                    🚑 ಆಂಬ್ಯುಲೆನ್ಸ್ ತಡ (Ambulance)
                  </button>
                  <button
                    onClick={() => {
                      const t = "ನನಗೆ ಎದೆ ನೋವು ಬರುತ್ತಿದೆ ತಕ್ಷಣ ಬನ್ನಿ";
                      setVoiceText(t);
                      speakText(t, 'kn');
                    }}
                    className="px-2.5 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-red-800 font-bold cursor-pointer"
                  >
                    🚨 ತುರ್ತು ಎದೆ ನೋವು (108 Emergency)
                  </button>
                </div>
              </div>

              {/* Citizen Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'kn' ? 'ನಿಮ್ಮ ಹೆಸರು:' : 'Citizen Name:'}
                  </label>
                  <input
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'kn' ? 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ (SMS ಗಾಗಿ):' : 'Phone Number (SMS updates):'}
                  </label>
                  <input
                    type="tel"
                    value={citizenPhone}
                    onChange={(e) => setCitizenPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <input
                  type="checkbox"
                  id="anon"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-teal-600"
                />
                <label htmlFor="anon" className="text-xs text-slate-600">
                  {lang === 'kn'
                    ? 'ಅನಾಮಧೇಯವಾಗಿ ದೂರು ದಾಖಲಿಸಿ (ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ಗೂಢಲಿಪೀಕರಿಸಲಾಗುತ್ತದೆ)'
                    : 'Submit anonymously (phone stored only as irreversible salted hash)'}
                </label>
              </div>

              <button
                onClick={handleComplaintSubmit}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl shadow-sm transition text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {lang === 'kn' ? 'ದೂರು ಸಲ್ಲಿಸಿ (Submit Hospital Grievance)' : 'Register Grievance'}
              </button>
            </div>

            {/* Submission Output Card with Pure Kannada Voice */}
            {submissionResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-950">
                      {submissionResult.is_duplicate ? 'ದೂರು ಲಿಂಕ್ ಆಗಿದೆ & ಆದ್ಯತೆ ಹೆಚ್ಚಿಸಲಾಗಿದೆ!' : 'ದೂರು ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ!'}
                    </h3>
                    <p className="text-xs text-emerald-800 font-mono font-bold">Public ID: {submissionResult.public_id}</p>
                  </div>
                </div>

                <div className="bg-white/80 p-4 rounded-xl border border-emerald-200 mb-4 space-y-2">
                  <div className="text-xs text-emerald-950 font-medium">
                    <span className="font-bold text-emerald-800">ಕನ್ನಡ ಧ್ವನಿ ಸಂದೇಶ:</span> {submissionResult.kannada_ack}
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-slate-700">English:</span> {submissionResult.english_ack}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white/70 p-3 rounded-xl border border-emerald-200 mb-4">
                  <div>
                    <span className="text-slate-500 block">Category:</span>
                    <span className="font-bold text-slate-900">{submissionResult.category_kannada || submissionResult.category_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Authority:</span>
                    <span className="font-bold text-slate-900">{submissionResult.responsible_authority || 'Duty Medical Officer'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Target SLA:</span>
                    <span className="font-bold text-slate-900 font-mono">{submissionResult.deadline}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Priority Score:</span>
                    <span className="font-bold text-emerald-700 font-mono text-sm">{submissionResult.priority_score}/100</span>
                  </div>
                </div>

                {/* Spoken Voice Controls */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
                  <button
                    onClick={() => speakText(submissionResult.kannada_ack, 'kn')}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> 🔊 ಕನ್ನಡದಲ್ಲಿ ಆಲಿಸಿ (Play in Kannada)
                  </button>

                  <button
                    onClick={() => speakText(submissionResult.english_ack, 'en')}
                    className="px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> 🔊 Listen in English
                  </button>

                  <button
                    onClick={() => {
                      setSearchId(submissionResult.public_id);
                      setActiveTab('status');
                      handleSearchStatus(submissionResult.public_id);
                    }}
                    className="ml-auto text-xs font-bold text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" /> ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ (Track Status)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: VISUAL KIOSK (/kiosk) */}
        {/* ================================================================= */}
        {activeTab === 'kiosk' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-extrabold text-slate-900">
                {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆ ಕಿಯೋಸ್ಕ್ - ದೃಶ್ಯ ಐಕಾನ್ ಮೂಲಕ ೧-ಕ್ಲಿಕ್ ದೂರು' : 'Hospital Touchscreen Kiosk'}
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                {lang === 'kn'
                  ? 'ಓದಲು-ಬರೆಯಲು ಬಾರದ ಗ್ರಾಮೀಣ ರೋಗಿಗಳಿಗೆ ದೊಡ್ಡ ಚಿತ್ರಗಳ ಮೂಲಕ ಸುಲಭ ನೋಂದಣಿ ಹಾಗೂ ಕನ್ನಡ ಧ್ವನಿ'
                  : 'Icon-driven touchscreen flow for rural and non-literate patients with instant spoken Kannada voice feedback'}
              </p>
            </div>

            {/* Hospital Selector for Kiosk */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-700">
                {lang === 'kn' ? 'ಪ್ರಸ್ತುತ ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆ ಸ್ಥಳ:' : 'Hospital Kiosk Location:'}
              </span>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(parseInt(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.kannada_name} — {org.district}
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Hospital Icon Grid (100% Hospital) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {[
                { icon: '🚰', title: 'ಕುಡಿಯುವ ನೀರು / ಶೌಚಾಲಯ', sub: 'Drinking Water & Toilet', text: 'ಆಸ್ಪತ್ರೆಯ ಕುಡಿಯುವ ನೀರಿನ ಪೂರೈಕೆ ಸ್ಥಗಿತಗೊಂಡಿದೆ ನಲ್ಲಿಗಳು ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ', cat: 'Drinking Water & Sanitation' },
                { icon: '💊', title: 'ಔಷಧಿ & ಇಂಜೆಕ್ಷನ್ ಸಿಗುತ್ತಿಲ್ಲ', sub: 'Medicine & Injection Shortage', text: 'ಔಷಧಾಲಯದಲ್ಲಿ ಮಾತ್ರೆಗಳು ಮತ್ತು ಸಿರಪ್ ಲಭ್ಯವಿಲ್ಲ ಔಷಧಿ ಕೊರತೆ ಇದೆ', cat: 'Medicine Shortage' },
                { icon: '🧹', title: 'ವಾರ್ಡ್ ಸ್ವಚ್ಛತೆ & ಕಸ', sub: 'Ward Hygiene & Cleanliness', text: 'ವಾರ್ಡ್‌ನಲ್ಲಿ ಕಸ ತುಂಬಿದ್ದು ದುರ್ನಾತ ಬರುತ್ತಿದೆ ಸ್ವಚ್ಛತೆ ಇಲ್ಲ', cat: 'Hygiene & Cleanliness' },
                { icon: '👨‍⚕️', title: 'ವೈದ್ಯರು / ನರ್ಸ್ ಬಂದಿಲ್ಲ', sub: 'Doctor & Nurse Absent', text: 'ವೈದ್ಯರು ಮತ್ತು ನರ್ಸ್ ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ಬಂದಿಲ್ಲ ರೋಗಿಗಳು ಕಾಯುತ್ತಿದ್ದಾರೆ', cat: 'Doctor/Staff Absent' },
                { icon: '🛏️', title: 'ಹಾಸಿಗೆ / ವೀಲ್‌ಚೇರ್', sub: 'Beds & Wheelchairs', text: 'ರೋಗಿಗಳಿಗೆ ಮಲಗಲು ಬೆಡ್ ಇಲ್ಲ ವೀಲ್‌ಚೇರ್ ಮತ್ತು ಸ್ಟ್ರೆಚರ್ ಮುರಿದಿದೆ', cat: 'Beds, Wheelchairs & Stretchers' },
                { icon: '🚑', title: 'ಆಂಬ್ಯುಲೆನ್ಸ್ & ತುರ್ತು ಸೇವೆ', sub: 'Ambulance & Emergency Care', text: 'ತುರ್ತು ಚಿಕಿತ್ಸಾ ವಿಭಾಗದಲ್ಲಿ ಆಂಬ್ಯುಲೆನ್ಸ್ ಮತ್ತು ಆಕ್ಸಿಜನ್ ಲಭ್ಯವಿಲ್ಲ', cat: 'Ambulance & Emergency Desk' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setKioskModalItem(item);
                    speakText(`ನೀವು ${item.title} ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ. ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ದೂರು ದಾಖಲಿಸಲು ಹಸಿರು ಬಟನ್ ಒತ್ತಿ.`, 'kn');
                  }}
                  className="p-8 bg-white hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-500 rounded-3xl flex flex-col items-center justify-center text-center shadow-xs hover:shadow-md transition transform active:scale-95 cursor-pointer"
                >
                  <span className="text-5xl mb-3">{item.icon}</span>
                  <span className="text-base font-bold text-slate-900">{item.title}</span>
                  <span className="text-xs text-slate-500 mt-1">{item.sub}</span>
                </button>
              ))}
            </div>

            {/* Kiosk Confirmation Modal */}
            {kioskModalItem && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
                  <span className="text-6xl">{kioskModalItem.icon}</span>
                  <h3 className="text-2xl font-black text-slate-900">{kioskModalItem.title}</h3>
                  <p className="text-sm text-slate-600">{kioskModalItem.text}</p>

                  <div className="p-3 bg-teal-50 rounded-xl text-xs text-teal-900 font-semibold">
                    🏥 {organizations.find(o => o.id === selectedOrg)?.kannada_name || 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ'}
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button
                      onClick={() => handleKioskQuickSubmit(kioskModalItem)}
                      className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl shadow-lg cursor-pointer"
                    >
                      ✓ ದೂರು ಸಲ್ಲಿಸಿ (Register)
                    </button>
                    <button
                      onClick={() => setKioskModalItem(null)}
                      className="px-5 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-2xl cursor-pointer"
                    >
                      ರದ್ದು (Cancel)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Kiosk Printable Receipt Slip */}
            {kioskSuccessSlip && (
              <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 sm:p-8 max-w-lg mx-auto shadow-md space-y-4 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-slate-900">ಆಸ್ಪತ್ರೆ ದೂರು ಯಶಸ್ವಿಯಾಗಿ ದಾಖಲಾಗಿದೆ!</h3>
                <div className="p-4 bg-slate-50 rounded-2xl border font-mono">
                  <span className="text-xs text-slate-500 block">HOSPITAL GRIEVANCE TOKEN NUMBER</span>
                  <span className="text-3xl font-black text-teal-800">{kioskSuccessSlip.public_id}</span>
                  <span className="text-xs text-slate-500 block mt-1">SLA Target: {kioskSuccessSlip.deadline}</span>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => speakText(`ದೂರು ಸಂಖ್ಯೆ ${kioskSuccessSlip.public_id}. ನಿಮ್ಮ ಆಸ್ಪತ್ರೆ ದೂರು ದಾಖಲಾಗಿದೆ. ಪರಿಹಾರ ಗಡುವು ${kioskSuccessSlip.deadline}. ಧನ್ಯವಾದಗಳು!`, 'kn')}
                    className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" /> 🔊 ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> 🖨️ ರಸೀದಿ ಮುದ್ರಿಸಿ (Print Slip)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: STATUS TRACKING & CITIZEN VERIFICATION (/status) */}
        {/* ================================================================= */}
        {activeTab === 'status' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆ ದೂರಿನ ಸ್ಥಿತಿ ಮತ್ತು ರೋಗಿ ಪರಿಶೀಲನೆ' : 'Hospital Grievance Tracking & Verification'}
                </h2>
                <p className="text-slate-600 text-sm mt-1">
                  {lang === 'kn' ? 'ನಿಮ್ಮ ದೂರು ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ (ಉದಾ: JD-2026-1001 ಅಥವಾ 1001)' : 'Enter your complaint ID (e.g. JD-2026-1001 or 1001)'}
                </p>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="e.g. JD-2026-1001 or 1001"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-teal-600"
                />
                <button
                  onClick={() => handleSearchStatus()}
                  disabled={statusSearchLoading}
                  className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm transition cursor-pointer flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {statusSearchLoading ? 'Searching...' : (lang === 'kn' ? 'ಹುಡುಕಿ (Track)' : 'Track')}
                </button>
              </div>

              {complaintDetails && (
                <div className="space-y-6 pt-4 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-slate-500 font-mono">Public ID</span>
                      <h3 className="text-2xl font-black font-mono text-slate-900">
                        {complaintDetails.complaint.public_id}
                      </h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      complaintDetails.complaint.status === 'CLOSED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : complaintDetails.complaint.status === 'RESOLVED'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : complaintDetails.complaint.is_overdue
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {complaintDetails.complaint.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ:</span>
                      <span className="font-bold text-slate-900">{complaintDetails.complaint.org_kn_name || complaintDetails.complaint.org_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ವಾರ್ಡ್ / ವಿಭಾಗ:</span>
                      <span className="font-bold text-slate-900">{complaintDetails.complaint.ward_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ನಿಯೋಜಿತ ವೈದ್ಯಾಧಿಕಾರಿ:</span>
                      <span className="font-bold text-slate-900">
                        {complaintDetails.complaint.officer_name || 'Duty Medical Team'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ನಿಗದಿತ ಪರಿಹಾರ ದಿನ:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {complaintDetails.complaint.sla_deadline.substring(0, 10)}
                      </span>
                    </div>
                  </div>

                  {/* Audio Status Playback in Pure Kannada */}
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-teal-950 font-bold block">
                        🔊 {lang === 'kn' ? 'ದೂರಿನ ಸಂಪೂರ್ಣ ವಿವರವನ್ನು ಕನ್ನಡದಲ್ಲಿ ಆಲಿಸಿ:' : 'Listen to Spoken Status Audio:'}
                      </span>
                      <span className="text-[11px] text-teal-800">
                        {complaintDetails.audio_text_kn.substring(0, 60)}...
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => speakText(complaintDetails.audio_text_kn, 'kn')}
                        className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> 🔊 ಕನ್ನಡದಲ್ಲಿ ಆಲಿಸಿ (Kannada)
                      </button>
                      <button
                        onClick={() => speakText(complaintDetails.audio_text_en, 'en')}
                        className="px-3.5 py-1.5 bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> English
                      </button>
                    </div>
                  </div>

                  {/* Citizen Ground Verification Panel */}
                  <div className="p-5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-700" />
                      <h4 className="font-bold text-sm text-indigo-950">
                        {lang === 'kn' ? 'ನಾಗರಿಕ / ರೋಗಿ ಪರಿಶೀಲನೆ (Patient Ground Verification)' : 'Citizen Verification Flow'}
                      </h4>
                    </div>
                    <p className="text-xs text-indigo-900 mb-4">
                      {lang === 'kn'
                        ? 'ವೈದ್ಯಾಧಿಕಾರಿಗಳು ಸಮಸ್ಯೆಯನ್ನು ಪರಿಹರಿಸಿದ್ದಾರೆ ಎಂದು ದಾಖಲಿಸಿದ್ದಾರೆ. ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಸಮಸ್ಯೆ ವಾಸ್ತವವಾಗಿ ಪರಿಹಾರವಾಗಿದೆಯೇ?'
                        : 'Hospital authorities marked this issue RESOLVED. Has this issue truly been fixed on the ground?'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => handleCitizenVerify('confirm')}
                        className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        {lang === 'kn' ? 'ಹೌದು, ಪರಿಹಾರವಾಗಿದೆ (Confirm & Close)' : 'Yes, Confirmed Fixed (Close)'}
                      </button>
                      <button
                        onClick={() => handleCitizenVerify('reject')}
                        className="py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        {lang === 'kn' ? 'ಇಲ್ಲ, ಸಮಸ್ಯೆ ಹಾಗೆಯೇ ಇದೆ (Reopen)' : 'No, Issue Persists (Reopen to L2)'}
                      </button>
                    </div>

                    {/* Citizen Rating */}
                    <div className="mt-4 pt-3 border-t border-indigo-200 flex items-center justify-between text-xs">
                      <span className="text-indigo-950 font-medium">ಆಸ್ಪತ್ರೆ ಸೇವೆಗೆ ರೇಟಿಂಗ್ ನೀಡಿ:</span>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRating(star)}
                            className="px-2 py-1 bg-white hover:bg-amber-100 text-amber-600 font-bold border border-indigo-200 rounded text-xs cursor-pointer"
                          >
                            {star}★
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: OFFICER PORTAL & RESOLUTION QUEUE (/officer) */}
        {/* ================================================================= */}
        {activeTab === 'officer' && (
          <div className="space-y-6">
            {/* Officer Persona Switcher Banner (100% Doctors) */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  {officerUser.name.charAt(0)}
                </div>
                <div>
                  <span className="text-xs text-teal-400 font-mono">Logged in as: {officerUser.designation} (Level {officerUser.level})</span>
                  <h3 className="font-bold text-base">{officerUser.name} · {officerUser.org_name}</h3>
                </div>
              </div>

              {/* Persona Switchers for Testing Doctors */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Switch Doctor:</span>
                <button
                  onClick={() => switchOfficerPersona('officer_sneha', 'Duty Medical Officer L1', 1, 'OFFICER', 'District Hospital Kalaburagi')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 border border-slate-700 cursor-pointer"
                >
                  Dr. Sneha (L1)
                </button>
                <button
                  onClick={() => switchOfficerPersona('sup_deshmukh', 'Medical Superintendent L2', 2, 'SUPERVISOR', 'District Hospital Kalaburagi')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 border border-slate-700 cursor-pointer"
                >
                  Superintendent (L2)
                </button>
                <button
                  onClick={() => switchOfficerPersona('officer_raichur', 'Resident Medical Officer L1', 1, 'OFFICER', 'District Hospital Raichur')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 border border-slate-700 cursor-pointer"
                >
                  Dr. Vijaykumar (Raichur L1)
                </button>
                <button
                  onClick={() => switchOfficerPersona('dho_kalaburagi', 'District Health Officer (DHO) L3', 3, 'DISTRICT_OFFICER', 'District Health Office Kalaburagi')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 border border-slate-700 cursor-pointer"
                >
                  DHO Dr. Sharanappa (L3)
                </button>
              </div>
            </div>

            {/* Officer Complaints Queue Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Hospital Grievance Priority Queue (ಆಸ್ಪತ್ರೆ ಆದ್ಯತಾ ಸರತಿ)</h3>
                  <p className="text-xs text-slate-500">Sorted by dynamic clinical urgency score (0-100) including maternal/pediatric ward weightage</p>
                </div>
                <button
                  onClick={loadOfficerQueue}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                  title="Refresh Queue"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">ಆಸ್ಪತ್ರೆ & ವಾರ್ಡ್</th>
                      <th className="p-3">ದೂರಿನ ವಿವರ</th>
                      <th className="p-3">ಆದ್ಯತೆ</th>
                      <th className="p-3">ವರದಿಗಳು</th>
                      <th className="p-3">ಸ್ಥಿತಿ</th>
                      <th className="p-3">ಕ್ರಮ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {officerQueue.map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-slate-900">{comp.public_id}</td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 block">{comp.cat_name}</span>
                          <span className="text-slate-500">{comp.org_name}</span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-slate-700">{comp.original_text}</td>
                        <td className="p-3">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            comp.priority_score >= 80 ? 'bg-red-100 text-red-800' : comp.priority_score >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {comp.priority_score}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold">
                          {comp.duplicate_count > 1 ? (
                            <span className="text-purple-700 flex items-center gap-1">
                              <Flame className="w-3 h-3" /> {comp.duplicate_count} reports
                            </span>
                          ) : (
                            <span className="text-slate-500">1</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                            comp.status === 'CLOSED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : comp.status === 'RESOLVED'
                              ? 'bg-blue-100 text-blue-800'
                              : comp.is_overdue
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {comp.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => setSelectedComplaintForAction(comp)}
                            className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold transition cursor-pointer"
                          >
                            Take Action
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Officer Action Modal */}
            {selectedComplaintForAction && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">
                        Action on {selectedComplaintForAction.public_id}
                      </h3>
                      <p className="text-xs text-slate-500">{selectedComplaintForAction.cat_name}</p>
                    </div>
                    <button
                      onClick={() => setSelectedComplaintForAction(null)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Action Type:</label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                    >
                      <option value="RESOLVED">Mark as RESOLVED (Fixed in Hospital Ward)</option>
                      <option value="IN_PROGRESS">Mark as IN_PROGRESS (Inspection Underway)</option>
                      <option value="NOTE_ADDED">Add Internal Clinical Duty Note</option>
                      <option value="SNOOZE">Request SLA Extension (+24h / +48h)</option>
                      <option value="REASSIGN">Reassign to Another Medical Officer</option>
                    </select>
                  </div>

                  {actionType === 'SNOOZE' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Extension Hours:</label>
                      <select
                        value={snoozeHours}
                        onChange={(e) => setSnoozeHours(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                      >
                        <option value={24}>+24 Hours (Awaiting medical supplies shipment)</option>
                        <option value={48}>+48 Hours (Equipment repair in progress)</option>
                        <option value={72}>+72 Hours (Biomedical engineer inspection)</option>
                      </select>
                    </div>
                  )}

                  {actionType === 'REASSIGN' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Select Medical Officer:</label>
                      <select
                        value={reassignOfficerId}
                        onChange={(e) => setReassignOfficerId(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                      >
                        {allOfficers.map(off => (
                          <option key={off.id} value={off.id}>
                            {off.name} ({off.designation})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Action / Resolution Notes:</label>
                    <textarea
                      rows={3}
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      placeholder="Enter clinical resolution notes or inspection details..."
                      className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm"
                    />
                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
                    <div>📸 Photo Proof Attached: <span className="font-mono text-teal-700">/static/uploads/water_filter_fixed.jpg</span></div>
                    <div>📍 GPS Location Captured: <span className="font-mono text-teal-700">16.2076, 77.3463 (Hospital Premises)</span></div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleOfficerActionSubmit}
                      className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm cursor-pointer"
                    >
                      Submit Action & Update Audit Trail
                    </button>
                    <button
                      onClick={() => setSelectedComplaintForAction(null)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: OPERATIONS DASHBOARD & GIS HEATMAP (/dashboard) */}
        {/* ================================================================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Dashboard Actions Bar with Kannada Audio Speech */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-base text-slate-900">
                  {lang === 'kn' ? 'ಕಲ್ಯಾಣ ಕರ್ನಾಟಕ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗಳ ಕಾರ್ಯಕ್ಷಮತೆ' : 'Kalyana Karnataka District Hospitals Analytics'}
                </h3>
              </div>

              <button
                onClick={speakDashboardSummary}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer"
                title="Listen to hospital performance metrics in Kannada"
              >
                <Volume2 className="w-4 h-4" />
                <span>{lang === 'kn' ? '🔊 ಆಸ್ಪತ್ರೆಗಳ ವರದಿ ಆಲಿಸಿ (Audio)' : '🔊 Listen to Hospital Report'}</span>
              </button>
            </div>

            {/* KPI Cards (100% Hospitals) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Total Hospital Grievances</span>
                <span className="text-3xl font-black text-slate-900 font-mono">{kpiSummary?.total_complaints || 0}</span>
                <span className="text-xs text-teal-600 font-medium block mt-1">Across 5 District Hospitals</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Active / In Progress</span>
                <span className="text-3xl font-black text-amber-700 font-mono">{kpiSummary?.pending_complaints || 0}</span>
                <span className="text-xs text-amber-700 font-medium block mt-1">Under strict hospital SLA</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Resolution Rate</span>
                <span className="text-3xl font-black text-emerald-700 font-mono">{kpiSummary?.resolution_rate_pct || 0}%</span>
                <span className="text-xs text-emerald-700 font-medium block mt-1">Verified by Patients</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-medium block mb-1">Overdue Breaches</span>
                <span className="text-3xl font-black text-rose-700 font-mono">{kpiSummary?.overdue_complaints || 0}</span>
                <span className="text-xs text-rose-700 font-medium block mt-1">Auto-Escalated to DHO</span>
              </div>
            </div>

            {/* Early Warning Banner */}
            {earlyWarnings.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-2 text-amber-900 font-black text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>EARLY WARNING SURGE DETECTION (4x Weekly Baseline Spike)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {earlyWarnings.map((w, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-amber-200">
                      <div className="font-bold text-slate-900">{w.organization_name} — {w.category_name}</div>
                      <div className="text-amber-800 font-medium mt-1">
                        Surge Multiplier: <span className="font-bold font-mono">{w.surge_multiplier}</span> ({w.current_weekly_volume} complaints vs {w.previous_weekly_baseline} baseline)
                      </div>
                      <div className="text-slate-600 mt-1">{w.recommendation_kn || w.recommendation_en}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Composite Hospital Performance Scores */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Hospital Performance Scores (ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಆರೋಗ್ಯ ಸೂಚ್ಯಂಕ)</h3>
                  <p className="text-xs text-slate-500">Composite score (0-100) based on resolution speed, SLA compliance, and patient ratings</p>
                </div>
                <Award className="w-5 h-5 text-teal-600" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {hospitalScores.map((h) => (
                  <div key={h.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 block truncate">{h.district}</span>
                    <span className="text-base font-black text-slate-900 block truncate my-1">{h.name.replace('District Hospital ', '')}</span>
                    <span className={`text-2xl font-black font-mono block ${
                      h.composite_score >= 75 ? 'text-emerald-700' : h.composite_score >= 60 ? 'text-amber-700' : 'text-rose-700'
                    }`}>
                      {h.composite_score}/100
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 mt-1 block">
                      {h.resolved_complaints} resolved · {h.overdue_complaints} overdue
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hospital Category Breakdown & Geospatial Coverage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <h3 className="font-bold text-base text-slate-900 mb-4">Grievances by Hospital Category (ವಿಭಾಗವಾರು ದೂರುಗಳು)</h3>
                <div className="space-y-3">
                  {categoryBreakdown.map((cat, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{cat.name} ({cat.kannada_name})</span>
                        <span className="font-mono">{cat.total} total · {cat.resolved} resolved</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (cat.total / (kpiSummary?.total_complaints || 1)) * 250)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geographic Hospital Coverage across Kalyana Karnataka */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 mb-2">5 Kalyana Karnataka District Hospital Centers</h3>
                  <p className="text-xs text-slate-500 mb-4">Dedicated public healthcare facilities with live coordinates</p>
                  <div className="space-y-2 text-xs">
                    {[
                      { dist: 'Kalaburagi', coords: '17.3297° N, 76.8343° E', name: 'District Hospital Kalaburagi', active: 10 },
                      { dist: 'Bidar', coords: '17.9104° N, 77.5199° E', name: 'District Hospital Bidar', active: 8 },
                      { dist: 'Raichur', coords: '16.2076° N, 77.3463° E', name: 'District Hospital Raichur', active: 9 },
                      { dist: 'Koppal', coords: '15.3463° N, 76.1550° E', name: 'District Hospital Koppal', active: 6 },
                      { dist: 'Yadgir', coords: '16.7644° N, 77.1378° E', name: 'District Hospital Yadgir', active: 7 }
                    ].map((loc, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-teal-600" />
                          <span className="font-bold text-slate-900">{loc.dist}</span>
                          <span className="text-slate-500 font-mono text-[11px]">({loc.coords})</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 font-mono">{loc.active} complaints</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t text-xs flex justify-between items-center text-slate-500">
                  <span>Export Hospital Records:</span>
                  <a
                    href="/api/dashboard/export-csv"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download CSV
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: PUBLIC TRANSPARENCY PORTAL (/transparency) */}
        {/* ================================================================= */}
        {activeTab === 'transparency' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆಗಳ ಸಾರ್ವಜನಿಕ ಪಾರದರ್ಶಕತೆ ಪೋರ್ಟಲ್' : 'Hospital Grievances Transparency Portal'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    {lang === 'kn'
                      ? 'ಕಲ್ಯಾಣ ಕರ್ನಾಟಕದ ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಗಳ ಕುಂದುಕೊರತೆಗಳ ಲೈವ್ ಅನಾಮಧೇಯ ವರದಿ'
                      : 'Live, anonymized public record of hospital complaints across Kalyana Karnataka'}
                  </p>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={transparencySearch}
                    onChange={(e) => setTransparencySearch(e.target.value)}
                    placeholder="Search by ID, hospital, ward..."
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs w-48 sm:w-56"
                  />
                  <select
                    value={transparencyFilter}
                    onChange={(e) => setTransparencyFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="REGISTERED">REGISTERED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="ESCALATED">ESCALATED</option>
                  </select>
                </div>
              </div>

              {/* Transparency Grid Cards with Pure Kannada Voice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTransparency.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900">{item.public_id}</span>
                        <span className="text-[11px] text-slate-500">· {item.district}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.status === 'CLOSED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'RESOLVED'
                          ? 'bg-blue-100 text-blue-800'
                          : item.is_overdue
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{item.category_name} ({item.category_kn})</span>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 italic">"{item.original_text}"</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                      <div>
                        <span>ವೈದ್ಯಾಧಿಕಾರಿ: <strong className="text-slate-800">{item.assigned_officer}</strong></span>
                        <span className="block text-[11px]">SLA: {item.sla_deadline.substring(0, 10)}</span>
                      </div>

                      <button
                        onClick={() => {
                          const statusKn = item.status === 'RESOLVED' ? 'ಪರಿಹಾರವಾಗಿದೆ' : item.status === 'CLOSED' ? 'ಮುಕ್ತಾಯಗೊಂಡಿದೆ' : 'ಪ್ರಗತಿಯಲ್ಲಿದೆ';
                          speakText(`ದೂರು ಸಂಖ್ಯೆ ${item.public_id}. ಆಸ್ಪತ್ರೆ: ${item.organization_kn}. ವಾರ್ಡ್: ${item.ward_name}. ದೂರು: ${item.original_text}. ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: ${statusKn}. ನಿಯೋಜಿತ ವೈದ್ಯಾಧಿಕಾರಿ: ${item.assigned_officer}.`, 'kn');
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-800 border border-teal-200 rounded-lg font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                        title="Listen to this hospital record in Kannada"
                      >
                        <Volume2 className="w-3 h-3" /> 🔊 ಕೇಳಿ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: ADMIN & WARD QR POSTER GENERATOR (/admin) */}
        {/* ================================================================= */}
        {activeTab === 'admin' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {lang === 'kn' ? 'ಆಸ್ಪತ್ರೆಯ ವಾರ್ಡ್ ಕ್ಯೂಆರ್ ಕೋಡ್ ನೋಟಿಸ್ ಬೋರ್ಡ್ ಪೋಸ್ಟರ್' : 'Hospital Ward Notice Board QR Poster'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  {lang === 'kn'
                    ? 'ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಗಳ ಪ್ರತಿಯೊಂದು ವಾರ್ಡ್ ಮತ್ತು ಒಪಿಡಿ ವಿಭಾಗಕ್ಕೆ ಮುದ್ರಿಸಬಹುದಾದ ಅಧಿಕೃತ ಕ್ಯೂಆರ್ ಪೋಸ್ಟರ್'
                    : 'Printable bilingual A4 notice posters for each hospital ward and OPD desk'}
                </p>
              </div>

              {/* Selector Controls (Hospitals only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ಸರ್ಕಾರಿ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ:</label>
                  <select
                    value={posterOrgId}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      setPosterOrgId(id);
                      fetchWards(id);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.kannada_name} ({org.district})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ಆಸ್ಪತ್ರೆ ವಾರ್ಡ್ / ವಿಭಾಗ:</label>
                  <select
                    value={posterWardId}
                    onChange={(e) => setPosterWardId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.kannada_name} — {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Printable Poster Mockup */}
              <div className="border-4 border-slate-900 rounded-3xl p-8 bg-white max-w-xl mx-auto shadow-lg text-center space-y-4">
                <div className="border-b-2 border-slate-900 pb-3">
                  <div className="text-xs font-black tracking-widest text-slate-700 uppercase">ಕರ್ನಾಟಕ ಸರ್ಕಾರ · ಆರೋಗ್ಯ ಮತ್ತು ಕುಟುಂಬ ಕಲ್ಯಾಣ ಇಲಾಖೆ</div>
                  <h3 className="text-2xl font-black text-slate-950 mt-1">ಜನಧ್ವನಿ (JanaDhwani)</h3>
                  <div className="text-sm font-bold text-teal-800">
                    {organizations.find(o => o.id === posterOrgId)?.kannada_name || 'ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ ಕಲಬುರಗಿ'}
                  </div>
                  <div className="text-xs font-semibold text-slate-600">
                    {wards.find(w => w.id === posterWardId)?.kannada_name || 'ಹೆರಿಗೆ ಮತ್ತು ನವಜಾತ ಶಿಶು ವಿಭಾಗ'} (Ward Code: W-{posterWardId})
                  </div>
                </div>

                {/* QR Code Block */}
                <div className="py-4 flex flex-col items-center">
                  <div className="p-4 bg-slate-100 border-2 border-slate-800 rounded-2xl shadow-inner inline-block">
                    <QrCode className="w-36 h-36 text-slate-900" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 mt-2">
                    SCAN TO SUBMIT INSTANT VOICE GRIEVANCE
                  </span>
                </div>

                <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 text-xs text-teal-950 space-y-1">
                  <div className="font-bold">📱 ಸ್ಮಾರ್ಟ್‌ಫೋನ್ ಇಲ್ಲವೇ? ಹೆದರಬೇಡಿ!</div>
                  <div>ಆಸ್ಪತ್ರೆಯ ಕಿಯೋಸ್ಕ್ ಅಥವಾ ಕರ್ತವ್ಯ ಸಹಾಯಕರ ಬಳಿ ಮಾತನಾಡಿ ದೂರು ದಾಖಲಿಸಿ.</div>
                  <div className="font-mono text-teal-900 font-bold">ಆಸ್ಪತ್ರೆ ಉಚಿತ ಸಹಾಯವಾಣಿ: 1800-425-0026</div>
                </div>

                <button
                  onClick={() => window.print()}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 mx-auto cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" /> ಈ ಪೋಸ್ಟರ್ ಮುದ್ರಿಸಿ (Print Notice Board Poster)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 8: HACKATHON DEMO CONTROL ROOM (/demo) */}
        {/* ================================================================= */}
        {activeTab === 'demo' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-bold text-white">
                  Solvathon 2026 Judge Demonstration Room
                </h2>
              </div>
              <p className="text-slate-400 text-xs sm:text-sm mb-6">
                Interactive controls for hackathon judges to verify simulated time travel, automated hospital SLA escalation (50%, 90%, Overdue), tamper detection, and SHA-256 self-healing repair.
              </p>

              {/* Time Travel Buttons */}
              <div className="mb-6 p-4 bg-slate-800/70 border border-slate-700 rounded-xl">
                <span className="text-xs font-bold text-amber-400 block mb-2 uppercase tracking-wider">
                  ⏱️ 1. Simulated Time Travel & Hospital SLA Escalation
                </span>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handleAdvanceTime(6)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer"
                  >
                    +6 Hours Advance
                  </button>
                  <button
                    onClick={() => handleAdvanceTime(24)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer"
                  >
                    +24 Hours (Triggers 50% & 90% SLA)
                  </button>
                  <button
                    onClick={() => handleAdvanceTime(48)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer"
                  >
                    +48 Hours (Forces Overdue Escalation to DHO)
                  </button>
                  <button
                    onClick={async () => {
                      await fetch('/api/demo/reset-time', { method: 'POST' });
                      setSimulatedTime("");
                      setDemoLog(prev => ["Clock reset to real system time.", ...prev]);
                      loadDashboardData();
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Reset Clock
                  </button>
                </div>
              </div>

              {/* Cryptographic Tamper & Repair */}
              <div className="mb-6 p-4 bg-slate-800/70 border border-slate-700 rounded-xl">
                <span className="text-xs font-bold text-teal-400 block mb-2 uppercase tracking-wider">
                  🛡️ 2. Tamper-Evident SHA-256 Hash Chain Verification
                </span>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <button
                    onClick={handleTamper}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Simulate Database Tamper Attack
                  </button>
                  <button
                    onClick={handleRepair}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Self-Healing Cryptographic Repair
                  </button>
                  <button
                    onClick={checkAuditChain}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Verify Hash Chain
                  </button>
                </div>
                <div className="mt-3 p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300">
                  Status: {auditStatus?.is_valid ? '✓ Unbroken' : '❌ Corrupted'} · {auditStatus?.message}
                </div>
              </div>

              {/* Execution Log */}
              <div>
                <span className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">
                  Live Demonstration Event Log:
                </span>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto space-y-1">
                  {demoLog.length === 0 ? (
                    <span className="text-slate-600">Click any demo button above to observe real-time pipeline execution...</span>
                  ) : (
                    demoLog.map((log, i) => (
                      <div key={i} className="text-teal-400">
                        [{new Date().toLocaleTimeString()}] {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ಜನಧ್ವನಿ (JanaDhwani) — Kalyana Karnataka Solvathon 2026 Government Hospitals Portal</span>
          <div className="flex gap-4">
            <span className="hover:text-slate-900">Government Hospitals (ಆರೋಗ್ಯ ಇಲಾಖೆ)</span>
            <span>·</span>
            <span className="hover:text-slate-900">SHA-256 Tamper Audit</span>
            <span>·</span>
            <span className="hover:text-slate-900">ಕನ್ನಡ ಧ್ವನಿ (Pure Kannada Voice)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

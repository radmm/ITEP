/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from './AuthContext';
import { 
  FileText, 
  Upload, 
  Search, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  Loader2,
  FileSearch,
  Download,
  ShieldCheck,
  History,
  LayoutDashboard,
  LogOut,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  Criterion, 
  Bidder, 
  CriterionType, 
  EvaluationStatus, 
  Verdict,
  ProjectState 
} from './types';
import { extractCriteria, evaluateBidder } from './services/geminiService';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';

type Step = 'tender-upload' | 'criteria-review' | 'bidder-upload' | 'analysis' | 'results';

export default function App() {
  const { user, login, logout, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('tender-upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tenderFile, setTenderFile] = useState<{ file: File; base64: string } | null>(null);
  
  const [state, setState] = useState<ProjectState>({
    tenderName: '',
    criteria: [],
    bidders: []
  });

  const [bidderFiles, setBidderFiles] = useState<Record<string, { file: File; base64: string }[]>>({});
  const [selectedBidder, setSelectedBidder] = useState<Bidder | null>(null);

  // --- Helper to convert file to base64 ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // --- Handlers ---
  const onTenderDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const base64 = await fileToBase64(file);
      setTenderFile({ file, base64 });
      const extracted = await extractCriteria(base64, file.type);
      setState(prev => ({ 
        ...prev, 
        tenderName: extracted.tenderName, 
        criteria: extracted.criteria 
      }));
      setCurrentStep('criteria-review');
    } catch (error) {
      console.error('Failed to extract criteria:', error);
      alert('Error parsing tender. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps: getTenderRootProps, getInputProps: getTenderInputProps, isDragActive: isTenderDragActive } = useDropzone({
    onDrop: onTenderDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] },
    multiple: false
  } as any);

  const handleStartAnalysis = async () => {
    setIsProcessing(true);
    setCurrentStep('analysis');
    
    const evaluatedBidders: Bidder[] = [];
    
    try {
      for (const [name, files] of Object.entries(bidderFiles)) {
        const bidder = await evaluateBidder(
          name, 
          (files as any[]).map((f: any) => ({ base64: f.base64, mimeType: f.file.type, name: f.file.name })),
          state.criteria
        );
        evaluatedBidders.push(bidder);
      }
      
      setState(prev => ({ ...prev, bidders: evaluatedBidders }));
      setCurrentStep('results');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Check logs.');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeBidder = (name: string) => {
    setBidderFiles(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const removeBidderFile = (bidderName: string, fileIndex: number) => {
    setBidderFiles(prev => ({
      ...prev,
      [bidderName]: prev[bidderName].filter((_, i) => i !== fileIndex)
    }));
  };

  const onBulkBidderDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const f of acceptedFiles) {
      const base64 = await fileToBase64(f);
      const guessedName = f.name.split(/[._\-\s]/)[0];
      setBidderFiles(prev => {
        const existingFiles = prev[guessedName] || [];
        return {
          ...prev,
          [guessedName]: [...existingFiles, { file: f, base64 }]
        };
      });
    }
  }, []);

  const { getRootProps: getBulkRootProps, getInputProps: getBulkInputProps, isDragActive: isBulkDragActive } = useDropzone({
    onDrop: onBulkBidderDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] }
  } as any);

  const onBidderFileDrop = async (bidderName: string, files: File[]) => {
    const newFiles = await Promise.all(files.map(async f => ({ file: f, base64: await fileToBase64(f) })));
    setBidderFiles(prev => ({
      ...prev,
      [bidderName]: [...(prev[bidderName] || []), ...newFiles]
    }));
  };

  // --- UI Components ---
  const StepItem = ({ step, label, current }: { step: Step; label: string; current: Step }) => {
    const steps: Step[] = ['tender-upload', 'criteria-review', 'bidder-upload', 'analysis', 'results'];
    const currentIndex = steps.indexOf(current);
    const stepIndex = steps.indexOf(step);
    const isPast = stepIndex < currentIndex;
    const isActive = stepIndex === currentIndex;

    return (
      <div className={cn(
        "flex items-center space-x-2 text-[11px] font-bold uppercase tracking-wider",
        isActive ? "text-crpf-navy" : isPast ? "text-green-600" : "text-slate-400"
      )}>
        <div className={cn(
          "w-5 h-5 rounded flex items-center justify-center text-[10px] border shadow-sm",
          isActive ? "border-crpf-navy bg-white" : isPast ? "border-green-600 bg-green-50" : "border-slate-200 bg-slate-50"
        )}>
          {isPast ? <CheckCircle2 className="w-3 h-3" /> : stepIndex + 1}
        </div>
        <span>{label}</span>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-sleek-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-crpf-navy animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-sleek-bg flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded border border-sleek-border shadow-2xl overflow-hidden">
          <div className="bg-crpf-navy p-10 flex flex-col items-center border-b-4 border-crpf-gold">
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 mb-6">
              <ShieldCheck className="text-crpf-gold w-10 h-10" />
            </div>
            <h1 className="text-xl font-bold tracking-widest text-white uppercase text-center">Procurement Evaluation Portal</h1>
            <p className="text-[10px] uppercase font-bold text-white/60 mt-2 tracking-[0.2em]">Restricted Access System</p>
          </div>
          <div className="p-10 space-y-8">
            <div className="space-y-4 text-center">
              <h2 className="text-slate-900 font-bold text-lg">System Authorization</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                This portal is for authorized CRPF personnel only. Access is monitored and logged in compliance with government security protocols.
              </p>
            </div>
            <button 
              onClick={login}
              className="w-full bg-crpf-navy text-white rounded py-3.5 font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-3 hover:bg-crpf-navy/90 transition-all shadow-md group border border-crpf-navy active:scale-[0.98]"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4 rounded-full invert" alt="Google" />
              <span>Login with Official Node</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="pt-6 border-t border-slate-100 text-center">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                Support: CRPF IT Division | Node ID: 2948-X
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleExportAuditLog = () => {
    // Generate CSV data for global audit trail
    const headers = ['Bidder Name', 'Final Status', 'Technical Summary'];
    state.criteria.forEach(c => {
      headers.push(`${c.name} Verdict`, `${c.name} Evidence`, `${c.name} Reference`);
    });

    const rows = state.bidders.map(bidder => {
      const row = [bidder.name, bidder.status, bidder.overallExplanation];
      state.criteria.forEach(c => {
        const ev = bidder.criteriaEvaluations[c.id];
        row.push(ev?.verdict || 'N/A', ev?.foundValue || 'N/A', ev?.sourceReference || 'N/A');
      });
      return row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `CRPF_ELIGIBILITY_REPORT_${state.tenderName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  const handleFinalizeSelection = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const tenderId = `TENDER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const tenderRef = doc(db, 'tenders', tenderId);
      
      await setDoc(tenderRef, {
        title: state.tenderName,
        status: 'FINALIZED',
        createdBy: user.uid,
        creatorEmail: user.email,
        createdAt: serverTimestamp(),
        bidderCount: state.bidders.length,
        eligibleCount: state.bidders.filter(b => b.status === EvaluationStatus.ELIGIBLE).length
      });
      
      alert("System Status: Selection Finalized. All evaluation logs have been cryptographically sealed and archived in the secure node database.");
    } catch (error) {
      console.error("Finalization Error:", error);
      alert("Security Protocol Failure: Unable to write to secure database. Check node permissions.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-sleek-bg text-sleek-text font-sans">
      {/* Header */}
      <header className="bg-crpf-navy text-white px-6 py-4 sticky top-0 z-30 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center border border-white/20">
            <ShieldCheck className="text-crpf-gold w-7 h-7" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase leading-none text-white">Intelligent Tender Evaluation Platform</h1>
            <p className="text-[10px] uppercase font-medium text-white/60 mt-1">Internal System for CRPF Procurement Division</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="px-3 py-1 bg-crpf-gold rounded text-crpf-navy font-bold text-[10px] tracking-wider uppercase">
            {user?.email?.includes('admin') ? 'ADMIN NODE' : 'SECURE NODE #04'}
          </div>
          <div className="text-right hidden sm:block border-l border-white/10 pl-4">
            <p className="text-xs font-bold text-white">{user?.displayName || 'Authorized Officer'}</p>
            <p className="text-[9px] text-white/60 uppercase font-medium">{user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
            title="Secure Logout"
          >
            <LogOut className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      <div className="flex items-center space-x-4 px-6 py-3 bg-white border-b border-sleek-border shadow-sleek relative z-20">
        <StepItem step="tender-upload" label="Upload Tender" current={currentStep} />
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <StepItem step="criteria-review" label="Review Criteria" current={currentStep} />
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <StepItem step="bidder-upload" label="Add Bidders" current={currentStep} />
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <StepItem step="results" label="Final Report" current={currentStep} />
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {currentStep === 'tender-upload' && (
            <motion.div 
              key="tender-upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Step 1: Tender Identification</h2>
                <p className="text-slate-500 max-w-2xl">Upload the official tender document (PDF/Image). Our AI will extract eligibility criteria, compliance rules, and financial benchmarks automatically.</p>
              </div>

              <div 
                {...getTenderRootProps()} 
                className={cn(
                  "border border-sleek-border rounded p-16 flex flex-col items-center justify-center transition-all cursor-pointer group shadow-sleek relative overflow-hidden",
                  isTenderDragActive ? "border-crpf-navy bg-slate-50" : "bg-white hover:border-crpf-navy/40"
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-crpf-navy/10" />
                <input {...getTenderInputProps()} />
                <div className="w-14 h-14 bg-slate-100 rounded flex items-center justify-center mb-6 border border-slate-200 group-hover:bg-crpf-navy/5 transition-colors">
                  {isProcessing ? <Loader2 className="w-6 h-6 text-crpf-navy animate-spin" /> : <Upload className="w-6 h-6 text-crpf-navy" />}
                </div>
                <p className="text-lg font-semibold text-slate-800">
                  {isProcessing ? "Analyzing Document Structure..." : isTenderDragActive ? "Drop the tender document here" : "Click or drag to upload tender document"}
                </p>
                <p className="text-sm text-slate-400 mt-2">Supports official PDFs and scanned images up to 20MB</p>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {[
                  { icon: Search, title: "Criterion Extraction", desc: "Automated identification of technical and financial eligibility." },
                  { icon: FileSearch, title: "Multimodal OCR", desc: "Handles scanned certificates, stamps, and handwritten notes." },
                  { icon: LayoutDashboard, title: "Audit Trail", desc: "Every extracted point is mapped back to the source page." }
                ].map((feature, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-slate-500" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">{feature.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === 'criteria-review' && (
            <motion.div 
              key="criteria-review"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-end justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Document Parsed</span>
                    <div className="h-[1px] w-8 bg-blue-200" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">{state.tenderName || "Tender Criteria Review"}</h2>
                  <p className="text-slate-500">Review and refine the elligibility criteria found in the document.</p>
                </div>
                <button 
                  onClick={() => setCurrentStep('bidder-upload')}
                  className="px-6 py-2 bg-crpf-navy text-white rounded font-bold text-[11px] uppercase tracking-widest flex items-center space-x-2 hover:bg-crpf-navy/90 transition-all shadow-md active:scale-95"
                >
                  <span>Authorize & Process Bids</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {state.criteria.map((c, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={c.id} 
                    className="bg-white border border-sleek-border rounded p-6 flex items-start gap-6 shadow-sleek group"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded flex flex-col items-center justify-center shrink-0 border",
                      c.isMandatory ? "bg-slate-50 border-crpf-navy/20 text-crpf-navy" : "bg-slate-50 border-slate-200 text-slate-500"
                    )}>
                      {c.type === CriterionType.FINANCIAL ? <p className="font-bold text-xs">₹</p> : <p className="font-bold text-xs">T</p>}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-bold text-slate-900 text-sm whitespace-nowrap">{c.name}</h4>
                          <span className="text-[9px] font-bold uppercase tracking-widest py-0.5 px-2 bg-slate-100 rounded text-slate-500 border border-slate-200">{c.type}</span>
                        </div>
                        {c.isMandatory && <span className="text-[9px] font-bold text-crpf-navy uppercase bg-slate-100 px-2 py-0.5 rounded border border-crpf-navy/10">Mandatory</span>}
                      </div>
                      <p className="text-[12px] text-slate-600 leading-normal">{c.description}</p>
                      <div className="pt-2 flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidence Pattern:</span>
                        <code className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded italic">{c.evidenceRequirement}</code>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === 'bidder-upload' && (
            <motion.div 
              key="bidder-upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">Step 3: Bidder Discovery & Ingestion</h2>
                  <p className="text-slate-500 max-w-2xl">Register bidders and upload their technical/financial document sets. Our AI handles multi-file packages (e.g. Turnover + ISO Cert + Experience Letters) per bidder.</p>
                </div>
                <button 
                  disabled={Object.keys(bidderFiles).length === 0 || isProcessing}
                  onClick={handleStartAnalysis}
                  className="px-8 py-2.5 bg-crpf-navy text-white rounded font-bold text-[11px] uppercase tracking-widest flex items-center space-x-2 hover:bg-crpf-navy/90 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Search className="w-4 h-4" />
                  <span>Execute Full Eligibility Analysis</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Bulk Discovery Zone */}
                <div className="lg:col-span-1 space-y-6">
                  <div 
                    {...getBulkRootProps()} 
                    className={cn(
                      "border-2 border-dashed rounded p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group shadow-sm bg-white",
                      isBulkDragActive ? "border-crpf-navy bg-slate-50" : "border-slate-200 hover:border-crpf-navy/40"
                    )}
                  >
                    <input {...getBulkInputProps()} />
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200 group-hover:bg-crpf-navy/5">
                      <LayoutDashboard className="w-5 h-5 text-crpf-navy" />
                    </div>
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-900">Bulk Discovery</h4>
                    <p className="text-[10px] text-slate-500 mt-2 font-medium">Drop all bidder documents here.<br/>System will auto-detect entities.</p>
                  </div>

                  <div className="bg-white border border-sleek-border rounded p-6 space-y-4 shadow-sleek">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest flex items-center space-x-2 text-crpf-navy">
                      <Users className="w-4 h-4" />
                      <span>Manual Registry</span>
                    </h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const name = new FormData(e.currentTarget).get('bidderName') as string;
                      if(name && !bidderFiles[name]) {
                        setBidderFiles(prev => ({ ...prev, [name]: [] }));
                        e.currentTarget.reset();
                      }
                    }} className="flex gap-1">
                      <input 
                        name="bidderName" 
                        placeholder="Company Name" 
                        className="flex-1 bg-slate-50 border border-sleek-border rounded px-3 py-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-crpf-navy" 
                        required 
                      />
                      <button type="submit" className="bg-crpf-navy text-white px-3 py-1.5 rounded font-bold text-[10px] hover:bg-crpf-navy/90">+</button>
                    </form>
                  </div>
                </div>

                {/* Bidders Grid */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {Object.entries(bidderFiles).map(([name, files]) => (
                      <BidderUploadBox 
                        key={name}
                        name={name} 
                        onDrop={(f) => onBidderFileDrop(name, f)} 
                        onRemove={() => removeBidder(name)}
                        onRemoveFile={(idx) => removeBidderFile(name, idx)}
                        files={files} 
                      />
                    ))}
                  </AnimatePresence>
                  {Object.keys(bidderFiles).length === 0 && (
                    <div className="md:col-span-2 border border-sleek-border border-dashed rounded p-20 flex flex-col items-center justify-center text-center bg-white/50">
                      <Users className="w-10 h-10 text-slate-200 mb-4" />
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Awaiting Bidder Packages</p>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">Use Bulk Discovery or Manual Registry to start</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 'analysis' && (
            <motion.div 
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-[60vh] flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative">
                <div className="w-32 h-32 border-4 border-blue-50 rounded-full" />
                <motion.div 
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, ease: "linear", duration: 2 }}
                  className="absolute inset-0 w-32 h-32 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="w-10 h-10 text-blue-600 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-bold tracking-tight">High-Precision Eligibility Analysis in Progress</h3>
                <div className="max-w-md mx-auto space-y-4">
                  <p className="text-slate-500 text-sm">Evaluating bidder submissions against technical specifications, financial thresholds, and regulatory compliance rules.</p>
                  <div className="space-y-2">
                    <AnalysisProgressItem label="Processing scanned documents (Multimodal OCR)" active />
                    <AnalysisProgressItem label="Comparing financial statements vs thresholds" active={false} />
                    <AnalysisProgressItem label="Validating ISO Certifications & GST Status" active={false} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex items-end justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Analysis Complete</span>
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">Consolidated Eligibility Report</h2>
                  <p className="text-slate-500">Detailed verdict breakdown for {state.tenderName}.</p>
                </div>
                <div className="flex gap-3">
                   <button 
                    onClick={handleExportAuditLog}
                    className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs flex items-center space-x-2 hover:bg-slate-50 transition-all text-slate-700 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Audit Log</span>
                  </button>
                  <button 
                    onClick={handleFinalizeSelection}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-crpf-navy text-white rounded-xl font-bold text-xs flex items-center space-x-2 hover:bg-crpf-navy/90 transition-all shadow-lg disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finalize Selection</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6">
                <StatCard label="Total Bidders" value={state.bidders.length} />
                <StatCard label="Clearly Eligible" value={state.bidders.filter(b => b.status === EvaluationStatus.ELIGIBLE).length} highlight="green" />
                <StatCard label="Non-Compliant" value={state.bidders.filter(b => b.status === EvaluationStatus.INELIGIBLE).length} highlight="red" />
                <StatCard label="Requires Review" value={state.bidders.filter(b => b.status === EvaluationStatus.MANUAL_REVIEW).length} highlight="orange" />
              </div>

              <div className="bg-white border border-sleek-border rounded shadow-sleek overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-sleek-border">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bidder Entity</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Score Card</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Final Status</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.bidders.map(bidder => (
                      <tr key={bidder.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500">{bidder.name[0]}</div>
                            <span className="font-bold text-slate-800">{bidder.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center space-x-1">
                            {state.criteria.map(c => {
                              const v = bidder.criteriaEvaluations[c.id]?.verdict;
                              return (
                                <div key={c.id} className={cn(
                                  "w-3 h-1.5 rounded-full",
                                  v === Verdict.PASS ? "bg-green-500" : v === Verdict.FAIL ? "bg-red-500" : "bg-orange-400"
                                )} title={c.name} />
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex justify-center">
                            <StatusBadge status={bidder.status} />
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => setSelectedBidder(bidder)}
                            className="text-blue-600 font-bold text-xs hover:underline decoration-2 underline-offset-4"
                          >
                            View Evidence Files & Verdict
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bidder Detail Modal */}
      <AnimatePresence>
        {selectedBidder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto pt-20 pb-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBidder(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded border border-sleek-border overflow-hidden shadow-2xl z-50 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                <div className="flex items-start justify-between border-b border-sleek-border pb-6">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold uppercase tracking-tight text-crpf-navy">{selectedBidder.name}</h3>
                    <div className="flex items-center space-x-3">
                      <StatusBadge status={selectedBidder.status} />
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Timestamp: {new Date().toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedBidder(null)} className="p-2 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-all">
                    <XCircle className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="bg-slate-100 border border-sleek-border rounded p-6 border-l-4 border-l-crpf-gold">
                  <h4 className="text-[9px] font-extrabold text-crpf-navy uppercase tracking-widest mb-2">Technical Verdict Summary</h4>
                  <p className="text-slate-700 leading-relaxed text-sm font-medium italic">"{selectedBidder.overallExplanation}"</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Criterion Deep-Dive & Evidence Trace</h4>
                  <div className="space-y-3">
                    {state.criteria.map(c => {
                      const ev = selectedBidder.criteriaEvaluations[c.id];
                      return (
                        <div key={c.id} className="border border-slate-100 rounded-2xl p-5 flex items-start gap-4">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            ev?.verdict === Verdict.PASS ? "bg-green-100 text-green-600" : 
                            ev?.verdict === Verdict.FAIL ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                          )}>
                            {ev?.verdict === Verdict.PASS ? <CheckCircle2 className="w-4 h-4" /> : 
                             ev?.verdict === Verdict.FAIL ? <XCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-slate-900">{c.name}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{c.type}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{ev?.explanation}</p>
                            <div className="mt-3 flex items-center gap-4 bg-white border border-slate-100 p-2 rounded-xl">
                              <div className="space-y-1">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Extracted Evidence</span>
                                <span className="text-xs font-mono font-bold text-blue-700">{ev?.foundValue || "N/A"}</span>
                              </div>
                              <div className="w-[1px] h-6 bg-slate-100" />
                              <div className="space-y-1 overflow-hidden">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Source Reference</span>
                                <span className="text-xs font-medium text-slate-600 truncate block">{ev?.sourceReference}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-sleek-border flex justify-end">
                <button 
                  onClick={() => setSelectedBidder(null)}
                  className="px-8 py-2.5 bg-crpf-navy text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-crpf-navy/90 transition-all shadow-md"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-6 py-8 mt-12 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-t border-sleek-border bg-white rounded-t-xl shadow-sleek">
        <div>Audit ID: AI-EVAL-88219-X | Confidence Mode: Balanced</div>
        <div>&copy; CRPF Technical Evaluation Cell - All decision logs are cryptographically signed</div>
      </footer>
    </div>
  );
}

interface BidderUploadBoxProps {
  name: string;
  onDrop: (files: File[]) => void;
  onRemove: () => void;
  onRemoveFile: (idx: number) => void;
  files: any[];
}

const BidderUploadBox: React.FC<BidderUploadBoxProps> = ({ name, onDrop, onRemove, onRemoveFile, files }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] }
  } as any);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
      className="bg-white border border-sleek-border rounded overflow-hidden shadow-sleek group"
    >
      <div className="px-5 py-3 border-b border-sleek-border flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-crpf-navy animate-pulse" />
          <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-widest">{name}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded",
            files.length > 0 ? "bg-green-100 text-green-600 border border-green-200" : "bg-slate-100 text-slate-400 border border-slate-200"
          )}>
            {files.length} Docs
          </span>
          <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded transition-all">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div 
        {...getRootProps()} 
        className={cn(
          "p-6 flex flex-col items-center justify-center transition-all cursor-pointer border-b border-sleek-border/50",
          isDragActive ? "bg-blue-50" : "hover:bg-slate-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("w-5 h-5 mb-2", isDragActive ? "text-blue-500" : "text-slate-300")} />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Attach more proof</p>
      </div>
      {files.length > 0 && (
        <div className="px-4 py-3 bg-white space-y-1 max-h-[140px] overflow-y-auto">
          {files.map((f, i) => (
            <div key={i} className="py-1.5 text-[10px] flex items-center justify-between font-bold group/file">
              <div className="flex items-center space-x-2 min-w-0">
                <FileText className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="truncate text-slate-600 italic leading-none">{f.file.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }} className="opacity-0 group-hover/file:opacity-100 p-0.5 hover:text-red-500 transition-opacity">
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function AnalysisProgressItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={cn(
      "flex items-center space-x-3 p-3 rounded-xl border transition-all",
      active ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-white border-slate-100 text-slate-400"
    )}>
      {active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 opacity-20" />}
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: EvaluationStatus }) {
  const styles = {
    [EvaluationStatus.ELIGIBLE]: "bg-green-100 text-green-700 border-green-200",
    [EvaluationStatus.INELIGIBLE]: "bg-red-100 text-red-700 border-red-200",
    [EvaluationStatus.MANUAL_REVIEW]: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest", styles[status])}>
      {status}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number | string; highlight?: 'green' | 'orange' | 'red' }) {
  const highlightStyles = {
    green: "border-green-500",
    orange: "border-orange-400",
    red: "border-red-500",
  };

  return (
    <div className={cn(
      "bg-white border border-sleek-border rounded p-6 flex flex-col shadow-sleek border-l-4",
      highlight ? highlightStyles[highlight] : "border-l-crpf-navy"
    )}>
      <span className="text-3xl font-bold tracking-tighter text-slate-900 leading-none">{value}</span>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{label}</span>
    </div>
  );
}


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
  LayoutDashboard
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

type Step = 'tender-upload' | 'criteria-review' | 'bidder-upload' | 'analysis' | 'results';

export default function App() {
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

  const addBidder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('bidderName') as string;
    if (name && !bidderFiles[name]) {
      setBidderFiles(prev => ({ ...prev, [name]: [] }));
      e.currentTarget.reset();
    }
  };

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
            Secure Node #04
          </div>
          <div className="text-right hidden sm:block border-l border-white/10 pl-4">
            <p className="text-xs font-bold text-white">S.K. Sharma</p>
            <p className="text-[9px] text-white/60 uppercase font-medium">Commandant (Procurement)</p>
          </div>
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-end justify-between">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">Step 2: Bidder Enrollment</h2>
                  <p className="text-slate-500">Add bidders and upload their technical/financial responses.</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Add Bidder Panel */}
                <div className="bg-white border border-sleek-border rounded p-8 space-y-6 shadow-sleek">
                  <h3 className="text-sm font-extrabold uppercase tracking-widest flex items-center space-x-2 text-crpf-navy">
                    <Users className="w-5 h-5" />
                    <span>Register New Bidder</span>
                  </h3>
                  <form onSubmit={addBidder} className="flex gap-2">
                    <input 
                      name="bidderName" 
                      placeholder="e.g. Acme Construction Pvt Ltd" 
                      className="flex-1 bg-slate-50 border border-sleek-border rounded px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-crpf-navy focus:border-crpf-navy transition-all" 
                      required 
                    />
                    <button type="submit" className="bg-crpf-navy text-white px-4 py-2 rounded font-bold text-xs hover:bg-crpf-navy/90 transition-all">+</button>
                  </form>

                  <div className="space-y-3">
                    {Object.keys(bidderFiles).map(name => (
                      <div key={name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-sm font-bold text-slate-700">{name}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold text-slate-400">{bidderFiles[name].length} Files</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload Console */}
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {Object.keys(bidderFiles).map(name => (
                      <BidderUploadBox 
                        key={name}
                        name={name}
                        onDrop={(files) => onBidderFileDrop(name, files)}
                        files={bidderFiles[name]}
                      />
                    ))}
                  </AnimatePresence>
                  {Object.keys(bidderFiles).length === 0 && (
                     <div className="h-full border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-12 text-center opacity-40">
                       <FileText className="w-12 h-12 mb-4 text-slate-300" />
                       <p className="font-bold text-slate-400">Register bidders on the left to start uploading documents</p>
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
                   <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs flex items-center space-x-2 hover:bg-slate-50 transition-all text-slate-700">
                    <Download className="w-4 h-4" />
                    <span>Export Audit Log</span>
                  </button>
                  <button className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center space-x-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
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
  files: any[];
}

const BidderUploadBox: React.FC<BidderUploadBoxProps> = ({ name, onDrop, files }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] }
  } as any);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.9 }}
      className="bg-white border border-sleek-border rounded overflow-hidden shadow-sleek"
    >
      <div className="px-5 py-3 border-b border-sleek-border flex items-center justify-between bg-slate-50/50">
        <span className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">{name} Response</span>
        <span className={cn(
          "text-[9px] font-bold px-2 py-0.5 rounded",
          files.length > 0 ? "bg-green-100 text-green-600 border border-green-200" : "bg-slate-100 text-slate-400 border border-slate-200"
        )}>
          {files.length} Evidence Docs
        </span>
      </div>
      <div 
        {...getRootProps()} 
        className={cn(
          "p-8 flex flex-col items-center justify-center transition-all cursor-pointer",
          isDragActive ? "bg-blue-50" : "hover:bg-slate-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("w-6 h-6 mb-2", isDragActive ? "text-blue-500" : "text-slate-300")} />
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Drag proof documents here</p>
      </div>
      {files.length > 0 && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 divide-y divide-slate-200/50">
          {files.map((f, i) => (
            <div key={i} className="py-2 text-[10px] flex items-center justify-between font-medium">
              <span className="truncate max-w-[150px] text-slate-600">{f.file.name}</span>
              <span className="text-slate-400">{(f.file.size / 1024).toFixed(0)} KB</span>
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


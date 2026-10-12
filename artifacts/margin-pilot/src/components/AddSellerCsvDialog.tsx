import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Download,
  Building2,
  Layers,
  BrainCircuit,
  Info,
  Check,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Radio,
  Copy,
  Server,
  Zap,
  Clock3,
  Wifi,
  ExternalLink,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '../state/AppState';
import { createSellerProfile, generateStableSellerId, BRAND_PALETTES, type Seller } from '../data/sellers';
import {
  createLiveSellerInFirestore,
  deleteLiveSellerFromFirestore,
  listenToLiveSeller,
  listenToLiveOrders,
  listenToLiveEvents,
  sendSimulatedLiveOrder,
  type FirestoreLiveEvent
} from '../lib/firebaseLiveSync';
import config from '../firebase-applet-config.json';
import {
  RAVI_TOYS_SAMPLE_CSV,
  ARITHVA_CSV_TEMPLATE,
  parseCsvText,
  autoDetectColumnMapping,
  parseAndValidateCsvRows,
  convertRowsToOrders,
  type CsvColumnMapping,
  type ParsedCsvRow,
  type ImportSummary,
} from '../engine/csvImporter';

interface AddSellerCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: 1 | 2;
}

export function AddSellerCsvDialog({ open, onOpenChange, initialStep = 1 }: AddSellerCsvDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { sellers, orders, engineConfig, allCouriers, importOrdersForSeller, addSeller, setCurrentSellerId } = useAppState();

  // Wizard Step State: 1 | 2 | 3 | 4 | 'live_setup'
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 'live_setup'>(initialStep);

  // Step 1: Seller Details & Connection Method
  const [sellerName, setSellerName] = useState('');
  const [sellerDescription, setSellerDescription] = useState('');
  const [category, setCategory] = useState('D2C Consumer & Retail');
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(0);
  const [connectionMethod, setConnectionMethod] = useState<'csv' | 'live'>('csv');
  const [step1Errors, setStep1Errors] = useState<{ name?: string; description?: string }>({});

  // Step 2 & 3: CSV Content & File Inspection
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column Mapping & Parsed Rows
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<CsvColumnMapping>({
    orderId: '',
    product: '',
    price: '',
    cogs: '',
    unitMargin: '',
    customerName: '',
    customerPhone: '',
    address: '',
    compositeLocation: '',
    pincode: '',
    city: '',
    state: '',
    rtoRate: '',
    payment: '',
    campaign: '',
  });

  const [showMappingEditor, setShowMappingEditor] = useState(false);

  // Step 4: Import & Inference Results
  const [isProcessingInference, setIsProcessingInference] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [createdSeller, setCreatedSeller] = useState<Seller | null>(null);

  // Live Connection Setup State
  const [copiedSellerId, setCopiedSellerId] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'not_connected' | 'connecting' | 'connected' | 'error'>('not_connected');
  const [liveOrdersCount, setLiveOrdersCount] = useState(0);
  const [liveEventsCount, setLiveEventsCount] = useState(0);
  const [isSendingSimulated, setIsSendingSimulated] = useState(false);

  // Reset or preset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setStep1Errors({});
      setCopiedSellerId(false);
      setLiveStatus('not_connected');
      setLiveOrdersCount(0);
      setLiveEventsCount(0);
    }
  }, [open, initialStep]);

  // Handle CSV text changes -> parse headers & rows
  useEffect(() => {
    if (!rawCsvText.trim()) {
      setDetectedHeaders([]);
      setRawRows([]);
      return;
    }

    setIsParsing(true);
    const timer = setTimeout(() => {
      try {
        const { headers, rows } = parseCsvText(rawCsvText);
        setDetectedHeaders(headers);
        setRawRows(rows);
        const autoMap = autoDetectColumnMapping(headers);
        setColumnMapping(autoMap);
      } catch (err) {
        console.error('Failed to parse CSV:', err);
        toast({
          title: 'CSV Parsing Warning',
          description: 'Could not parse CSV content. Check format.',
          variant: 'destructive',
        });
      } finally {
        setIsParsing(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [rawCsvText]);

  // Validated rows for CSV
  const parsedRows: ParsedCsvRow[] = useMemo(() => {
    if (!detectedHeaders.length || !rawRows.length) return [];
    return parseAndValidateCsvRows(detectedHeaders, rawRows, columnMapping, orders);
  }, [detectedHeaders, rawRows, columnMapping, orders]);

  // Row status counts for CSV
  const rowStats = useMemo(() => {
    const valid = parsedRows.filter(r => r.status === 'valid').length;
    const warning = parsedRows.filter(r => r.status === 'warning').length;
    const invalid = parsedRows.filter(r => r.status === 'invalid').length;
    const duplicate = parsedRows.filter(r => r.status === 'duplicate').length;
    return {
      total: parsedRows.length,
      valid,
      warning,
      usable: valid + warning,
      invalid,
      duplicate
    };
  }, [parsedRows]);

  // ==========================================
  // REAL-TIME LISTENER FOR LIVE_SETUP SCREEN
  // ==========================================
  useEffect(() => {
    if (step !== 'live_setup' || !createdSeller?.id) return;

    setLiveStatus('connecting');

    // 1. Listen to seller document updates
    const unsubSeller = listenToLiveSeller(createdSeller.id, (doc) => {
      if (doc.connectionStatus) {
        setLiveStatus(doc.connectionStatus);
      }
    });

    // 2. Listen to orders collection updates
    const unsubOrders = listenToLiveOrders(createdSeller.id, (ords) => {
      setLiveOrdersCount(ords.length);
      if (ords.length > 0) {
        setLiveStatus('connected');
      }
    });

    // 3. Listen to events collection updates
    const unsubEvents = listenToLiveEvents(createdSeller.id, (evts) => {
      setLiveEventsCount(evts.length);
      if (evts.length > 0) {
        setLiveStatus('connected');
      }
    });

    return () => {
      unsubSeller();
      unsubOrders();
      unsubEvents();
    };
  }, [step, createdSeller?.id]);

  // ==========================================
  // STEP 1 HANDLERS
  // ==========================================
  const handleStep1Continue = async () => {
    const errs: { name?: string; description?: string } = {};
    if (!sellerName.trim()) {
      errs.name = 'Seller/Business Name is required';
    } else if (sellerName.trim().length < 2) {
      errs.name = 'Seller name must be at least 2 characters';
    }

    if (!sellerDescription.trim()) {
      errs.description = 'Seller description is required';
    } else if (sellerDescription.trim().length < 6) {
      errs.description = 'Please provide a short description (at least 6 characters)';
    }

    if (Object.keys(errs).length > 0) {
      setStep1Errors(errs);
      return;
    }

    setStep1Errors({});

    if (connectionMethod === 'live') {
      // Connect Live Data workflow
      const stableId = generateStableSellerId(sellerName, 'live_sync');
      const seller = createSellerProfile(
        sellerName,
        sellerDescription,
        category,
        selectedPaletteIndex,
        'live_sync',
        stableId
      );

      try {
        // Create initial document in Cloud Firestore at sellers/{sellerId}
        await createLiveSellerInFirestore(seller);
        setCreatedSeller(seller);
        setStep('live_setup');
        toast({
          title: 'Live Seller Document Created',
          description: `Initialized Firestore endpoint for ${seller.name} (${seller.id}).`,
        });
      } catch (err: any) {
        console.error('Failed to create live seller in Firestore:', err);
        toast({
          title: 'Firestore Creation Notice',
          description: err.message || 'Could not create live seller document. Check configuration.',
          variant: 'destructive',
        });
        setCreatedSeller(seller);
        setStep('live_setup');
      }
    } else {
      // CSV Workflow
      const seller = createSellerProfile(
        sellerName,
        sellerDescription,
        category,
        selectedPaletteIndex,
        'csv_import'
      );
      setCreatedSeller(seller);
      setStep(2);
    }
  };

  // Copy Seller ID helper
  const handleCopySellerId = () => {
    if (!createdSeller?.id) return;
    navigator.clipboard.writeText(createdSeller.id);
    setCopiedSellerId(true);
    toast({
      title: 'Seller ID Copied',
      description: `${createdSeller.id} copied to clipboard.`,
    });
    setTimeout(() => setCopiedSellerId(false), 2500);
  };

  // Send simulated order test payload
  const handleSendTestPayload = async () => {
    if (!createdSeller?.id) return;
    setIsSendingSimulated(true);
    try {
      const res = await sendSimulatedLiveOrder(createdSeller.id);
      setLiveStatus('connected');
      toast({
        title: 'Simulator Event Verified!',
        description: `Ingested order ${res.orderId} and event ${res.eventId} in Firestore.`,
      });
    } catch (err: any) {
      console.error('Failed to send test payload:', err);
      toast({
        title: 'Simulation Error',
        description: err.message || 'Failed to send test payload to Firestore.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSimulated(false);
    }
  };

  // Cancel and Back handlers for live_setup: cleanup draft records if unconfirmed
  const handleCancelLiveSetup = async () => {
    if (createdSeller && liveOrdersCount === 0) {
      await deleteLiveSellerFromFirestore(createdSeller.id);
    }
    setCreatedSeller(null);
    onOpenChange(false);
  };

  const handleBackFromLiveSetup = async () => {
    if (createdSeller && liveOrdersCount === 0) {
      await deleteLiveSellerFromFirestore(createdSeller.id);
    }
    setCreatedSeller(null);
    setStep(1);
  };

  // Confirm and activate live seller
  const handleConfirmLiveSeller = () => {
    if (!createdSeller) return;
    const finalSeller: Seller = {
      ...createdSeller,
      connectionStatus: liveStatus,
    };
    addSeller(finalSeller);
    setCurrentSellerId(finalSeller.id);
    onOpenChange(false);
    setLocation('/dashboard');
    toast({
      title: `Active Workspace: ${finalSeller.name}`,
      description: 'Listening to real-time Firestore order & event streams.',
    });
  };

  // ==========================================
  // STEP 2 HANDLERS (CSV File Loading)
  // ==========================================
  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload a valid .csv file.',
        variant: 'destructive',
      });
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawCsvText(text || '');
      toast({
        title: 'CSV File Loaded',
        description: `${file.name} (${(file.size / 1024).toFixed(1)} KB) ready for inspection.`,
      });
    };
    reader.onerror = () => {
      toast({
        title: 'Error Reading File',
        description: 'Could not read the uploaded CSV file.',
        variant: 'destructive',
      });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleLoadRaviToys = () => {
    setFileName('Ravi_Toys_Orders_Export.csv');
    setFileSize(RAVI_TOYS_SAMPLE_CSV.length);
    setRawCsvText(RAVI_TOYS_SAMPLE_CSV);
    if (!sellerName) {
      setSellerName('Ravi Toys');
      setSellerDescription('Traditional and modern Indian learning toys, puzzles, and die-cast models');
      setCategory('Kids & Learning Toys');
      setSelectedPaletteIndex(0);
      const seller = createSellerProfile(
        'Ravi Toys',
        'Traditional and modern Indian learning toys, puzzles, and die-cast models',
        'Kids & Learning Toys',
        0
      );
      setCreatedSeller(seller);
    }
    toast({
      title: 'Ravi Toys Dataset Loaded',
      description: 'Loaded authentic 10-order Ravi Toys dataset with unit margins & delivery details.',
    });
    setStep(3);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([ARITHVA_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'arithva_seller_orders_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: 'Template Downloaded',
      description: 'arithva_seller_orders_template.csv is ready to populate.',
    });
  };

  const handleClearFile = () => {
    setFileName(null);
    setFileSize(null);
    setRawCsvText('');
    setDetectedHeaders([]);
    setRawRows([]);
  };

  // ==========================================
  // STEP 3 & 4: EXECUTE CSV INFERENCE & IMPORT
  // ==========================================
  const handleConfirmImport = async () => {
    if (rowStats.usable === 0) {
      toast({
        title: 'No Usable Orders',
        description: 'Please fix CSV errors before importing.',
        variant: 'destructive',
      });
      return;
    }

    const seller = createdSeller || createSellerProfile(
      sellerName || 'New Seller',
      sellerDescription || 'D2C Merchant',
      category,
      selectedPaletteIndex
    );
    setCreatedSeller(seller);
    setIsProcessingInference(true);
    setStep(4);

    setTimeout(() => {
      try {
        const { orders: newOrders, products: newProducts, pincodes: newPins, customers: newCusts, summary } =
          convertRowsToOrders(seller, parsedRows, engineConfig, allCouriers);

        const { importedCount, duplicateCount } = importOrdersForSeller(
          seller,
          newOrders,
          newProducts,
          newPins,
          newCusts
        );

        setImportSummary({
          ...summary,
          validOrders: importedCount,
          duplicateRows: duplicateCount,
        });

        toast({
          title: `Welcome ${seller.name}!`,
          description: `Successfully imported ${importedCount} orders. Scoring engine active.`,
        });
      } catch (err: any) {
        console.error('Import confirmation error:', err);
        toast({
          title: 'Import Error',
          description: err.message || 'An error occurred during CSV import.',
          variant: 'destructive',
        });
      } finally {
        setIsProcessingInference(false);
      }
    }, 700);
  };

  const handleFinishAndNavigate = () => {
    onOpenChange(false);
    setLocation('/dashboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white text-[#173d42] border-[#dfe8e4] p-0 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header & Wizard Navigation */}
        <div className="px-6 py-4 border-b border-[#e5ece8] bg-[#f8faf9] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0e3b43] text-white flex items-center justify-center font-bold shadow-xs">
              <Building2 size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                {step === 1 && 'Add New Seller Workspace'}
                {step === 2 && `Upload Order Records for ${sellerName || 'Seller'}`}
                {step === 3 && 'Column Mapping & Preview Inspection'}
                {step === 4 && 'Onboarding & Intelligence Summary'}
                {step === 'live_setup' && `Live Data Connection Setup · ${createdSeller?.name || 'Seller'}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6e7f79]">
                {step === 1 && 'Define seller profile and choose between CSV import or Live Data connection'}
                {step === 2 && 'Upload order CSV with catalog pricing, unit margins & customer details'}
                {step === 3 && 'Inspect detected columns, validate rows, and resolve discrepancies'}
                {step === 4 && 'Orders isolated and scored by the Profit & Delivery Engine'}
                {step === 'live_setup' && 'Connect Replit simulator or external storefront via Cloud Firestore'}
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Dots (CSV flow) */}
          {step !== 'live_setup' && (
            <div className="hidden sm:flex items-center gap-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s
                      ? 'bg-[#0e3b43] text-white shadow-xs'
                      : (typeof step === 'number' && step > s)
                      ? 'bg-[#eaf5ef] text-[#1f8a5b]'
                      : 'bg-[#edf2ef] text-[#8fa09b]'
                  }`}
                >
                  {(typeof step === 'number' && step > s) ? <Check size={12} /> : s}
                </div>
              ))}
            </div>
          )}

          {/* Live Sync Step Pill */}
          {step === 'live_setup' && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#eaf4ef] text-[#1f8a5b] flex items-center gap-1.5">
                <Wifi size={13} className="text-[#1f8a5b] animate-pulse" />
                Live Sync Configuration
              </span>
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* ========================================================= */}
          {/* STEP 1: SELLER DETAILS & CONNECTION METHOD                 */}
          {/* ========================================================= */}
          {step === 1 && (
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              
              {/* Connection Method Selector (Requirement A) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#143d42] flex items-center gap-1.5">
                  <span>Connection Method</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: CSV Import */}
                  <div
                    onClick={() => setConnectionMethod('csv')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      connectionMethod === 'csv'
                        ? 'border-[#0e3b43] bg-[#f2f7f5] shadow-xs'
                        : 'border-[#dce6e1] bg-[#fcfdfc] hover:border-[#9bbcaf]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#eaf4ef] text-[#0e3b43] flex items-center justify-center font-bold mb-2">
                        <Upload size={16} />
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        connectionMethod === 'csv' ? 'border-[#0e3b43] bg-[#0e3b43]' : 'border-[#9bbcaf]'
                      }`}>
                        {connectionMethod === 'csv' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0e3b43]">1. Import via CSV</h4>
                      <p className="text-[11px] text-[#6d7e79] mt-0.5 leading-relaxed">
                        Upload batch CSV exports with product pricing, COGS, unit margins, and delivery pincodes.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-bold text-[#1f8a5b] inline-block">
                      Supports Ravi Toys & custom schemas
                    </span>
                  </div>

                  {/* Option 2: Connect Live Data (Requirement B) */}
                  <div
                    onClick={() => setConnectionMethod('live')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      connectionMethod === 'live'
                        ? 'border-[#0e3b43] bg-[#f2f7f5] shadow-xs'
                        : 'border-[#dce6e1] bg-[#fcfdfc] hover:border-[#9bbcaf]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#fcf2dd] text-[#b45309] flex items-center justify-center font-bold mb-2">
                        <Zap size={16} />
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        connectionMethod === 'live' ? 'border-[#0e3b43] bg-[#0e3b43]' : 'border-[#9bbcaf]'
                      }`}>
                        {connectionMethod === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0e3b43]">2. Connect Live Data</h4>
                      <p className="text-[11px] text-[#6d7e79] mt-0.5 leading-relaxed">
                        Shared Firestore stream for live orders, status transitions, and Replit webhook simulator.
                      </p>
                    </div>
                    <span className="mt-2 text-[10px] font-bold text-[#b45309] inline-block">
                      Real-time listeners & event log
                    </span>
                  </div>
                </div>
              </div>

              {/* Seller Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#143d42] flex items-center gap-1.5">
                  <span>Seller / Business Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => {
                    setSellerName(e.target.value);
                    if (step1Errors.name) setStep1Errors({ ...step1Errors, name: undefined });
                  }}
                  placeholder="e.g. Ravi Toys, Ojas Organics, CraftVibe"
                  className={`w-full p-2.5 text-sm rounded-xl border bg-[#fcfdfc] text-[#143d42] outline-none transition-all ${
                    step1Errors.name
                      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200'
                      : 'border-[#d8e3de] focus:border-[#0e3b43] focus:ring-1 focus:ring-[#0e3b43]/20'
                  }`}
                />
                {step1Errors.name && (
                  <p className="text-xs text-red-500 font-semibold">{step1Errors.name}</p>
                )}
              </div>

              {/* Seller Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#143d42] flex items-center gap-1.5">
                  <span>Seller Description</span>
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={sellerDescription}
                  onChange={(e) => {
                    setSellerDescription(e.target.value);
                    if (step1Errors.description) setStep1Errors({ ...step1Errors, description: undefined });
                  }}
                  placeholder="Short description of the business, product niche, and target market (e.g. High-quality STEM science kits and remote-control racing toys for kids across Tier 1 and Tier 2 cities)."
                  className={`w-full p-2.5 text-xs rounded-xl border bg-[#fcfdfc] text-[#143d42] outline-none transition-all leading-relaxed ${
                    step1Errors.description
                      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200'
                      : 'border-[#d8e3de] focus:border-[#0e3b43] focus:ring-1 focus:ring-[#0e3b43]/20'
                  }`}
                />
                {step1Errors.description && (
                  <p className="text-xs text-red-500 font-semibold">{step1Errors.description}</p>
                )}
              </div>

              {/* Vertical Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#143d42]">Category / Business Vertical</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-[#d8e3de] bg-[#fcfdfc] text-[#143d42] outline-none focus:border-[#0e3b43]"
                >
                  <option value="Kids & Learning Toys">Kids & Learning Toys</option>
                  <option value="Ayurvedic Skincare & Wellness">Ayurvedic Skincare & Wellness</option>
                  <option value="Artisanal Ethnic & Festive Wear">Artisanal Ethnic & Festive Wear</option>
                  <option value="Athleisure & Performance Streetwear">Athleisure & Performance Streetwear</option>
                  <option value="Sustainable Home & Ceramic Decor">Sustainable Home & Ceramic Decor</option>
                  <option value="Electronics & Consumer Tech">Electronics & Consumer Tech</option>
                  <option value="D2C Consumer Retail">General D2C Retail</option>
                </select>
              </div>

              {/* Brand Palette Preset Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-[#143d42]">Workspace Brand Tone</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BRAND_PALETTES.map((pal, idx) => {
                    const isSelected = selectedPaletteIndex === idx;
                    return (
                      <button
                        type="button"
                        key={pal.name}
                        onClick={() => setSelectedPaletteIndex(idx)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                          isSelected
                            ? 'border-[#0e3b43] bg-[#f0f6f4] ring-1 ring-[#0e3b43]'
                            : 'border-[#e0e8e4] bg-[#fcfdfc] hover:border-[#b4c8c1]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: pal.primary }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-[#0e3b43] truncate">{pal.name}</p>
                        </div>
                        {isSelected && <Check size={13} className="text-[#0e3b43] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Preset Action: Pre-fill Ravi Toys */}
              <div className="bg-[#fdfaf3] border border-[#f3e5c8] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#d97706]" />
                  <div>
                    <span className="text-xs font-bold text-[#855306]">Testing Ravi Toys dataset?</span>
                    <p className="text-[11px] text-[#9a6a1a]">Auto-fill name, description and load the 10-order catalog CSV.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadRaviToys}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#d97706] text-white hover:bg-[#b45309] shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  Load Ravi Toys
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* LIVE_SETUP SCREEN: CONNECT LIVE DATA WORKFLOW (Req B)      */}
          {/* ========================================================= */}
          {step === 'live_setup' && createdSeller && (
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              
              {/* Connection Status Banner */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                liveStatus === 'connected'
                  ? 'bg-[#f0f9f4] border-[#b8dec9]'
                  : liveStatus === 'connecting'
                  ? 'bg-[#f0f6fa] border-[#c0d8e8]'
                  : liveStatus === 'error'
                  ? 'bg-[#fdf2f2] border-[#f5c6c6]'
                  : 'bg-[#fafbfa] border-[#e1e8e4]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    liveStatus === 'connected'
                      ? 'bg-[#1f8a5b] text-white shadow-xs'
                      : liveStatus === 'connecting'
                      ? 'bg-[#0284c7] text-white animate-pulse'
                      : liveStatus === 'error'
                      ? 'bg-red-600 text-white'
                      : 'bg-[#e2eae6] text-[#556964]'
                  }`}>
                    {liveStatus === 'connected' && <CheckCircle2 size={20} />}
                    {liveStatus === 'connecting' && <Wifi size={20} />}
                    {liveStatus === 'error' && <AlertTriangle size={20} />}
                    {liveStatus === 'not_connected' && <Clock3 size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#0e3b43]">
                        {liveStatus === 'connected' && 'Live Connection Verified'}
                        {liveStatus === 'connecting' && 'Connecting to Firestore Stream...'}
                        {liveStatus === 'error' && 'Connection Error'}
                        {liveStatus === 'not_connected' && 'Not Connected · Awaiting First Payload'}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        liveStatus === 'connected'
                          ? 'bg-[#d8f0e2] text-[#156b46]'
                          : liveStatus === 'connecting'
                          ? 'bg-[#d9ecf7] text-[#0369a1]'
                          : liveStatus === 'error'
                          ? 'bg-[#fcdada] text-red-700'
                          : 'bg-[#edeae1] text-[#786c52]'
                      }`}>
                        {liveStatus === 'connected' ? 'Connected' : liveStatus === 'connecting' ? 'Connecting' : liveStatus === 'error' ? 'Error' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6e7f79] mt-0.5">
                      {liveStatus === 'connected'
                        ? `Received verified records (${liveOrdersCount} orders, ${liveEventsCount} events) from simulator.`
                        : liveStatus === 'connecting'
                        ? 'Listening for incoming orders at sellers/' + createdSeller.id + '/orders'
                        : liveStatus === 'error'
                        ? 'Check Firestore database rules and network connectivity.'
                        : 'Simulator or storefront has not sent records for this seller ID yet.'}
                    </p>
                  </div>
                </div>

                {/* Instant Test Action */}
                <button
                  type="button"
                  disabled={isSendingSimulated}
                  onClick={handleSendTestPayload}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0e3b43] text-white hover:bg-[#154c55] shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send size={13} className={isSendingSimulated ? 'animate-spin' : ''} />
                  <span>{isSendingSimulated ? 'Sending...' : 'Send Test Order'}</span>
                </button>
              </div>

              {/* Generated Seller ID Card (Requirement B.5) */}
              <div className="bg-[#f6faf8] border border-[#d6e5de] rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-bold text-[#556965] uppercase tracking-wider block">
                  Generated Stable Seller ID
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-[#d2ded8] rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#0e3b43] select-all overflow-x-auto">
                    {createdSeller.id}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySellerId}
                    className="px-4 py-2.5 rounded-xl border border-[#0e3b43] bg-[#0e3b43] text-white hover:bg-[#154c55] text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedSellerId ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSellerId ? 'Copied!' : 'Copy Seller ID'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#6d7e79]">
                  Pass this exact seller ID in your Replit simulator, webhook payloads, or external courier sync headers.
                </p>
              </div>

              {/* Setup Guide for Simulator / Replit Backend (Requirement B.6 & E) */}
              <div className="bg-white border border-[#e1e8e4] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0e3b43]">
                  <Server size={16} className="text-[#0e3b43]" />
                  <span>Firestore Integration Setup Guide</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#f8faf9] border border-[#e8eeea]">
                    <span className="text-[10px] text-[#718580] uppercase block">Firebase Project ID</span>
                    <strong className="font-mono text-[#0e3b43] font-bold">{config.projectId}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8faf9] border border-[#e8eeea]">
                    <span className="text-[10px] text-[#718580] uppercase block">Firestore Database ID</span>
                    <strong className="font-mono text-[#0e3b43] font-bold truncate block">{config.firestoreDatabaseId}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#fcfdfc] border border-[#e1e8e4] text-xs space-y-1.5 leading-relaxed text-[#556965]">
                  <p className="font-semibold text-[#0e3b43]">How to send payloads from the simulator:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11.5px]">
                    <li>
                      <b>Orders:</b> Write document to <code className="bg-[#edf4f0] px-1 py-0.5 rounded text-[#0e3b43]">sellers/{createdSeller.id}/orders/&#123;orderId&#125;</code> with <code className="text-[#1f8a5b]">value</code>, <code className="text-[#1f8a5b]">payment</code>, and <code className="text-[#1f8a5b]">status</code>.
                    </li>
                    <li>
                      <b>Events:</b> Write document to <code className="bg-[#edf4f0] px-1 py-0.5 rounded text-[#0e3b43]">sellers/{createdSeller.id}/events/&#123;eventId&#125;</code> with <code className="text-[#1f8a5b]">type</code> and <code className="text-[#1f8a5b]">timestamp</code>.
                    </li>
                    <li>
                      <b>Idempotency:</b> Status updates must update the existing order record rather than duplicating IDs.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Status Notice */}
              <div className="bg-[#fdfaf3] border border-[#f3e5c8] rounded-xl p-3 flex items-start gap-2 text-xs text-[#855306]">
                <Info size={15} className="shrink-0 mt-0.5 text-[#d97706]" />
                <span>
                  <b>Connection Verification Rule:</b> Arithva will maintain "Not connected" until a verified order or event record is detected in the database. Use the <b>Send Test Order</b> button above or trigger your Replit simulator.
                </span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: CSV UPLOAD                                        */}
          {/* ========================================================= */}
          {step === 2 && (
            <div className="space-y-4 max-w-2xl mx-auto py-2">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[#0e3b43] bg-[#edf4f0]'
                    : fileName
                    ? 'border-[#1f8a5b] bg-[#f2f9f5]'
                    : 'border-[#cfded8] hover:border-[#0e3b43] bg-[#fafcfb]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-12 h-12 rounded-2xl bg-[#eaf4ef] text-[#0e3b43] mx-auto flex items-center justify-center font-bold mb-3 shadow-xs">
                  <Upload size={22} />
                </div>

                <h3 className="text-sm font-bold text-[#0e3b43]">
                  {fileName ? 'CSV File Selected' : 'Drag & drop your order CSV file here'}
                </h3>
                <p className="text-xs text-[#6e7f79] mt-1">
                  {fileName
                    ? `${fileName} (${((fileSize || 0) / 1024).toFixed(1)} KB)`
                    : 'Supports UTF-8 CSV exports with order IDs, catalog products, prices, margins & pincodes'}
                </p>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-[#d6e2de] text-[#0e3b43] shadow-xs">
                    Browse Files
                  </span>
                  {fileName && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearFile();
                      }}
                      className="px-2 py-1.5 text-xs text-red-600 hover:text-red-700 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {isParsing && (
                <div className="p-3 bg-[#eaf4ef] rounded-xl flex items-center gap-2 text-xs text-[#0e3b43] font-semibold">
                  <RotateCcw className="animate-spin text-[#1f8a5b]" size={15} />
                  <span>Parsing CSV headers and validating record structures...</span>
                </div>
              )}

              {fileName && !isParsing && (
                <div className="p-3.5 bg-[#f6faf8] border border-[#d6e5de] rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <FileText className="text-[#1f8a5b]" size={18} />
                    <div>
                      <span className="font-bold text-[#0e3b43]">{fileName}</span>
                      <span className="text-[#6e7f79] ml-2">
                        {rawRows.length} data rows detected · {detectedHeaders.length} columns
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#1f8a5b] bg-[#eaf5ef] px-2 py-0.5 rounded-full">
                    Readable & Usable
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLoadRaviToys}
                  className="p-3 rounded-xl border border-[#e1e9e4] bg-[#f8faf9] hover:bg-[#edf5f1] hover:border-[#9bbcaf] text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0e3b43] mb-0.5">
                    <Sparkles size={14} className="text-[#d97706]" />
                    <span>Load Ravi Toys Sample Dataset</span>
                  </div>
                  <p className="text-[11px] text-[#6d7e79] leading-relaxed">
                    10 authentic toy orders with COD/Prepaid mix, unit margins, and pincodes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="p-3 rounded-xl border border-[#e1e9e4] bg-[#f8faf9] hover:bg-[#edf5f1] hover:border-[#9bbcaf] text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0e3b43] mb-0.5">
                    <Download size={14} className="text-[#1f8a5b]" />
                    <span>Download CSV Template</span>
                  </div>
                  <p className="text-[11px] text-[#6d7e79] leading-relaxed">
                    Standard schema template formatted for Price, COGS, Unit Margin, Address, and Pincode.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: COLUMN MAPPING & PREVIEW (CSV flow)                */}
          {/* ========================================================= */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-2.5 rounded-xl border border-[#e1e8e4] bg-[#fbfdfc]">
                  <span className="text-[10px] font-bold text-[#728580] uppercase tracking-wider block">Total Rows</span>
                  <strong className="text-base font-bold text-[#0e3b43]">{rowStats.total}</strong>
                </div>
                <div className="p-2.5 rounded-xl border border-[#cbe3d5] bg-[#f2f9f5]">
                  <span className="text-[10px] font-bold text-[#1f8a5b] uppercase tracking-wider block">Ready to Score</span>
                  <strong className="text-base font-bold text-[#1f8a5b]">{rowStats.usable}</strong>
                </div>
                <div className="p-2.5 rounded-xl border border-[#f5dfb8] bg-[#fdfaf3]">
                  <span className="text-[10px] font-bold text-[#d97706] uppercase tracking-wider block">Warnings</span>
                  <strong className="text-base font-bold text-[#d97706]">{rowStats.warning}</strong>
                </div>
                <div className="p-2.5 rounded-xl border border-[#fed7d7] bg-[#fff5f5]">
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Invalid Rows</span>
                  <strong className="text-base font-bold text-red-600">{rowStats.invalid}</strong>
                </div>
                <div className="p-2.5 rounded-xl border border-[#e1e8e4] bg-[#f8faf9]">
                  <span className="text-[10px] font-bold text-[#718580] uppercase tracking-wider block">Duplicates</span>
                  <strong className="text-base font-bold text-[#718580]">{rowStats.duplicate}</strong>
                </div>
              </div>

              <div className="bg-[#f6faf8] border border-[#d6e5de] rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-[#0e3b43]" />
                    <div>
                      <span className="text-xs font-bold text-[#0e3b43]">Column Header Mapping</span>
                      <p className="text-[11px] text-[#6e7f79]">Auto-matched to Ravi Toys & standard ecommerce schema</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMappingEditor(!showMappingEditor)}
                    className="text-xs font-bold text-[#0e3b43] hover:underline"
                  >
                    {showMappingEditor ? 'Hide Mapping Settings' : 'Customize Column Mappings'}
                  </button>
                </div>

                {showMappingEditor && (
                  <div className="mt-3 pt-3 border-t border-[#e2ece6] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'orderId', label: 'Order ID' },
                      { key: 'product', label: 'Catalog Product' },
                      { key: 'price', label: 'Price (INR)' },
                      { key: 'cogs', label: 'COGS (INR)' },
                      { key: 'unitMargin', label: 'Unit Margin (INR)' },
                      { key: 'customerName', label: 'Customer Full Name' },
                      { key: 'customerPhone', label: 'Phone Number' },
                      { key: 'address', label: 'Street Address' },
                      { key: 'compositeLocation', label: 'Pincode, City, State, RTO %' },
                      { key: 'payment', label: 'Payment Method' },
                      { key: 'campaign', label: 'Campaign Source' },
                      { key: 'statusCol', label: 'Order Status (Optional)' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[10.5px] font-bold text-[#556965] truncate block">{label}</label>
                        <select
                          value={(columnMapping as any)[key] || ''}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [key]: e.target.value })}
                          className="w-full text-xs p-1.5 rounded-lg border border-[#d2ded8] bg-white text-[#12393d] outline-none"
                        >
                          <option value="">-- Unmapped --</option>
                          {detectedHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Preview Table */}
              <div className="border border-[#e1e8e4] rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-[#f8faf9] border-b border-[#e1e8e4] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0e3b43]">
                    Data Preview ({Math.min(10, parsedRows.length)} of {parsedRows.length} rows)
                  </span>
                  <span className="text-[11px] text-[#6d7e79]">
                    Hover over warnings to review field discrepancies
                  </span>
                </div>

                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f0f4f2] text-[#4b605b] font-bold border-b border-[#e1e8e4] sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Order ID</th>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5 text-right">Price</th>
                        <th className="p-2.5 text-right">COGS</th>
                        <th className="p-2.5 text-right">Margin</th>
                        <th className="p-2.5">Customer</th>
                        <th className="p-2.5">Pincode / City</th>
                        <th className="p-2.5">Payment</th>
                        <th className="p-2.5">Channel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2ef]">
                      {parsedRows.slice(0, 10).map((r) => (
                        <tr key={r.rawIndex} className="hover:bg-[#f9fbf9] transition-colors">
                          <td className="p-2.5 whitespace-nowrap">
                            {r.status === 'valid' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#eaf5ef] text-[#1f8a5b]">
                                <CheckCircle2 size={10} /> Valid
                              </span>
                            )}
                            {r.status === 'warning' && (
                              <span
                                title={r.warningMessages.join('; ')}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#fef3c7] text-[#92400e] cursor-help"
                              >
                                <AlertTriangle size={10} /> Warning
                              </span>
                            )}
                            {r.status === 'invalid' && (
                              <span
                                title={r.errorMessages.join('; ')}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#fee2e2] text-red-700 cursor-help"
                              >
                                <AlertCircle size={10} /> Invalid
                              </span>
                            )}
                            {r.status === 'duplicate' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#f3f4f6] text-[#4b5563]">
                                Duplicate
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-[#0e3b43]">{r.orderId}</td>
                          <td className="p-2.5 text-[#304845] max-w-[150px] truncate" title={r.productName}>
                            {r.productName}
                          </td>
                          <td className="p-2.5 text-right font-medium text-[#143d42]">₹{r.price}</td>
                          <td className="p-2.5 text-right text-[#6e7f79]">₹{r.cogs}</td>
                          <td className="p-2.5 text-right font-bold text-[#1f8a5b]">
                            ₹{r.unitMargin}
                            {r.marginDiscrepancy && (
                              <span className="text-[9px] text-[#b45309] block">
                                calc: ₹{r.calculatedMargin}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-[#304845] truncate max-w-[110px]" title={r.customerName}>
                            {r.customerName}
                          </td>
                          <td className="p-2.5 text-[#304845] whitespace-nowrap">
                            {r.pincode} <span className="text-[10px] text-[#718580]">({r.city})</span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              r.payment === 'Prepaid' ? 'bg-[#eaf5ef] text-[#1f8a5b]' : 'bg-[#fcf2dd] text-[#a76c05]'
                            }`}>
                              {r.payment}
                            </span>
                          </td>
                          <td className="p-2.5 text-[#6c7d79] whitespace-nowrap">{r.campaign}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: SUMMARY & CONFIRMATION (CSV flow)                  */}
          {/* ========================================================= */}
          {step === 4 && (
            <div className="space-y-4 max-w-xl mx-auto py-4 text-center">
              {isProcessingInference ? (
                <div className="space-y-3 py-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#0e3b43] text-white mx-auto flex items-center justify-center animate-pulse shadow-md">
                    <BrainCircuit size={28} />
                  </div>
                  <h3 className="text-base font-bold text-[#0e3b43]">
                    Running Profit & Delivery Intelligence Engine...
                  </h3>
                  <p className="text-xs text-[#6e7f79]">
                    Scoring orders, computing expected margins, and evaluating journeys for {createdSeller?.name}...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#eaf5ef] text-[#1f8a5b] mx-auto flex items-center justify-center font-bold shadow-xs">
                    <ShieldCheck size={28} />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                      Onboarding & Ingestion Complete!
                    </h3>
                    <p className="text-xs text-[#6e7f79] mt-1">
                      {createdSeller?.name} workspace is live and populated in Arithva.
                    </p>
                  </div>

                  {importSummary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left pt-2">
                      <div className="p-3 rounded-xl border border-[#d6e5de] bg-[#f9fbf9]">
                        <span className="text-[10px] font-bold text-[#627771] uppercase tracking-wider block">Total CSV Rows</span>
                        <strong className="text-sm font-bold text-[#0e3b43]">{importSummary.totalRows}</strong>
                      </div>
                      <div className="p-3 rounded-xl border border-[#cbe3d5] bg-[#f2f9f5]">
                        <span className="text-[10px] font-bold text-[#1f8a5b] uppercase tracking-wider block">Imported Orders</span>
                        <strong className="text-sm font-bold text-[#1f8a5b]">{importSummary.validOrders}</strong>
                      </div>
                      <div className="p-3 rounded-xl border border-[#cbe3d5] bg-[#f2f9f5]">
                        <span className="text-[10px] font-bold text-[#1f8a5b] uppercase tracking-wider block">Engine Scored</span>
                        <strong className="text-sm font-bold text-[#1f8a5b]">{importSummary.scoredOrders}</strong>
                      </div>
                      <div className="p-3 rounded-xl border border-[#e1e8e4] bg-[#fbfdfc]">
                        <span className="text-[10px] font-bold text-[#627771] uppercase tracking-wider block">Duplicate Skipped</span>
                        <strong className="text-sm font-bold text-[#0e3b43]">{importSummary.duplicateRows}</strong>
                      </div>
                      <div className="p-3 rounded-xl border border-[#e1e8e4] bg-[#fbfdfc]">
                        <span className="text-[10px] font-bold text-[#627771] uppercase tracking-wider block">Invalid Rows</span>
                        <strong className="text-sm font-bold text-[#0e3b43]">{importSummary.invalidRows}</strong>
                      </div>
                      <div className="p-3 rounded-xl border border-[#e1e8e4] bg-[#fbfdfc]">
                        <span className="text-[10px] font-bold text-[#627771] uppercase tracking-wider block">Inference Failures</span>
                        <strong className="text-sm font-bold text-[#1f8a5b]">{importSummary.inferenceFailures} (Zero)</strong>
                      </div>
                    </div>
                  )}

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleFinishAndNavigate}
                      className="w-full py-3 rounded-xl text-sm font-bold bg-[#0e3b43] text-white hover:bg-[#134954] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Open {createdSeller?.name || 'Seller'} Dashboard</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        {step !== 4 && step !== 'live_setup' && (
          <div className="px-6 py-3.5 border-t border-[#e5ece8] bg-[#f8faf9] flex items-center justify-between">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-xs font-semibold text-[#667873] hover:text-[#0e3b43] transition-colors"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="px-3.5 py-2 text-xs font-semibold text-[#0e3b43] hover:bg-[#eaf2ef] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}

            <div>
              {step === 1 && (
                <button
                  type="button"
                  onClick={handleStep1Continue}
                  className="px-5 py-2 text-xs font-bold bg-[#0e3b43] text-white hover:bg-[#134954] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{connectionMethod === 'live' ? 'Create Live Seller & Connect' : 'Continue to CSV Upload'}</span>
                  <ArrowRight size={14} />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  disabled={!rawCsvText.trim() || isParsing}
                  onClick={() => setStep(3)}
                  className="px-5 py-2 text-xs font-bold bg-[#0e3b43] text-white hover:bg-[#134954] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Inspect & Map Columns</span>
                  <ArrowRight size={14} />
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  disabled={rowStats.usable === 0}
                  onClick={handleConfirmImport}
                  className="px-5 py-2 text-xs font-bold bg-[#1f8a5b] text-white hover:bg-[#176d47] rounded-xl shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Confirm Import & Run Intelligence</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Setup Footer Actions (Requirement B.9) */}
        {step === 'live_setup' && (
          <div className="px-6 py-3.5 border-t border-[#e5ece8] bg-[#f8faf9] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBackFromLiveSetup}
              className="px-3.5 py-2 text-xs font-semibold text-[#0e3b43] hover:bg-[#eaf2ef] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelLiveSetup}
                className="px-4 py-2 text-xs font-semibold text-[#667873] hover:text-[#0e3b43] transition-colors cursor-pointer"
              >
                Cancel Setup
              </button>
              <button
                type="button"
                onClick={handleConfirmLiveSeller}
                className="px-5 py-2 text-xs font-bold bg-[#0e3b43] text-white hover:bg-[#134954] rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open {createdSeller?.name || 'Seller'} Dashboard</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}

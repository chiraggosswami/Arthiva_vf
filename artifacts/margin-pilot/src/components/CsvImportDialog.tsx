import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Upload, FileText, CheckCircle2, AlertTriangle, Sparkles, Copy } from 'lucide-react';
import { useImportListings, useImportReviews } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLATFORMS = [
  { id: 'shopify', name: 'Shopify', isSimulated: false, note: 'Direct store connector' },
  { id: 'myntra', name: 'Myntra', isSimulated: true, note: 'Simulated marketplace adapter' },
  { id: 'amazon', name: 'Amazon India', isSimulated: true, note: 'Simulated marketplace adapter' },
  { id: 'flipkart', name: 'Flipkart', isSimulated: true, note: 'Simulated marketplace adapter' },
  { id: 'woocommerce', name: 'WooCommerce', isSimulated: true, note: 'Simulated store adapter' },
] as const;

const SAMPLE_LISTING_CSV = `sku,platform,title,category,price,description,size_chart_present
SKU-ETH-01,shopify,Midnight Royal Blue Anarkali Kurta Set,Apparel,2499,Pure modal silk royal blue kurta with gold zari embroidery,true
SKU-WES-02,myntra,High-Waist Tailored Slim Fit Chinos,Apparel,1599,Stretch cotton slim fit chinos without size chart,false
SKU-CAS-03,amazon,100% Pure Organic Cotton Oversized Graphic Tee,Apparel,899,Pure combed cotton heavy-gauge tee,true`;

const SAMPLE_REVIEW_CSV = `sku,platform,rating,text,date,photos,return_reason
SKU-ETH-01,shopify,1,Photo me royal blue dikh raha tha par deliver blackish navy hua. Bilkul alag color hai.,2026-10-01,true,Colour mismatch
SKU-WES-02,myntra,2,Size M order kiya tha par ye XS jaisa tight hai! Fitting bilkul galat hai.,2026-10-03,false,Size / fit issue
SKU-CAS-03,amazon,1,Description me 100% organic cotton likha hai par tag pe 60% polyester nikla.,2026-10-05,false,Description mismatch`;

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const [importType, setImportType] = useState<'listings' | 'reviews'>('reviews');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('shopify');
  const [csvContent, setCsvContent] = useState<string>(SAMPLE_REVIEW_CSV);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const importListingsMutation = useImportListings();
  const importReviewsMutation = useImportReviews();

  const activePlatformInfo = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  const handleTypeChange = (type: 'listings' | 'reviews') => {
    setImportType(type);
    setCsvContent(type === 'listings' ? SAMPLE_LISTING_CSV : SAMPLE_REVIEW_CSV);
  };

  const handleLoadPreset = (presetType: 'kurta' | 'chinos' | 'tee') => {
    if (presetType === 'kurta') {
      setSelectedPlatform('shopify');
      setCsvContent(`sku,platform,rating,text,date,photos,return_reason
SKU-ETH-01,shopify,1,Royal blue photo me bright aur vibrant dikha tha par real me bohot dark blackish navy nikla.,2026-10-08,true,Colour mismatch
SKU-ETH-01,shopify,2,Color shade does not match website catalog photo at all. Dull finish.,2026-10-09,false,Colour mismatch`);
    } else if (presetType === 'chinos') {
      setSelectedPlatform('myntra');
      setCsvContent(`sku,platform,rating,text,date,photos,return_reason
SKU-WES-02,myntra,1,Runs 2 sizes too small! Waist band has no stretch as advertised. Returning immediately.,2026-10-08,false,Size / fit issue
SKU-WES-02,myntra,2,Listing me size chart missing tha isliye 32 liya, par thigh fit bohot tight hai.,2026-10-09,false,Size / fit issue`);
    } else {
      setSelectedPlatform('amazon');
      setCsvContent(`sku,platform,rating,text,date,photos,return_reason
SKU-CAS-03,amazon,1,Item says 100% pure organic cotton but tag says 60% synthetic polyester. Fraud specification.,2026-10-08,true,Description mismatch
SKU-CAS-03,amazon,2,Misleading material. It feels like hot polyester, definitely not combed cotton.,2026-10-09,false,Description mismatch`);
    }
    setImportType('reviews');
  };

  const parseCsvToJson = (csv: string): Record<string, any>[] => {
    const lines = csv.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const items: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const item: Record<string, any> = {};
      headers.forEach((h, idx) => {
        item[h] = values[idx] ?? '';
      });
      items.push(item);
    }
    return items;
  };

  const handleImport = async () => {
    const items = parseCsvToJson(csvContent);
    if (items.length === 0) {
      toast({
        title: 'CSV Parsing Error',
        description: 'Please provide valid CSV content with a header row and data rows.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (importType === 'listings') {
        const res = await importListingsMutation.mutateAsync({
          data: {
            platform: selectedPlatform,
            items,
          },
        });
        toast({
          title: 'Listings Ingested',
          description: `Successfully imported ${res.importedCount ?? items.length} listings from ${activePlatformInfo.name}. ${res.isSimulated ? '(Simulated connector)' : ''}`,
        });
      } else {
        const res = await importReviewsMutation.mutateAsync({
          data: {
            platform: selectedPlatform,
            items,
          },
        });
        toast({
          title: 'Reviews & Returns Ingested',
          description: `Ingested ${res.totalImported ?? items.length} records. Re-running listing pipeline to refresh scores...`,
        });
      }

      await queryClient.invalidateQueries();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err.message || 'Failed to import CSV records.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const rowCount = Math.max(0, csvContent.trim().split('\n').filter(Boolean).length - 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white text-[#173d42] border-[#dfe8e4] p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#eaf5ef] text-[#1a624b] flex items-center justify-center font-bold">
              <Upload size={16} />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                Import Catalog & Feedback CSV
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6e7f79]">
                Ingest catalog SKUs or marketplace reviews and return reasons to update accuracy scores.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Target Type Selector */}
          <div className="flex rounded-lg bg-[#edf2ef] p-1 gap-1">
            <button
              type="button"
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                importType === 'reviews'
                  ? 'bg-white text-[#0e3b43] shadow-sm'
                  : 'text-[#6e7f79] hover:text-[#0e3b43]'
              }`}
              onClick={() => handleTypeChange('reviews')}
            >
              Reviews & Returns ({importType === 'reviews' ? 'Active' : 'Switch'})
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                importType === 'listings'
                  ? 'bg-white text-[#0e3b43] shadow-sm'
                  : 'text-[#6e7f79] hover:text-[#0e3b43]'
              }`}
              onClick={() => handleTypeChange('listings')}
            >
              Product Catalog SKUs
            </button>
          </div>

          {/* Platform Selector with Simulated Connector Badge */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <label className="text-xs font-semibold text-[#526965]">
              Source Platform / Adapter
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="mt-1 w-full border border-[#dce5e0] bg-[#fbfcfb] rounded-md p-2 text-xs font-medium text-[#21464a] outline-none focus:border-[#2a7868]"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isSimulated ? '(Simulated Connector)' : '(Connected Store)'}
                  </option>
                ))}
              </select>
            </label>

            <div className="p-2.5 rounded-lg border border-[#e1e8e4] bg-[#f8faf9] flex items-center justify-between">
              <div>
                <small className="block text-[10px] text-[#869590] uppercase tracking-wider font-bold">Connector Status</small>
                <span className="text-xs font-bold text-[#1a4a4d]">{activePlatformInfo.name}</span>
              </div>
              {activePlatformInfo.isSimulated ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fcf2dd] text-[#a76c05]">
                  <AlertTriangle size={11} /> Simulated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e9f5ee] text-[#1d8057]">
                  <CheckCircle2 size={11} /> Connected
                </span>
              )}
            </div>
          </div>

          {/* Quick Presets for Demo */}
          <div className="bg-[#f7faf8] border border-[#e4ece7] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#325b55] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#d97706]" /> Quick Realistic Presets
              </span>
              <span className="text-[10px] text-[#7d8f89]">Click to load test data</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleLoadPreset('kurta')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#d5ded8] hover:border-[#2a7868] text-[#1b514d] rounded-md transition-colors"
              >
                Kurta Colour Mismatch (Shopify)
              </button>
              <button
                type="button"
                onClick={() => handleLoadPreset('chinos')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#d5ded8] hover:border-[#2a7868] text-[#1b514d] rounded-md transition-colors"
              >
                Chinos Sizing Issue (Myntra - Sim)
              </button>
              <button
                type="button"
                onClick={() => handleLoadPreset('tee')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#d5ded8] hover:border-[#2a7868] text-[#1b514d] rounded-md transition-colors"
              >
                Cotton Tee Fabric Mismatch (Amazon - Sim)
              </button>
            </div>
          </div>

          {/* Column Mapping Guide */}
          <div className="text-[11px] text-[#6b7c76] bg-[#f4f7f5] p-2.5 rounded-lg border border-[#e2ebe5]">
            <span className="font-bold text-[#1f4a46] block mb-1">
              Documented Column Format ({importType === 'listings' ? 'Listings' : 'Reviews & Returns'}):
            </span>
            <code className="text-[10px] font-mono text-[#0e3b43] bg-white px-1.5 py-0.5 rounded border border-[#dae3dd] block overflow-x-auto">
              {importType === 'listings'
                ? 'sku, platform, title, category, price, description, size_chart_present'
                : 'sku, platform, rating, text, date, photos, return_reason'}
            </code>
          </div>

          {/* CSV Input Area */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-[#526965]">CSV Data (Comma-Separated)</label>
              <span className="text-[11px] font-bold text-[#2a7868]">{rowCount} records ready</span>
            </div>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste raw CSV content with header row here..."
              className="w-full font-mono text-xs p-2.5 border border-[#dce5e0] bg-[#fbfcfb] rounded-lg text-[#21464a] outline-none focus:border-[#2a7868] leading-relaxed resize-y"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex sm:justify-between items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-semibold text-[#667873] hover:text-[#0e3b43] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || rowCount === 0}
            onClick={handleImport}
            className="button button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            <Upload size={14} />
            {isSubmitting ? 'Ingesting...' : `Import ${rowCount} ${importType === 'listings' ? 'SKUs' : 'Records'}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

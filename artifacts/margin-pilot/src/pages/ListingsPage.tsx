import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  Search,
  Filter,
  ArrowRight,
  Upload,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  ShieldAlert,
  Layers,
  RefreshCw,
  Info,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  useListListings,
  useGetListingsSummary,
  useRunListingPipeline,
  type ListingScoreSummaryDto,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { CsvImportDialog } from '@/components/CsvImportDialog';
import { useAppState } from '@/state/AppState';

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const SIMULATED_PLATFORMS = new Set(['myntra', 'amazon', 'flipkart', 'woocommerce']);

function AccuracyBadge({ score }: { score: number }) {
  const tone = score >= 80 ? 'low' : score >= 50 ? 'mid' : 'high';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Watch' : 'High risk';
  return (
    <span className={`risk-pill ${tone}`}>
      <i />
      {score}/100 · {label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const isSim = SIMULATED_PLATFORMS.has(platform.toLowerCase());
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="capitalize font-semibold text-xs text-[#244b48]">{platform}</span>
      {isSim ? (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#fcf2dd] text-[#9b6807] border border-[#f5e4bd]"
          title="Simulated connector adapter"
        >
          Simulated
        </span>
      ) : (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e9f5ee] text-[#1c7851] border border-[#d6ecde]"
          title="Direct store connection"
        >
          Connected
        </span>
      )}
    </span>
  );
}

function IssueTag({ issue }: { issue: string | null | undefined }) {
  if (!issue) {
    return <span className="text-[#8e9c97] text-xs">No dominant issue</span>;
  }
  const clean = issue.replace(/_/g, ' ');
  const isCritical = issue.includes('colour') || issue.includes('fit') || issue.includes('description');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold capitalize ${
        isCritical ? 'bg-[#faece9] text-[#b43e32]' : 'bg-[#edf2ef] text-[#4d665f]'
      }`}
    >
      <AlertTriangle size={12} /> {clean}
    </span>
  );
}

export default function ListingsPage() {
  const [q, setQ] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  const { currentSeller } = useAppState();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: listingsData, isLoading: isLoadingListings, refetch } = useListListings();
  const { data: summaryData } = useGetListingsSummary();
  const runPipelineMutation = useRunListingPipeline();

  const listings = useMemo<ListingScoreSummaryDto[]>(() => {
    return Array.isArray(listingsData) ? listingsData : [];
  }, [listingsData]);

  const filtered = useMemo(() => {
    return listings.filter((item) => {
      const matchQ =
        `${item.sku} ${item.title} ${item.category} ${item.platform}`
          .toLowerCase()
          .includes(q.toLowerCase());
      const matchPlatform =
        platformFilter === 'All' || item.platform.toLowerCase() === platformFilter.toLowerCase();
      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Flagged (<70)' && (item.accuracyScore ?? 100) < 70) ||
        (statusFilter === 'Healthy (80+)' && (item.accuracyScore ?? 100) >= 80) ||
        (statusFilter === 'Has Open Issues' && (item.openIssuesCount ?? 0) > 0);

      return matchQ && matchPlatform && matchStatus;
    });
  }, [listings, q, platformFilter, statusFilter]);

  const totalLoss = summaryData?.totalEstimatedLoss ?? listings.reduce((acc, l) => acc + (l.estimatedLoss || 0), 0);
  const totalSaving = summaryData?.totalEstimatedSaving ?? listings.reduce((acc, l) => acc + (l.estimatedSaving || 0), 0);
  const avgScore = summaryData?.averageAccuracyScore ?? (listings.length > 0 ? Math.round(listings.reduce((acc, l) => acc + (l.accuracyScore || 100), 0) / listings.length) : 100);
  const flaggedCount = summaryData?.flaggedListings ?? listings.filter((l) => (l.accuracyScore || 100) < 70).length;

  const handleRunPipeline = async () => {
    try {
      await runPipelineMutation.mutateAsync({});
      await queryClient.invalidateQueries();
      await refetch();
      toast({
        title: 'Listing Intelligence Pipeline Executed',
        description: 'Analyzed feedback text, validated catalog images, and recalculated listing accuracy scores.',
      });
    } catch (err: any) {
      toast({
        title: 'Pipeline Run Failed',
        description: err.message || 'Could not complete pipeline execution.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>CATALOG DIAGNOSTICS</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Listing intelligence
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Connect customer reviews, return reasons, and photos back to listing defects. Fix copy and imagery to cut preventable RTOs.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="button button-soft inline-flex items-center gap-1.5 text-xs font-bold"
            data-testid="button-import-csv"
          >
            <Upload size={14} /> Import CSV
          </button>
          <button
            type="button"
            disabled={runPipelineMutation.isPending}
            onClick={handleRunPipeline}
            className="button button-primary inline-flex items-center gap-1.5 text-xs font-bold"
            data-testid="button-run-pipeline"
          >
            <RefreshCw size={14} className={runPipelineMutation.isPending ? 'animate-spin' : ''} />
            {runPipelineMutation.isPending ? 'Analyzing...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {/* BENTO GRID ROW 1: 4 TOP STAT TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Accuracy Score */}
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>Average Accuracy Score</span>
            <Sparkles size={15} className="text-[#1f8a5b]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] mt-2 money">
            {avgScore}/100
          </b>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-[#edf2ef] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${avgScore}%`, background: avgScore >= 80 ? '#1f8a5b' : avgScore >= 60 ? '#f5a524' : '#bd4136' }}
              />
            </div>
            <span className="text-[11px] font-bold text-[#6a7c78]">{avgScore}% score</span>
          </div>
        </div>

        {/* Tile 2: Flagged SKUs */}
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>Flagged Catalog SKUs</span>
            <ShieldAlert size={15} className={flaggedCount > 0 ? 'text-[#bd4136]' : 'text-[#1f8a5b]'} />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] mt-2 money" style={{ color: flaggedCount > 0 ? '#bd4136' : '#1c7553' }}>
            {flaggedCount}
          </b>
          <small className="text-xs text-[#98a39f] mt-1 block">Score below 70 requiring review</small>
        </div>

        {/* Tile 3: Estimated Return Drag */}
        <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-[#71827d]">
            <span>Return Drag From Defects</span>
            <TrendingDown size={15} className="text-[#bd4136]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#b83f33] mt-2 money">
            {money(totalLoss)}
          </b>
          <small className="text-xs text-[#268058] font-semibold mt-1 block">
            Recoverable: {money(totalSaving)} via fixes
          </small>
        </div>

        {/* Tile 4: Sync & Connector Status */}
        <div className="bg-[#f4f8f6] p-5 rounded-[20px] border border-[#d6ecde] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-[#226750]">
            <span>Channel Connectors</span>
            <Layers size={15} className="text-[#226750]" />
          </div>
          <b className="block text-3xl font-bold font-['Bricolage_Grotesque'] text-[#14533d] mt-2">
            5 Active
          </b>
          <small className="text-xs text-[#4c7567] mt-1 block">Shopify, Myntra, Amazon & more</small>
        </div>
      </div>

      {/* BENTO GRID ROW 2: SEARCH & FILTER BAR CARD */}
      <div className="bg-white p-5 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <label className="search-box bg-[#f8faf9] border border-[#e2eae6] rounded-xl px-3 py-2 flex items-center gap-2 flex-1">
              <Search size={16} className="text-[#80908b]" />
              <input
                aria-label="Search listings by SKU or title"
                data-testid="input-search-listings"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search SKU, product title, category, or platform..."
                className="bg-transparent border-0 outline-none text-xs w-full text-[#143d41]"
              />
            </label>
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="text-xs text-[#70817d] hover:text-[#0e3b43] px-2"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="Filter by platform"
              className="bg-[#fcfdfc] border border-[#e1e8e4] rounded-lg px-3 py-2 text-xs text-[#415954] font-medium"
            >
              <option value="All">All Channels</option>
              <option value="shopify">Shopify (Connected)</option>
              <option value="myntra">Myntra (Simulated)</option>
              <option value="amazon">Amazon (Simulated)</option>
              <option value="flipkart">Flipkart (Simulated)</option>
              <option value="woocommerce">WooCommerce (Simulated)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by score status"
              className="bg-[#fcfdfc] border border-[#e1e8e4] rounded-lg px-3 py-2 text-xs text-[#415954] font-medium"
            >
              <option value="All">All Scores</option>
              <option value="Flagged (<70)">Flagged (&lt;70)</option>
              <option value="Healthy (80+)">Healthy (80+)</option>
              <option value="Has Open Issues">Has Open Issues</option>
            </select>
          </div>
        </div>
      </div>

      {/* BENTO GRID ROW 3: FULL SKU TABLE BENTO CARD */}
      <div className="bg-white rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] overflow-hidden">
        <div className="p-5 pb-3 border-b border-[#edf1ef] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
              Active Listing Manifest
            </h2>
            <p className="text-xs text-[#6e7f7a] mt-0.5">
              Ranked by defect severity and estimated margin drag.
            </p>
          </div>
          <span className="text-xs font-bold text-[#1f8a5b]">
            {filtered.length} SKUs displayed
          </span>
        </div>

        <div className="table-wrap border-0 rounded-none">
          <table>
            <thead>
              <tr>
                <th>SKU / PRODUCT TITLE</th>
                <th>CHANNEL</th>
                <th>ACCURACY SCORE</th>
                <th>LISTING RETURNS</th>
                <th>ESTIMATED LOSS</th>
                <th>DOMINANT DEFECT</th>
                <th>OPEN ISSUES</th>
                <th className="right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const score = item.accuracyScore ?? 100;
                return (
                  <tr key={item.id} data-testid={`row-listing-${item.sku}`}>
                    <td>
                      <Link className="order-title font-bold text-[#14474b] hover:underline" href={`/listings/${item.id}`}>
                        {item.sku}
                      </Link>
                      <span className="table-sub text-xs text-[#7e8e89] line-clamp-1 max-w-xs">{item.title}</span>
                    </td>
                    <td>
                      <PlatformBadge platform={item.platform} />
                    </td>
                    <td>
                      <AccuracyBadge score={score} />
                    </td>
                    <td>
                      <b className="text-xs text-[#2b4c49]">
                        {item.listingCausedReturnCount ?? 0}
                      </b>
                      <span className="table-sub text-[11px] text-[#7e8e89]">
                        {item.totalReturnsCount ? `${item.totalReturnsCount} total returns` : '0 returns'}
                      </span>
                    </td>
                    <td className="money font-semibold text-xs" style={{ color: (item.estimatedLoss ?? 0) > 0 ? '#b63d32' : '#277953' }}>
                      {money(item.estimatedLoss ?? 0)}
                      {(item.estimatedSaving ?? 0) > 0 && (
                        <span className="table-sub text-[#268058] font-medium">
                          Save ~{money(item.estimatedSaving ?? 0)}
                        </span>
                      )}
                    </td>
                    <td>
                      <IssueTag issue={item.dominantIssue} />
                    </td>
                    <td>
                      {(item.openIssuesCount ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#faece9] text-[#b63f33]">
                          {item.openIssuesCount} open
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eaf5ef] text-[#1c7851]">
                          <CheckCircle2 size={12} /> Clear
                        </span>
                      )}
                    </td>
                    <td className="right">
                      <Link
                        href={`/listings/${item.id}`}
                        className="button button-soft text-xs inline-flex items-center gap-1 py-1 px-2.5 font-bold"
                        data-testid={`link-listing-detail-${item.sku}`}
                      >
                        Inspect <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="empty-state py-12">
              <Search size={28} className="mx-auto text-[#a0ada8] mb-2" />
              <h3 className="font-bold text-base text-[#1b3e41]">No matching listings</h3>
              <p className="text-xs text-[#72827e]">Try adjusting your search query, clearing filters, or importing catalog SKUs.</p>
              <button
                type="button"
                className="button button-soft text-xs mt-3"
                onClick={() => {
                  setQ('');
                  setPlatformFilter('All');
                  setStatusFilter('All');
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CSV Import Modal */}
      <CsvImportDialog open={isCsvModalOpen} onOpenChange={setIsCsvModalOpen} />
    </div>
  );
}

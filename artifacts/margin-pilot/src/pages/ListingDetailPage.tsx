import { useState, useMemo } from 'react';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  useGetListingDetail,
  useUpdateListingIssue,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const SIMULATED_PLATFORMS = new Set(['myntra', 'amazon', 'flipkart', 'woocommerce']);

interface ListingIssueItem {
  id: string;
  issueType: string;
  severity: string;
  confidence: number | null;
  suggestedAction?: string | null;
  evidenceText?: string | null;
  status: string;
}

interface ListingImageItem {
  id: string;
  type: string;
  resolutionWidth?: number | null;
  resolutionHeight?: number | null;
  imageUrl?: string | null;
}

interface EvidenceReviewItem {
  id: string;
  rating: number;
  reviewText: string;
  hasPhotos?: boolean;
  reviewDate?: string;
}

export default function ListingDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: listing, isLoading, isError } = useGetListingDetail(id);
  const updateIssueMutation = useUpdateListingIssue();
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);

  const isSimulated = listing?.platform ? SIMULATED_PLATFORMS.has(listing.platform.toLowerCase()) : false;

  const handleMarkAsFixed = async (issue: ListingIssueItem) => {
    setResolvingIssueId(issue.id);
    try {
      await updateIssueMutation.mutateAsync({
        id: issue.id,
        data: {
          status: 'resolved',
          resolutionNotes: 'Merchant marked fix applied in storefront catalog.',
        },
      });
      await queryClient.invalidateQueries();
      toast({
        title: 'Issue Resolved',
        description: `Marked '${issue.issueType.replace(/_/g, ' ')}' as fixed. Scores will adjust on next analysis cycle.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Could not update issue status.',
        variant: 'destructive',
      });
    } finally {
      setResolvingIssueId(null);
    }
  };

  // Extract score object
  const scoreObj = (listing?.score || {}) as Record<string, any>;
  const accuracyScore = Number(scoreObj.accuracyScore ?? 100);
  const dominantIssue = (scoreObj.dominantIssue as string) || null;
  const estimatedLoss = Number(scoreObj.estimatedLoss ?? 0);
  const estimatedSaving = Number(scoreObj.estimatedSaving ?? Math.round(estimatedLoss * 0.5));
  const listingCausedReturns = Number(scoreObj.listingCausedReturnCount ?? scoreObj.listingCausedReturns ?? 0);

  const minSaving = Math.round(estimatedSaving * 0.8);
  const maxSaving = Math.round(estimatedSaving * 1.25);

  // Compute aspect sentiment breakdown
  const aspectCounts = useMemo(() => {
    const map: Record<string, { positive: number; negative: number }> = {
      'Size & Fit': { positive: 0, negative: 0 },
      'Color & Swatch': { positive: 0, negative: 0 },
      'Fabric & Material': { positive: 0, negative: 0 },
      'Quality & Durability': { positive: 0, negative: 0 },
      'Packaging & Transit': { positive: 0, negative: 0 },
    };

    if (listing?.topAspects && listing.topAspects.length > 0) {
      for (const item of listing.topAspects) {
        if (map[item.aspect]) {
          map[item.aspect] = { positive: item.positive, negative: item.negative };
        } else {
          map[item.aspect] = { positive: item.positive, negative: item.negative };
        }
      }
      return map;
    }

    // Default distribution based on reviews if present
    const reviews = (listing?.evidenceReviews || []) as unknown as EvidenceReviewItem[];
    reviews.forEach((r) => {
      const text = (r.reviewText || '').toLowerCase();
      if (text.includes('size') || text.includes('fit') || text.includes('tight')) {
        if (r.rating >= 4) map['Size & Fit'].positive++;
        else map['Size & Fit'].negative++;
      }
      if (text.includes('color') || text.includes('colour') || text.includes('shade')) {
        if (r.rating >= 4) map['Color & Swatch'].positive++;
        else map['Color & Swatch'].negative++;
      }
      if (text.includes('cotton') || text.includes('fabric') || text.includes('polyester')) {
        if (r.rating >= 4) map['Fabric & Material'].positive++;
        else map['Fabric & Material'].negative++;
      }
    });
    return map;
  }, [listing]);

  if (isLoading) {
    return (
      <div className="page-enter ops-page">
        <div className="p-12 text-center text-[#869590]">
          <p className="text-sm font-semibold">Loading listing diagnostics...</p>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="page-enter ops-page">
        <div className="empty-state">
          <h2>Listing not found</h2>
          <p>Could not locate the requested SKU in the catalog intelligence registry.</p>
          <Link href="/listings" className="button button-primary">
            Back to Listings
          </Link>
        </div>
      </div>
    );
  }

  const scoreTone = accuracyScore >= 80 ? 'low' : accuracyScore >= 50 ? 'mid' : 'high';
  const scoreLabel = accuracyScore >= 80 ? 'Healthy' : accuracyScore >= 50 ? 'Watch' : 'High risk';
  const issuesList = (listing.issues || []) as unknown as ListingIssueItem[];
  const imagesList = (listing.images || []) as unknown as ListingImageItem[];
  const evidenceReviewsList = (listing.evidenceReviews || []) as unknown as EvidenceReviewItem[];

  return (
    <div className="page-enter ops-page">
      {/* Breadcrumb Navigation */}
      <div className="detail-back mb-3 flex items-center gap-2 text-xs text-[#70827c]">
        <Link href="/listings" className="text-[#207268] hover:underline font-semibold flex items-center gap-1">
          <ArrowLeft size={13} /> Listings
        </Link>
        <span>/</span>
        <span className="font-bold text-[#14474b]">{listing.sku}</span>
      </div>

      {/* Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>{listing.category?.toUpperCase() || 'CATALOG ITEM'}</span>
            <span>·</span>
            <span>SKU: {listing.sku}</span>
          </div>
          <h1 className="text-2xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
            {listing.title}
          </h1>
          <p className="text-xs text-[#6e807a] max-w-xl">
            {listing.description || 'Catalog item diagnosed across multi-channel customer return comments and ratings.'}
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#14474b]">₹{listing.price}</span>
            <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded bg-[#edf2ef] text-[#335954]">
              {listing.platform}
            </span>
            {isSimulated ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#fcf2dd] text-[#9b6807] border border-[#f5e4bd]">
                Simulated Connector
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e9f5ee] text-[#1c7851] border border-[#d6ecde]">
                Connected Store
              </span>
            )}
          </div>
          <span className={`risk-pill ${scoreTone}`}>
            <i />
            {accuracyScore}/100 · {scoreLabel}
          </span>
        </div>
      </div>

      {/* Overview Stat Strip */}
      <div className="ops-stat-strip">
        <div>
          <span>Listing accuracy score</span>
          <b style={{ color: accuracyScore < 50 ? '#b83f33' : accuracyScore < 80 ? '#b37409' : '#1c7553' }}>
            {accuracyScore}/100
          </b>
          <small>Penalized by {dominantIssue ? dominantIssue.replace(/_/g, ' ') : 'none'}</small>
        </div>
        <div>
          <span>Estimated return drag</span>
          <b style={{ color: estimatedLoss > 0 ? '#b83f33' : '#1c7553' }}>{money(estimatedLoss)}</b>
          <small>{listingCausedReturns} returns caused by listing defects</small>
        </div>
        <div>
          <span>Recommended fix savings</span>
          <b style={{ color: '#1a624b' }}>
            {money(minSaving)} – {money(maxSaving)}
          </b>
          <small>30-day recoverable margin</small>
        </div>
      </div>

      {/* Main Diagnostics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Left Column: Issues & Recommended Fixes (Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="panel p-4">
            <div className="panel-head flex items-center justify-between mb-3">
              <div>
                <div className="eyebrow">DIAGNOSED DEFECTS & ACTION ITEMS</div>
                <h2 className="text-base font-bold text-[#14474b]">Identified listing issues</h2>
              </div>
              <span className="text-xs font-semibold text-[#6e807a]">
                {issuesList.filter((i) => i.status === 'open').length} open issues
              </span>
            </div>

            <div className="space-y-3">
              {issuesList.length > 0 ? (
                issuesList.map((issue) => {
                  const isLowConf = issue.confidence !== null && issue.confidence !== undefined && Number(issue.confidence) < 0.85;
                  const isResolved = issue.status === 'resolved';

                  return (
                    <div
                      key={issue.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isResolved
                          ? 'bg-[#f8fbf9] border-[#e1e9e4] opacity-75'
                          : issue.severity === 'critical'
                          ? 'bg-[#fdf9f8] border-[#f4dcd7]'
                          : 'bg-[#fafcfb] border-[#e2eae5]'
                      }`}
                      data-testid={`issue-card-${issue.id}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              issue.severity === 'critical'
                                ? 'bg-[#faece9] text-[#b43e32]'
                                : issue.severity === 'high'
                                ? 'bg-[#fcf2dd] text-[#9b6807]'
                                : 'bg-[#eaf5ef] text-[#1c7851]'
                            }`}
                          >
                            {issue.severity}
                          </span>
                          <b className="text-xs font-bold text-[#1a4a47] capitalize">
                            {issue.issueType.replace(/_/g, ' ')}
                          </b>
                          {isLowConf && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#fff8e6] text-[#b45309] border border-[#fde68a] inline-flex items-center gap-1"
                              title={`Analyzer confidence: ${Math.round(Number(issue.confidence ?? 0) * 100)}% (< 85%)`}
                            >
                              <AlertTriangle size={11} /> Low confidence ({Math.round(Number(issue.confidence ?? 0) * 100)}%)
                            </span>
                          )}
                          {isResolved && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e9f5ee] text-[#1c7851] inline-flex items-center gap-1">
                              <CheckCircle2 size={11} /> Fixed
                            </span>
                          )}
                        </div>

                        {!isResolved ? (
                          <button
                            type="button"
                            disabled={resolvingIssueId === issue.id}
                            onClick={() => handleMarkAsFixed(issue)}
                            className="button button-soft text-xs py-1 px-2.5 font-bold inline-flex items-center gap-1"
                            data-testid={`button-fix-issue-${issue.id}`}
                          >
                            <Check size={13} />
                            {resolvingIssueId === issue.id ? 'Saving...' : 'Mark as fixed'}
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#1c7851] flex items-center gap-1">
                            <Check size={13} /> Resolved
                          </span>
                        )}
                      </div>

                      {issue.evidenceText && (
                        <div className="mb-2 p-2 rounded bg-white border border-[#e5ece8] text-xs text-[#4b635c] italic">
                          "{issue.evidenceText}"
                        </div>
                      )}

                      {issue.suggestedAction && (
                        <div className="flex items-start gap-1.5 text-xs text-[#206757] font-medium bg-[#f0f7f3] p-2 rounded-md">
                          <Sparkles size={14} className="text-[#1f8058] flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-[#1b5b4e]">Recommended fix: </span>
                            {issue.suggestedAction}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-[#869590] border border-dashed border-[#dce5e0] rounded-xl">
                  <CheckCircle2 size={24} className="mx-auto text-[#1c7851] mb-2" />
                  <p className="text-xs font-semibold">No active issues detected on this listing.</p>
                </div>
              )}
            </div>
          </div>

          {/* Aspect Sentiment Breakdown */}
          <div className="panel p-4">
            <div className="panel-head mb-3">
              <div>
                <div className="eyebrow">CUSTOMER PERCEPTION</div>
                <h2 className="text-base font-bold text-[#14474b]">Aspect sentiment distribution</h2>
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(aspectCounts).map(([aspect, counts]) => {
                const total = counts.positive + counts.negative;
                const posPercent = total > 0 ? Math.round((counts.positive / total) * 100) : 50;
                const negPercent = 100 - posPercent;
                return (
                  <div key={aspect} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-[#3a5b56]">
                      <span>{aspect}</span>
                      <span className="text-[11px] text-[#71857f]">
                        <span className="text-[#1c7851] font-bold">{counts.positive} positive</span>
                        {' · '}
                        <span className="text-[#b83f33] font-bold">{counts.negative} negative</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#f0f4f1] rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${posPercent}%` }}
                        className="bg-[#2a8562] transition-all"
                        title={`${posPercent}% positive`}
                      />
                      <div
                        style={{ width: `${negPercent}%` }}
                        className="bg-[#c8493d] transition-all"
                        title={`${negPercent}% negative`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Images Inspection & Evidence Reviews */}
        <div className="space-y-4">
          {/* Images Inspection Gallery */}
          <div className="panel p-4">
            <div className="panel-head mb-2">
              <div>
                <div className="eyebrow">MEDIA AUDIT</div>
                <h2 className="text-base font-bold text-[#14474b]">Listing images & resolution</h2>
              </div>
            </div>
            <div className="space-y-2">
              {imagesList.length > 0 ? (
                imagesList.map((img) => {
                  const width = Number(img.resolutionWidth ?? 1200);
                  const height = Number(img.resolutionHeight ?? 1200);
                  const isLowRes = width < 800 || height < 800;
                  return (
                    <div
                      key={img.id}
                      className="p-2.5 rounded-lg border border-[#e1e9e4] bg-[#fbfcfb] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded bg-[#edf2ef] text-[#2c5b55] flex items-center justify-center">
                          <ImageIcon size={16} />
                        </span>
                        <div>
                          <b className="text-xs text-[#1e4e4a] capitalize block">{img.type} Image</b>
                          <span className="text-[10px] text-[#788a84]">
                            {width} × {height} px
                          </span>
                        </div>
                      </div>
                      {isLowRes ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#faece9] text-[#b43e32] flex items-center gap-1">
                          <AlertTriangle size={11} /> Low Res (&lt;800px)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e9f5ee] text-[#1c7851] flex items-center gap-1">
                          <CheckCircle2 size={11} /> High Res
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[#869590]">No catalog images registered.</p>
              )}
            </div>
          </div>

          {/* Customer Reviews Evidence */}
          <div className="panel p-4">
            <div className="panel-head mb-2">
              <div>
                <div className="eyebrow">CUSTOMER FEEDBACK EVIDENCE</div>
                <h2 className="text-base font-bold text-[#14474b]">Customer reviews</h2>
              </div>
            </div>
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {evidenceReviewsList.length > 0 ? (
                evidenceReviewsList.slice(0, 10).map((rev) => (
                  <div key={rev.id} className="p-2.5 rounded-lg bg-[#fbfcfb] border border-[#e4ede8] text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-[#235852] text-[11px]">
                        ★ {rev.rating}/5
                        {rev.hasPhotos && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-[#edf2ef] text-[#3b625b] rounded">
                            Photo Attached
                          </span>
                        )}
                      </span>
                      {rev.reviewDate && <small className="text-[#96a49e]">{rev.reviewDate.slice(0, 10)}</small>}
                    </div>
                    <p className="text-[#4b635d]">"{rev.reviewText}"</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#869590] text-center py-4">No reviews or customer evidence yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { RefreshCcw, CheckCircle, Plus, Store, ShoppingBag, Globe, Code, ArrowUpRight, Zap, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/state/AppState';
import { evaluate, DEFAULT_ENGINE_CONFIG } from '@/engine';
import { products, pincodes, couriers, customers } from '@/data/seed';

export default function IntegrationsPage() {
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [synced, setSynced] = useState<Record<string, boolean>>({});
  const { addOrder, currentSeller } = useAppState();
  const { toast } = useToast();
  
  const [webhookPayload, setWebhookPayload] = useState(`{\n  "id": 9999123,\n  "total_price": "1499.00",\n  "shipping_address": { "zip": "110001", "city": "New Delhi" },\n  "customer": { "first_name": "Webhook", "phone": "9876543210" }\n}`);
  
  const processWebhook = () => {
    try {
      const data = JSON.parse(webhookPayload);
      const newOrder = {
        id: `WH-${data.id || Math.floor(Math.random() * 10000)}`,
        value: Number(data.total_price || 1500),
        qty: 1,
        payment: 'COD' as any,
        campaign: 'Direct',
        advancePaid: false,
        otpPassed: false,
        addressVerified: false,
        addressComplete: true,
        pincode: data.shipping_address?.zip || '110001',
        status: 'Unfulfilled' as any,
        customerId: 'C001',
        customerName: data.customer?.first_name || 'Webhook User',
        customerPhone: data.customer?.phone || '',
        productId: 'P1',
        courierId: 'C1',
        sellerId: currentSeller.id,
        timeline: [{ label: 'Order created via webhook', at: 'Just now' }]
      };
      
      const pin = pincodes.find(p => p.code === newOrder.pincode) || pincodes[0];
      const product = products[0];
      const courier = couriers[0];
      const customer = customers[0];
      
      const ev = evaluate(newOrder as any, product, pin, courier, customer, DEFAULT_ENGINE_CONFIG);
      (newOrder as any).journey = ev.best.name;
      
      addOrder(newOrder as any);
      toast({
        title: 'Webhook Processed',
        description: `Order ${newOrder.id} ingested. Scored ${ev.score}, routed to ${ev.best.name}.`
      });
    } catch (err) {
      toast({
        title: 'JSON Error',
        description: 'Invalid JSON payload format.',
        variant: 'destructive'
      });
    }
  };
  
  const handleSync = (id: string) => {
    setSyncing(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSyncing(prev => ({ ...prev, [id]: false }));
      setSynced(prev => ({ ...prev, [id]: true }));
      toast({
        title: 'Sync Complete',
        description: `Updated catalogs, orders, and customer signals for ${id}.`,
      });
    }, 1200); 
  };

  const integrations = [
    {
      id: 'shopify',
      name: 'Shopify Storefront',
      desc: 'Sync orders, customers, and product catalogs with automated tagging.',
      isConnected: true,
      icon: Store,
      badge: 'Connected',
      stats: '40 Customers · 80 Orders'
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      desc: 'Connect your WordPress/WooCommerce direct storefront via REST API.',
      isConnected: false,
      icon: ShoppingBag,
      badge: 'Available',
      stats: 'Ready to connect'
    },
    {
      id: 'custom',
      name: 'Custom Webhook API',
      desc: 'Real-time order ingestion from custom checkouts & headless carts.',
      isConnected: true,
      icon: Code,
      badge: 'Active Endpoint',
      stats: 'Live JSON listener'
    },
  ];

  return (
    <div className="page-enter ops-page space-y-5">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>DATA SOURCES</span>
            <span>·</span>
            <span>{currentSeller.name.toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold font-['Bricolage_Grotesque'] text-[#0e3b43] tracking-tight mt-1">
            Integrations
          </h1>
          <p className="text-sm text-[#70817d] mt-1">
            Connect storefronts, marketplace channels, and courier APIs to power real-time order scoring.
          </p>
        </div>
      </div>

      {/* BENTO ROW 1: 3 INTEGRATION CONNECTOR TILES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {integrations.map(int => {
          const Icon = int.icon;
          return (
            <div
              key={int.id}
              className="bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] hover:shadow-[0_6px_18px_rgba(14,59,67,0.08)] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#f0f5f3] text-[#0e3b43] grid place-items-center">
                    <Icon size={20} />
                  </div>
                  {int.isConnected ? (
                    <span className="text-xs font-bold text-[#1c7553] bg-[#eaf5ef] px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle size={12} /> {int.badge}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button button-soft text-xs py-1 px-3 font-bold"
                      onClick={() => handleSync(int.id)}
                    >
                      Connect
                    </button>
                  )}
                </div>

                <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                  {int.name}
                </h2>
                <p className="text-xs text-[#70817d] mt-1 line-clamp-2">
                  {int.desc}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-[#edf1ef]">
                {int.isConnected ? (
                  <div>
                    <button
                      type="button"
                      className="button button-primary w-full text-xs font-bold py-2"
                      onClick={() => handleSync(int.id)}
                      disabled={syncing[int.id]}
                    >
                      {syncing[int.id] ? (
                        <>
                          <RefreshCcw size={13} className="animate-spin" /> Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCcw size={13} /> Sync Catalog & Orders
                        </>
                      )}
                    </button>
                    {synced[int.id] && (
                      <div className="mt-2.5 p-2 bg-[#eaf5ef] rounded-lg text-[11px] text-[#1c7553] font-semibold text-center flex items-center justify-center gap-1">
                        <Check size={12} /> Successfully synced 80 orders
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[#8a9894] font-medium text-center py-1">
                    Connector ready to configure
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* BENTO ROW 2: WEBHOOK PLAYGROUND & TELEMETRY CHECKLIST (8 COLS + 4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Bento 1: Webhook Playground (8 Cols) */}
        <section className="col-span-12 lg:col-span-8 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)]">
          <div className="flex items-center justify-between pb-3 border-b border-[#edf1ef]">
            <div>
              <span className="eyebrow text-[#7b8b87]">SIMULATED INGESTION</span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
                Webhook Playground
              </h2>
            </div>
            <span className="text-xs text-[#1f8a5b] font-bold bg-[#eaf5ef] px-2.5 py-1 rounded-full">
              POST /api/webhooks/orders
            </span>
          </div>

          <p className="text-xs text-[#70817d] mt-3">
            Paste Shopify-style order JSON to instantly score, evaluate Expected Value, and assign profit-protecting journeys.
          </p>

          <div className="mt-3">
            <textarea
              value={webhookPayload}
              onChange={e => setWebhookPayload(e.target.value)}
              className="w-full h-44 bg-[#0e3b43] text-[#a0c2bd] p-4 rounded-xl text-xs font-mono border-0 outline-none resize-vertical focus:ring-2 focus:ring-[#f5a524]"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-[#869692]">
              Payload triggers real-time <code>evaluateOrder()</code> calculation
            </span>
            <button
              type="button"
              className="button button-primary text-xs font-bold py-2 px-4 inline-flex items-center gap-1.5"
              onClick={processWebhook}
            >
              <Plus size={14} /> Score & Ingest Order
            </button>
          </div>
        </section>

        {/* Bento 2: Data Health Checklist Card (4 Cols) */}
        <aside className="col-span-12 lg:col-span-4 bg-white p-6 rounded-[20px] border border-[#e1e8e4] shadow-[0_2px_10px_rgba(14,59,67,0.04)] space-y-4">
          <div className="pb-3 border-b border-[#edf1ef]">
            <span className="eyebrow text-[#7b8b87]">DATA PIPELINE HEALTH</span>
            <h2 className="text-lg font-bold font-['Bricolage_Grotesque'] text-[#0e3b43]">
              Telemetry Signals
            </h2>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#f5f8f6] rounded-xl border border-[#e5ede9]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1e524d]">
                <CheckCircle size={14} className="text-[#1f8a5b]" />
                <span>Storefront Address Quality</span>
              </div>
              <p className="text-[11px] text-[#718580] mt-1">
                Pincode validity, street clarity, and customer repeat order counts.
              </p>
            </div>

            <div className="p-3 bg-[#f5f8f6] rounded-xl border border-[#e5ede9]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1e524d]">
                <CheckCircle size={14} className="text-[#1f8a5b]" />
                <span>Courier Success Telemetry</span>
              </div>
              <p className="text-[11px] text-[#718580] mt-1">
                Real-time reverse and forward rates across Delhivery, BlueDart, Xpressbees.
              </p>
            </div>

            <div className="p-3 bg-[#f5f8f6] rounded-xl border border-[#e5ede9]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1e524d]">
                <CheckCircle size={14} className="text-[#1f8a5b]" />
                <span>COGS & Margin Calibration</span>
              </div>
              <p className="text-[11px] text-[#718580] mt-1">
                Active catalog cost of goods and product damage multipliers.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

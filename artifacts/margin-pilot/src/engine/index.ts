import type { Courier, Order, Pin, Product } from '../data/seed';
export type Journey={name:string;retention:number;rtoMult:number;cost:number;eligible?:boolean;discount?:number};
export const journeys:Journey[]=[
 {name:'Full COD',retention:1,rtoMult:1,cost:0},
 {name:'Partial COD 20% advance',retention:.93,rtoMult:.55,cost:4},
 {name:'Prepaid incentive 5% off',retention:.85,rtoMult:.15,cost:0,discount:.05},
 {name:'OTP',retention:.95,rtoMult:.6,cost:2},
 {name:'WhatsApp address verification',retention:.96,rtoMult:.7,cost:3},
 {name:'Human review',retention:.9,rtoMult:.4,cost:25}
];
export type ScoreThresholds={highRisk:number;watch:number};
export type EnginePolicy={id:string;type:'pincode'|'channel';value:string;action:'prepaid-only'|'human-review'};
export type EngineConfig={journeys:Journey[];scoreThresholds:ScoreThresholds;policies:EnginePolicy[]};
export const DEFAULT_SCORE_THRESHOLDS:ScoreThresholds={highRisk:45,watch:70};
export const DEFAULT_ENGINE_CONFIG:EngineConfig={journeys,scoreThresholds:DEFAULT_SCORE_THRESHOLDS,policies:[]};
export const scoreBand=(score:number,thresholds:ScoreThresholds=DEFAULT_SCORE_THRESHOLDS)=>score<thresholds.highRisk?'high':score<thresholds.watch?'mid':'low';
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const scoreOrder=(o:Order,cust:{orders:number;rtos:number;prepaid:number},pin:Pin,courier:Courier,product:Product)=>{
 const factors=[
 {name:'Payment method',points:o.payment==='Prepaid'?18:o.advancePaid?16:o.payment==='Partial COD'?12:o.otpPassed?13:7,reason:o.payment==='Prepaid'?'Paid before dispatch; no collection risk.':o.advancePaid?'Advance paid; commitment is stronger.':o.otpPassed?'Customer completed the delivery OTP.':'Cash due on delivery leaves more room for refusal.'},
 {name:'Address quality',points:o.addressVerified?20:o.addressComplete?14:5,reason:o.addressVerified?'Address verified by the customer.':o.addressComplete?'Address is usable but not independently verified.':'Missing address detail makes delivery harder.'},
 {name:'Customer history',points:cust.orders===0?4:clamp(12+cust.orders*2-cust.rtos*8,2,20),reason:cust.orders===0?'First order with no delivery history.':`${cust.orders} prior orders and ${cust.rtos} recorded RTO${cust.rtos===1?'':'s'}.`},
 {name:'Pincode RTO',points:clamp(Math.round(20-pin.rtoRate*36),3,15),reason:`${Math.round(pin.rtoRate*100)}% historic RTO in ${pin.city}.`},
 {name:'Campaign source',points:/Instagram|Meta/i.test(o.campaign)?6:/Google/i.test(o.campaign)?9:8,reason:`${o.campaign} orders carry ${/Instagram|Meta/i.test(o.campaign)?'higher':'moderate'} return risk.`},
 {name:'Courier / pincode success',points:clamp(Math.round(courier.success*pin.success*12)+(o.status==='RTO initiated'?-5:o.status==='NDR raised'?-2:o.status==='Out for delivery'?1:0),1,10),reason:o.status==='RTO initiated'?'Return to origin is already in progress.':o.status==='NDR raised'?'A delivery exception has raised return risk.':o.status==='Out for delivery'?'Courier has made a delivery attempt.':`${courier.name} delivers ${Math.round(courier.success*100)}% successfully overall.`},
 {name:'Value vs margin',points:product.price-product.cogs<500?2:4,reason:product.price-product.cogs<500?'Thin unit margin leaves little room for a failed delivery.':'Unit economics can absorb a measured intervention.'}
 ];
 const total=clamp(factors.reduce((sum,f)=>sum+f.points,0),0,100);
 return {score:total,factors,pRto:clamp(.02+(100-total)/100*.55,.02,.7)};
};
export function journeyValues(o:Order,marginSuccess:number,rtoLoss:number,pRto:number,config:EngineConfig=DEFAULT_ENGINE_CONFIG){
 const isPrepaidOnly = config.policies.some(p => p.action === 'prepaid-only' && (
   (p.type === 'pincode' && o.pincode === p.value) || 
   (p.type === 'channel' && o.campaign === p.value)
 ));
 const requiresHumanReview = config.policies.some(p => p.action === 'human-review' && (
   (p.type === 'pincode' && o.pincode === p.value) || 
   (p.type === 'channel' && o.campaign === p.value)
 ));
 const eligible=config.journeys.filter(j=>{
   if(j.name!=='Human review'&&o.value<=2500&&requiresHumanReview) return false;
   if(j.name==='Human review' && !requiresHumanReview && o.value<=2500) return false;
   if(isPrepaidOnly && !['Prepaid incentive 5% off', 'Partial COD 20% advance'].includes(j.name)) return false;
   return true;
 });
 return (eligible.length ? eligible : config.journeys).map(j=>{const successMargin=marginSuccess-(j.discount?o.value*j.discount:0);const ev=j.retention*((1-pRto*j.rtoMult)*successMargin-pRto*j.rtoMult*rtoLoss)-j.cost;return {...j,ev:Math.round(ev),successMargin:Math.round(successMargin)};}).sort((a,b)=>b.ev-a.ev);
}
export function evaluate(o:Order,p:Product,pin:Pin,courier:Courier,customer:{orders:number;rtos:number;prepaid:number},config:EngineConfig=DEFAULT_ENGINE_CONFIG){
 const health=scoreOrder(o,customer,pin,courier,p), marginSuccess=o.value-p.cogs*o.qty-courier.forward-35-(o.payment==='Prepaid'?o.value*.025:28);
 const rtoLoss=courier.forward+courier.reverse+35+(o.payment==='Prepaid'?0:28)+p.damageRate*p.cogs*o.qty;
 const results=journeyValues(o,marginSuccess,rtoLoss,health.pRto,config);
 return {...health,marginSuccess:Math.round(marginSuccess),rtoLoss:Math.round(rtoLoss),journeys:results,best:results[0],explanation:`${results[0].name} leads by ₹${Math.max(0,results[0].ev-(results[1]?.ev??0))} expected margin per order at this risk level.`};
}

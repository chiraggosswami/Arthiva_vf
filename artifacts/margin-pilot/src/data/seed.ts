export type Product = { id: string; name: string; price: number; cogs: number; damageRate: number; sellerId?: string };
export type Customer = { id: string; name: string; phone: string; city: string; orders: number; rtos: number; prepaid: number };
export type Pin = { code: string; city: string; state: string; rtoRate: number; success: number };
export type Courier = { id: string; name: string; success: number; forward: number; reverse: number };
export type EventItem = { label: string; at: string };
export type Order = {
  id: string; productId: string; customerId: string; qty: number; value: number; payment: 'COD'|'Prepaid'|'Partial COD';
  address: string; addressComplete: boolean; addressVerified: boolean; otpPassed: boolean; campaign: string;
  pincode: string; courierId: string; status: string; journey: string; score: number; created: string;
  advancePaid: boolean; timeline: EventItem[];
  customerName?: string; customerPhone?: string;
  sellerId?: string;
  ndrReason?: 'Customer unreachable'|'Address incorrect'|'Refused / low intent'|'Rescheduled request'|'Delayed';
  rescueAction?: string; rescueMessage?: string; recoveryAction?: string;
  inventoryRoute?: 'Return to warehouse'|'Restock'|'Refurbish'|'Write off';
  recoveredValue?: number;
};
export const products: Product[] = [
  // Ojas Botanics (Skincare & Wellness)
  {id:'P01',name:'Cedar & Fig Face Oil',price:1899,cogs:510,damageRate:.025,sellerId:'ojas-botanics'},
  {id:'P02',name:'Daily Ritual Cleanser',price:849,cogs:205,damageRate:.018,sellerId:'ojas-botanics'},
  {id:'P03',name:'Restore Night Serum',price:2299,cogs:620,damageRate:.03,sellerId:'ojas-botanics'},
  {id:'P04',name:'Cloud Cotton Robe',price:3190,cogs:1160,damageRate:.012,sellerId:'ojas-botanics'},
  {id:'P05',name:'Mineral SPF 50',price:1199,cogs:355,damageRate:.02,sellerId:'ojas-botanics'},
  {id:'P06',name:'The Saffron Gift Set',price:2799,cogs:870,damageRate:.035,sellerId:'ojas-botanics'},
  {id:'P07',name:'Barrier Repair Cream',price:1499,cogs:430,damageRate:.02,sellerId:'ojas-botanics'},
  {id:'P08',name:'Travel Skin Kit',price:699,cogs:188,damageRate:.028,sellerId:'ojas-botanics'},
  // Kavya Couture (Festive & Handloom Ethnic)
  {id:'KC01',name:'Zari Chanderi Kurta Set',price:4499,cogs:1450,damageRate:.015,sellerId:'kavya-couture'},
  {id:'KC02',name:'Banarasi Raw Silk Dupatta',price:2899,cogs:820,damageRate:.01,sellerId:'kavya-couture'},
  {id:'KC03',name:'Mulberry Silk Embroidered Lehenga',price:8999,cogs:3100,damageRate:.02,sellerId:'kavya-couture'},
  {id:'KC04',name:'Organza Chikankari Anarkali',price:5250,cogs:1680,damageRate:.018,sellerId:'kavya-couture'},
  // Urban Stride (Performance & Active Streetwear)
  {id:'US01',name:'Aeroflex Carbon Running Shoes',price:3799,cogs:1200,damageRate:.022,sellerId:'urban-stride'},
  {id:'US02',name:'SwiftDry Training Tech Hoodie',price:2199,cogs:690,damageRate:.016,sellerId:'urban-stride'},
  {id:'US03',name:'MotionForm 7/8 Compression Tights',price:1899,cogs:540,damageRate:.012,sellerId:'urban-stride'},
  {id:'US04',name:'Commuter Weatherproof Shell Jacket',price:4299,cogs:1380,damageRate:.015,sellerId:'urban-stride'},
  // Aura Living (Mindful Home & Ceramic Decor)
  {id:'AL01',name:'Hand-thrown Terracotta Table Urn',price:2499,cogs:680,damageRate:.042,sellerId:'aura-living'},
  {id:'AL02',name:'Organic Belgian Linen Waffle Throw',price:3199,cogs:980,damageRate:.015,sellerId:'aura-living'},
  {id:'AL03',name:'Botanical Wild Soy Candle Duo',price:1299,cogs:340,damageRate:.025,sellerId:'aura-living'},
  {id:'AL04',name:'Solid Brass Temple Incense Vessel',price:1850,cogs:490,damageRate:.018,sellerId:'aura-living'}
];
const firstNames=['Aarav','Ananya','Kabir','Meera','Ishaan','Sana','Rohan','Diya','Arjun','Tara','Vivaan','Nisha','Dev','Kavya','Neil','Ira','Reyansh','Aditi','Mihir','Zoya'];
const cities=['Mumbai','Bengaluru','Delhi','Gorakhpur','Jaipur','Pune','Lucknow','Hyderabad','Kochi','Indore'];
export const customers: Customer[] = Array.from({length:40},(_,i)=>({id:`C${String(i+1).padStart(3,'0')}`,name:`${firstNames[i%20]} ${['Shah','Kapoor','Rao','Singh','Mehta','Nair','Das','Bose'][i%8]}`,phone:`+91 98${String(10000000+i*137).slice(0,8)}`,city:cities[i%10],orders:i%7,rtos:i%9===0?1:0,prepaid:i%4})).map(c=>c.id==='C004'?{...c,city:'Gorakhpur',orders:0,rtos:0,prepaid:0}:c);
const pinData:[string,string,string,number,number][]=[
['273001','Gorakhpur','Uttar Pradesh',.42,.59],['110001','New Delhi','Delhi',.13,.89],['400001','Mumbai','Maharashtra',.12,.91],['560001','Bengaluru','Karnataka',.10,.93],['302001','Jaipur','Rajasthan',.21,.81],['226001','Lucknow','Uttar Pradesh',.28,.74],['411001','Pune','Maharashtra',.14,.88],['500001','Hyderabad','Telangana',.16,.86],['682001','Kochi','Kerala',.12,.90],['452001','Indore','Madhya Pradesh',.19,.82],['700001','Kolkata','West Bengal',.20,.80],['600001','Chennai','Tamil Nadu',.13,.90],['751001','Bhubaneswar','Odisha',.24,.77],['800001','Patna','Bihar',.34,.67],['462001','Bhopal','Madhya Pradesh',.22,.78],['201301','Noida','Uttar Pradesh',.17,.85],['122001','Gurugram','Haryana',.15,.87],['395003','Surat','Gujarat',.18,.83],['380001','Ahmedabad','Gujarat',.16,.85],['641001','Coimbatore','Tamil Nadu',.14,.88],['302017','Jaipur','Rajasthan',.24,.77],['208001','Kanpur','Uttar Pradesh',.29,.73],['226010','Lucknow','Uttar Pradesh',.25,.77],['273002','Gorakhpur','Uttar Pradesh',.39,.62],['221001','Varanasi','Uttar Pradesh',.31,.70]
];
export const pincodes:Pincode[] = pinData.map(([code,city,state,rtoRate,success])=>({code,city,state,rtoRate,success}));
export type Pincode=Pin;
export const couriers:Courier[]=[
{id:'shiprocket',name:'Shiprocket',success:.83,forward:78,reverse:92},{id:'delhivery',name:'Delhivery',success:.88,forward:82,reverse:96},{id:'bluedart',name:'Blue Dart',success:.93,forward:108,reverse:126},{id:'ecom',name:'Ecom Express',success:.79,forward:72,reverse:90},{id:'xpressbees',name:'Xpressbees',success:.85,forward:75,reverse:94}];
const campaigns=['Instagram','Meta prospecting','Google Search','Direct','Email'];
const statusList=['In transit','Confirmed','Out for delivery','Delivered','NDR raised','RTO initiated','Address check'];
export const seedOrders:Order[]=Array.from({length:80},(_,i)=>{
 const id=`MP-${String(963+i).padStart(4,'0')}`, product=products[i%products.length], c=customers[(i*7)%40], pin=pincodes[(i*3)%25], payment=(i%5===0?'Prepaid':i%7===0?'Partial COD':'COD') as Order['payment'];
 const special=i===79;
 const sellerId = special ? 'ojas-botanics' : (product.sellerId || 'ojas-botanics');
 return {id:special?'MP-1042':id,productId:special?'P01':product.id,customerId:special?'C004':c.id,qty:1+(i%3===0?1:0),value:special?1899:product.price*(1+(i%3===0?1:0)),payment:special?'COD':payment,address:special?'House 14, lane 3, near old post office':`${12+i} ${['Lake View Road','Park Street','Market Lane','Green Avenue'][i%4]}`,addressComplete:special?false:i%6!==0,addressVerified:false,otpPassed:false,campaign:special?'Instagram':campaigns[i%5],pincode:special?'273001':pin.code,courierId:couriers[i%5].id,status:special?'Address check':statusList[i%7],journey:special?'WhatsApp address verification':['Full COD','Partial COD 20% advance','Prepaid incentive 5% off','OTP','Human review'][i%5],score:special?38:34+(i*13)%62,created:new Date(Date.now()-((i*7)%30)*86400000).toISOString().slice(0,10),advancePaid:false,sellerId,timeline:special?[{label:'Order placed · Instagram',at:'Today, 09:42'},{label:'Risk check flagged incomplete address',at:'Today, 09:42'},{label:'WhatsApp verification selected',at:'Today, 09:43'}]:[{label:'Order placed · '+campaigns[i%5],at:`${i%28+1} Jun, 10:${String(i%60).padStart(2,'0')}`} ]};
});

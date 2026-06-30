const fs = require('fs');
const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const productsEndpoint = 'const SUPABASE_PRODUCTS_ENDPOINT = SUPABASE_URL + "/rest/v1/beauty_products?active=eq.true&select=cat,sub,tier,brand,name,price,note,img&order=sort_order.asc,id.asc";';
if (!html.includes('const SUPABASE_BOUGHT_ENDPOINT')) {
  if (!html.includes(productsEndpoint)) throw new Error('Could not find Supabase products endpoint');
  html = html.replace(
    productsEndpoint,
    productsEndpoint + '\nconst SUPABASE_BOUGHT_ENDPOINT = SUPABASE_URL + "/rest/v1/beauty_bought_state?id=eq.default";'
  );
}

const oldSave = `function saveBought(){
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify([...bought]));
  }catch(e){ /* 被禁用时静默降级，不报错 */ }
}`;

const newSave = `let boughtSaveTimer;
function saveBought(){
  const items = [...bought];
  try{
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  }catch(e){ /* 被禁用时静默降级，不报错 */ }
  clearTimeout(boughtSaveTimer);
  boughtSaveTimer = setTimeout(()=>saveBoughtToSupabase(items), 250);
}

async function loadBoughtFromSupabase(){
  try{
    const res = await fetch(SUPABASE_BOUGHT_ENDPOINT + "&select=items&limit=1", {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
      },
    });
    if(!res.ok) throw new Error("Supabase bought state request failed: " + res.status);
    const rows = await res.json();
    const items = rows && rows[0] && Array.isArray(rows[0].items) ? rows[0].items : [];
    bought = new Set(items);
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(items)); }catch(e){}
    return true;
  }catch(e){
    console.warn("Using local bought state fallback", e);
    return false;
  }
}

async function saveBoughtToSupabase(items){
  try{
    const res = await fetch(SUPABASE_BOUGHT_ENDPOINT, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({items, updated_at: new Date().toISOString()}),
    });
    if(!res.ok) throw new Error("Supabase bought state save failed: " + res.status);
  }catch(e){
    console.warn("Bought state saved locally only", e);
  }
}`;

if (html.includes(oldSave)) {
  html = html.replace(oldSave, newSave);
} else if (!html.includes('async function loadBoughtFromSupabase')) {
  throw new Error('Could not find saveBought block');
}

const oldStart = `async function startBeautyPage(){
  if (typeof applyBeautyRefresh === "function") { try { applyBeautyRefresh(); } catch(e) { console.error(e); } }
  await loadProductsFromSupabase();
  buildChips(); stats(); render();
}`;
const newStart = `async function startBeautyPage(){
  if (typeof applyBeautyRefresh === "function") { try { applyBeautyRefresh(); } catch(e) { console.error(e); } }
  await loadProductsFromSupabase();
  await loadBoughtFromSupabase();
  buildChips(); stats(); render();
}`;

if (html.includes(oldStart)) {
  html = html.replace(oldStart, newStart);
} else if (!html.includes('await loadBoughtFromSupabase();')) {
  throw new Error('Could not find startBeautyPage block');
}

fs.writeFileSync(path, html);

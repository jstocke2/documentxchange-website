const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Tl0oa2EidFRQ2zBK9Y8uf5LIkMqKDBuM9XjvL9mCO0iewYiXID8GhRm4ZyiWYuaqfGM9Y3CnFt2Gsxe3ZXc5QSI00mwJBYdDJ';
const api = async (path, options = {}) => { const response = await fetch(path,{credentials:'include',...options,headers:{'content-type':'application/json',...(options.headers||{})}}); const data = await response.json().catch(()=>null); if(!response.ok) throw new Error(data?.message||data?.error||`Request failed (${response.status})`); return data; };
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let documentRecord; let purchaseQuote; let stripeElements; let purchaseId; let currentUserId; let checkoutAttemptStorageKey;
const CHECKOUT_UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function stripeCheckoutKey(userId,documentId){return `documentxchange:stripe-checkout:${userId}:${documentId}`;}
function getOrCreateStripeCheckoutAttempt(userId,documentId){
  const key=stripeCheckoutKey(userId,documentId); checkoutAttemptStorageKey=key;
  const existing=localStorage.getItem(key); if(existing&&CHECKOUT_UUID_PATTERN.test(existing))return existing;
  const attemptId=globalThis.crypto?.randomUUID?.();
  if(!attemptId||!CHECKOUT_UUID_PATTERN.test(attemptId))throw new Error('Secure checkout storage is unavailable. No payment was started.');
  localStorage.setItem(key,attemptId); return attemptId;
}
const money=(value)=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:0;};
function renderFeeSummary(quote){
  const container=document.getElementById('fee-summary');
  const waived=quote?.platform_fee_waived===true;
  const rows=[
    ...(waived&&money(quote?.standard_total_amount)>money(quote?.total_amount)?[['Standard price',`$${money(quote?.standard_total_amount).toFixed(2)}`]]:[]),
    [waived?'Promotional purchase price':'Purchase price',`$${money(quote?.total_amount).toFixed(2)}`],
    ['Contributor target payout',`$${money(quote?.seller_royalty).toFixed(2)}`],
    ['Stripe processing',`$${money(quote?.processor_fee).toFixed(2)}`],
    ['DocumentXchange platform fee',waived?'$0':`$${money(quote?.platform_revenue).toFixed(2)}`],
  ];
  container.innerHTML=`${waived?'<strong class="fee-waiver-badge">Requester promotion · $0 DX fee</strong>':''}${rows.map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('')}<p>${waived?'DocumentXchange keeps $0; external Apple/Google/Stripe/tax/refund/payout costs may apply. This requester-only price applies to the approved document fulfilling your opted-in request; the contributor\'s target payout is preserved.':'Final amounts come from the verified transaction and may be adjusted for external processing, tax, refund, chargeback, and payout costs.'}</p>`;
}
function renderProtectedPreviews(documentId,pages){
  const container=document.getElementById('document-previews');
  container.innerHTML=pages.map((page,index)=>{
    const pageNumber=Number(page.page_number)||1;
    const previewUrl=`/api/documents/${encodeURIComponent(documentId)}/pages/${pageNumber}/preview?v=4`;
    const loading=index<4?'eager':'lazy';
    return `<figure class="protected-preview is-loading"><img src="${escapeHtml(previewUrl)}" alt="Protected, blurred preview of page ${pageNumber}" loading="${loading}" decoding="async"><span class="preview-page-number">Page ${pageNumber}</span><span class="preview-watermark" aria-hidden="true">DOCUMENTXCHANGE<br>PROTECTED PREVIEW</span></figure>`;
  }).join('');
  container.querySelectorAll('img').forEach((image)=>{
    image.addEventListener('load',()=>image.closest('.protected-preview')?.classList.remove('is-loading'));
    image.addEventListener('error',()=>{
      const preview=image.closest('.protected-preview');
      preview?.classList.remove('is-loading');
      preview?.classList.add('preview-unavailable');
      image.remove();
    });
  });
}
const OCR_FIELDS=[
  ['document_type','Document Type'],['document_number','Document Number'],['full_name','Full Name'],
  ['date_of_birth','Date of Birth'],['date_of_issue','Date of Issue'],['date_of_expiry','Date of Expiry'],
  ['issuing_authority','Issuing Authority'],['issuing_state','State'],['issuing_county','County'],
  ['address','Address'],['spouse_name','Spouse Name'],['marriage_date','Marriage Date'],
  ['property_address','Property Address'],['parcel_number','Parcel Number'],['grantor','Grantor'],
  ['grantee','Grantee'],['case_number','Case Number'],['court_name','Court Name'],['additional_names','Additional Names'],
];
function renderOcrMetadata(metadata={},status='unavailable'){
  const container=document.getElementById('ocr-metadata');
  const rows=OCR_FIELDS.flatMap(([key,label])=>{
    const raw=metadata?.[key];
    const value=Array.isArray(raw)?raw.filter(Boolean).join(', '):String(raw??'').trim();
    return value?[[label,value]]:[];
  });
  const body=rows.length
    ? rows.map(([label,value])=>`<div class="ocr-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')
    : `<p class="ocr-empty${status==='processing'?' is-processing':''}">${status==='processing'?'Document details are being extracted. Check back shortly.':'No reliable metadata could be extracted from this scan.'}</p>`;
  container.innerHTML=`<div class="ocr-heading"><div><h2>What this document contains</h2><p>OCR-extracted details help confirm this is the record you need before purchasing.</p></div><span class="ocr-badge">AI scanned</span></div><dl>${body}</dl>${rows.length&&status==='processing'?'<p class="ocr-processing">Additional OCR details are still being extracted.</p>':''}<p class="ocr-note">Automatically extracted with OCR · Verify against the purchased document</p>`;
}
async function finishPurchase(id){ document.getElementById('checkout-message').textContent='Verifying payment and unlocking your document…'; await api(`/api/purchases/${encodeURIComponent(id)}/confirm`,{method:'POST',body:'{}'}); if(checkoutAttemptStorageKey)localStorage.removeItem(checkoutAttemptStorageKey); location.replace('/portal#library'); }
async function init(){
  const session=await api('/api/auth/get-session').catch(()=>null); if(!session?.user){location.replace(`/account?returnTo=${encodeURIComponent(location.pathname+location.search)}`);return;} currentUserId=session.user.id;
  const params=new URLSearchParams(location.search); const returnedPurchase=params.get('purchase_id'); const returnedDocument=params.get('id'); if(returnedPurchase){if(returnedDocument)checkoutAttemptStorageKey=stripeCheckoutKey(currentUserId,returnedDocument);await finishPurchase(returnedPurchase);return;}
  const id=params.get('id'); if(!id) throw new Error('No document was selected.');
  [documentRecord,purchaseQuote]=await Promise.all([api(`/api/documents/${encodeURIComponent(id)}`),api(`/api/purchases/quote?document_id=${encodeURIComponent(id)}&payment_source=stripe`)]); if(!purchaseQuote?.available||money(purchaseQuote.total_amount)<=0)throw new Error('Verified checkout pricing is unavailable. No payment has been started.'); document.getElementById('document-title').textContent=documentRecord.title; document.getElementById('document-location').textContent=[documentRecord.county,documentRecord.state].filter(Boolean).join(', '); document.getElementById('document-chips').innerHTML=`<span class="chip">${escapeHtml(documentRecord.category||'Public record')}</span><span class="chip">${documentRecord.page_count} pages</span>${documentRecord.seller_is_verified?'<span class="chip status">✓ Verified seller</span>':''}${purchaseQuote.platform_fee_waived?'<span class="chip status">Requester promotion</span>':''}`; renderOcrMetadata(documentRecord.ocr_metadata,documentRecord.metadata_status); renderProtectedPreviews(documentRecord.id,documentRecord.pages||[]); document.getElementById('page-summary').textContent=`${documentRecord.page_count} page${documentRecord.page_count===1?'':'s'}`; document.getElementById('price-summary').textContent=`$${money(purchaseQuote.total_amount).toFixed(2)}`; renderFeeSummary(purchaseQuote); document.getElementById('checkout-message').classList.add('hidden'); document.getElementById('checkout-content').classList.remove('hidden');
}
document.getElementById('prepare-payment').addEventListener('click',async(event)=>{
  const prepareButton=event.currentTarget;
  prepareButton.disabled=true;
  prepareButton.textContent='Preparing secure payment…';
  try{
    const pageNumbers=Array.from({length:documentRecord.page_count},(_,i)=>i+1);
    const checkoutAttemptId=getOrCreateStripeCheckoutAttempt(currentUserId,documentRecord.id);
    const purchase=await api('/api/purchases',{method:'POST',body:JSON.stringify({document_id:documentRecord.id,page_numbers:pageNumbers,checkout_attempt_id:checkoutAttemptId})});
    purchaseId=purchase.purchase_id;
    // A browser retry can resume the same durable checkout after the webhook
    // already completed it. There is no client secret in that response (and
    // no payment left to collect), so route through the idempotent server
    // confirmation instead of trying to construct Stripe Elements with null.
    if(purchase.status==='succeeded'||purchase.status==='completed'){
      await finishPurchase(purchaseId);
      return;
    }
    if(!purchase.client_secret)throw new Error('Secure payment details are unavailable. No additional payment was started.');
    const stripe=Stripe(STRIPE_PUBLISHABLE_KEY);
    stripeElements=stripe.elements({clientSecret:purchase.client_secret,appearance:{theme:'stripe',variables:{colorPrimary:'#0c2340',borderRadius:'10px'}}});
    stripeElements.create('payment',{layout:{type:'tabs',defaultCollapsed:false}}).mount('#payment-element');
    prepareButton.classList.add('hidden');
    document.querySelector('.checkout-card').classList.add('payment-active');
    const paymentForm=document.getElementById('payment-form');
    paymentForm.classList.remove('hidden');
    paymentForm.scrollIntoView({behavior:'smooth',block:'start'});
    paymentForm.onsubmit=async(e)=>{
      e.preventDefault();
      const button=document.getElementById('pay-button');
      button.disabled=true;
      button.textContent='Processing payment…';
      document.getElementById('payment-error').textContent='';
      try{
        const result=await stripe.confirmPayment({elements:stripeElements,confirmParams:{return_url:`${location.origin}/checkout?id=${encodeURIComponent(documentRecord.id)}&purchase_id=${encodeURIComponent(purchaseId)}`},redirect:'if_required'});
        if(result.error)throw new Error(result.error.message||'Payment could not be confirmed. Please try again.');
        await finishPurchase(purchaseId);
      }catch(error){
        document.getElementById('payment-error').textContent=error.message||'Payment could not be confirmed. Please try again.';
        button.disabled=false;
        button.textContent='Pay securely';
      }
    };
  }catch(error){
    document.getElementById('payment-error').textContent=error.message;
    prepareButton.disabled=false;
    prepareButton.textContent='Continue to secure payment';
  }
});
init().catch(error=>{document.getElementById('checkout-message').textContent=error.message;});

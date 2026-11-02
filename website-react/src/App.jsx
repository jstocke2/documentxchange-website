import React from 'react';

const APP_STORE_URL = 'https://apps.apple.com/us/app/documentxchange/id6798885846';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.jstocke2.documentxchange';

const steps = [
  {
    number: '01',
    icon: '＋',
    title: 'Request',
    description: 'In the U.S. mobile app, select the document type and location, then add any identifying details you know. Posting is free, requests remain open for 14 days, and DocumentXchange estimates pages and pricing automatically.',
    featured: true,
  },
  {
    number: '02',
    icon: '⌕',
    title: 'Fulfill and earn',
    description: 'Any eligible U.S.-based community member can use the mobile app to locate and upload the requested public record. After review and approval, the contributor can earn money when the requester purchases it.',
  },
  {
    number: '03',
    icon: '✓',
    title: 'Review and decide',
    description: 'The requester is notified when a matching record is submitted and can inspect a protected preview before deciding whether to purchase. There is no charge simply for posting a request.',
  },
];

const proof = [
  ['Free', 'to post a request in the mobile app'],
  ['14 days', 'for the community to respond'],
  ['Eligible U.S. contributors', 'can fulfill and earn'],
  ['Upfront pricing', 'before you decide to purchase'],
];

const recordTypes = [
  ['Property records', 'Deeds, mortgages, liens, easements, surveys, plat maps, building permits, parcel records, and property transfers.'],
  ['Court and legal records', 'Civil and criminal filings, judgments, case files, probate filings, affidavits, and name-change orders.'],
  ['Vital and family records', 'Birth, death, and marriage certificates, marriage licenses, divorce decrees, and guardianship filings.'],
  ['Business and public filings', 'UCC filings, financing statements, incorporation records, DBA filings, and other eligible government records.'],
];

const questions = [
  ['Is it free to request a document?', 'Yes. Posting a request is free in the U.S. mobile app. Eligible requesters can also opt in to one offer per campaign that reduces the DocumentXchange platform fee to $0 when they buy the approved document fulfilling that request. External payment, tax, refund, chargeback, and payout costs may still apply.'],
  ['Who can fulfill a document request?', 'Any eligible U.S.-based community member who can legally obtain and distribute the requested public record may contribute it through the mobile app. Requests, uploads, and fulfillment are unavailable on the website.'],
  ['How does a contributor earn money?', 'In the U.S. mobile app, a contributor uploads the exact requested record as one complete document. After the document passes automated and, when needed, administrator review, the contributor can earn the displayed royalty when the requester purchases it and payment is verified.'],
  ['How are document previews protected?', 'Every preview page uses graduated blur and a prominent watermark so the requester can evaluate the record without receiving a readable substitute for the purchased document.'],
];

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="DocumentXchange home"><span className="brand-mark">DX</span><span>DocumentXchange</span></a>
      <nav aria-label="Primary navigation"><a href="#how-it-works">How it works</a><a href="/public-record-requests">Request guide</a><a href="#trust">Trust &amp; safety</a><a href="/founder">Founder</a><a href="/support">Support</a></nav>
      <a className="button button-small button-outline testflight-header-button" href="/account">My workspace</a>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">A community-powered public-record marketplace</p>
        <h1>Request the document. <span>Let the community find it.</span></h1>
        <p className="hero-lead">Use the U.S. mobile app to post a free request for a public record you cannot find. Eligible U.S.-based contributors can fulfill it—and earn money when the approved document is purchased.</p>
        <a className="hero-offer-card" href="#requester-offer" aria-label="Learn about the new requester platform-fee offer">
          <span className="hero-offer-tag">New requester offer</span>
          <strong>$0 DocumentXchange platform fee on one eligible purchase</strong>
          <span aria-hidden="true">↓</span>
        </a>
        <div className="store-launches" aria-label="Download DocumentXchange">
          <a className="app-store-launch" href={APP_STORE_URL} target="_blank" rel="noreferrer" aria-label="Download DocumentXchange on the App Store">
            <span className="app-store-launch-icon" aria-hidden="true">●</span>
            <span><small>Download on the</small><strong>App Store</strong></span>
            <span className="app-store-launch-arrow" aria-hidden="true">→</span>
          </a>
          <a className="app-store-launch" href={GOOGLE_PLAY_URL} target="_blank" rel="noreferrer" aria-label="Get DocumentXchange on Google Play">
            <span className="app-store-launch-icon" aria-hidden="true">▶</span>
            <span><small>Get it on</small><strong>Google Play</strong></span>
            <span className="app-store-launch-arrow" aria-hidden="true">→</span>
          </a>
        </div>
        <div className="hero-actions hero-secondary-actions">
          <a className="text-link" href="/account">Browse documents on the web <span aria-hidden="true">→</span></a>
          <a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
        </div>
        <p className="hero-beta-note">Browse and purchase on the web. Create requests and contribute documents in the U.S. mobile app.</p>
        <div className="trust-line"><span>Free requests</span><span>Protected previews</span><span>Contributor earnings</span></div>
      </div>
      <div className="hero-visual" aria-label="DocumentXchange mobile workflow showing a request, fulfillment notification, protected preview, and contributor earnings">
        <div className="workflow-phone">
          <div className="phone-status"><span>9:41</span><strong>DocumentXchange</strong><span aria-hidden="true">●●●</span></div>
          <div className="workflow-heading"><span className="workflow-icon" aria-hidden="true">⌕</span><div><small>OPEN REQUEST</small><strong>Warranty Deed Needed</strong><span>Franklin County, Ohio</span></div></div>
          <div className="workflow-progress" aria-label="Request fulfilled"><span className="complete">✓</span><i></i><span className="complete">✓</span><i></i><span className="active">3</span></div>
          <div className="workflow-labels"><span>Requested</span><span>Fulfilled</span><span>Review</span></div>
          <article className="protected-preview-card">
            <div className="preview-page"><img src="/franklin-county-protected-preview-v1.webp" alt="Blurred and watermarked preview of a Franklin County public meeting agenda" /></div>
            <div className="preview-copy"><small>ALL PAGES INCLUDED</small><strong>Matching record found</strong><span>Reviewed metadata confirms the county and document type.</span><b>Review protected preview →</b></div>
          </article>
          <div className="phone-nav" aria-hidden="true"><span>⌂<small>Explore</small></span><span>⌕<small>Search</small></span><span className="nav-active">＋<small>Request</small></span><span>▤<small>Library</small></span></div>
        </div>
        <div className="fulfillment-alert"><span className="alert-bell" aria-hidden="true">●</span><div><small>REQUEST FULFILLED</small><strong>Your document is ready to review</strong></div></div>
        <div className="earn-badge"><strong>Contributor earns</strong><span>after an approved document is purchased</span></div>
      </div>
    </section>
  );
}

function RequesterOffer() {
  return (
    <aside className="requester-offer-strip" id="requester-offer" aria-labelledby="requester-offer-title">
      <div className="requester-offer-badge" aria-hidden="true">$0 DX fee</div>
      <div className="requester-offer-copy">
        <p className="eyebrow">New requester offer</p>
        <h2 id="requester-offer-title">Pay a $0 DocumentXchange platform fee on one eligible fulfillment purchase.</h2>
        <p>Opt in when posting an eligible request in the mobile app. Each requester may claim one offer per campaign. The offer applies only when you buy the approved document that fulfills that request; external Apple, Google, Stripe, tax, refund, chargeback, and payout costs may still apply.</p>
      </div>
      <a className="button button-small" href="#get-the-app">Get the mobile app</a>
    </aside>
  );
}

function HowItWorks() {
  return (
    <section className="section" id="how-it-works">
      <div className="section-heading"><p className="eyebrow">One request. A community of helpers.</p><h2>Request it. Fulfill it. Get paid.</h2><p>DocumentXchange connects people who need public records with people who can locate and contribute them.</p></div>
      <div className="steps-grid">
        {steps.map((step) => <article className={`step-card${step.featured ? ' featured' : ''}`} key={step.title}><span className="step-number">{step.number}</span><div className="step-icon">{step.icon}</div><h3>{step.title}</h3><p>{step.description}</p></article>)}
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="section split" id="trust">
      <div className="quality-panel"><div className="quality-doc"><img src="/franklin-county-protected-preview-v1.webp" alt="Protected preview of a Franklin County courthouse document" /></div><div className="quality-check"><strong>Document review</strong><span>Page order · duplicates · completeness · metadata</span></div></div>
      <div className="split-copy"><p className="eyebrow">Designed for trustworthy fulfillment</p><h2>Contributors provide the record. Requesters decide whether to buy.</h2><p>Every submitted document must be an eligible public record and one complete document. Protected previews show every page with graduated blur and a watermark, while automated checks help flag non-documents, duplicates, missing sections, mixed documents, and page-order problems.</p><ul className="check-list"><li>Requesters are notified when their request is fulfilled</li><li>Contributors can earn the displayed royalty after a verified purchase</li><li>Searchable metadata helps confirm the correct record</li><li>Flagged or uncertain uploads receive admin review</li></ul></div>
    </section>
  );
}

function RecordTypes() {
  return (
    <section className="section" aria-labelledby="record-types-title">
      <div className="section-heading"><p className="eyebrow">Public records people request</p><h2 id="record-types-title">Find—or ask the community to find—the record you need.</h2><p>Search OCR-indexed listings on the web. If the record is not available, use the U.S. mobile app to post a free county-specific request with the details that can help a contributor locate the right document. <a href="/public-record-requests">Read the public-record request guide</a>.</p></div>
      <div className="steps-grid record-type-grid">{recordTypes.map(([title, description]) => <article className="step-card" key={title}><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>
  );
}

function FrequentlyAskedQuestions() {
  return (
    <section className="section" aria-labelledby="faq-title">
      <div className="section-heading"><p className="eyebrow">How DocumentXchange works</p><h2 id="faq-title">Document requests and paid fulfillment, explained.</h2></div>
      <div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </section>
  );
}

function Footer() {
  return (
    <footer><div className="footer-brand"><span className="brand-mark">DX</span><div><strong>DocumentXchange</strong><p>Request records. Fulfill requests. Earn.</p></div></div><div className="footer-links"><a href="/founder">Founder</a><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/terms">User Agreement</a><a href="/dmca">DMCA</a><a href="https://www.facebook.com/profile.php?id=61593075361636" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.instagram.com/documentxchange/" target="_blank" rel="noreferrer">Instagram</a></div><p className="copyright">© {new Date().getFullYear()} DocumentXchange LLC. All rights reserved.</p></footer>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <RequesterOffer />
        <section className="proof-strip">{proof.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</section>
        <HowItWorks />
        <RecordTypes />
        <Trust />
        <section className="section request-banner" id="fulfill"><div><p className="eyebrow">Know where to find a requested record?</p><h2>Fulfill the request and earn.</h2><p>Eligible U.S.-based contributors can browse open requests and upload the exact public record in the mobile app. If the document is approved and purchased, the contributor can earn the displayed royalty.</p></div><a className="button button-light" href="#get-the-app">Get the mobile app</a></section>
        <section className="section cta" id="get-the-app"><p className="eyebrow">Choose how you use DocumentXchange</p><h2>Browse and buy on the web. Request and contribute in the app.</h2><p>The website supports browsing, protected previews, purchases, saved searches, and your library. Download the official iPhone or Android app to create requests, upload documents, and fulfill requests from your phone.</p><div className="cta-actions"><a className="button" href={APP_STORE_URL} target="_blank" rel="noreferrer">Download for iPhone</a><a className="button button-secondary" href={GOOGLE_PLAY_URL} target="_blank" rel="noreferrer">Get it on Google Play</a><a className="button button-secondary" href="/account">Open your web workspace</a></div><p className="beta-note">Available now on the U.S. App Store and Google Play.</p></section>
        <FrequentlyAskedQuestions />
      </main>
      <Footer />
    </>
  );
}

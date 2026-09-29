import './magicui.css';
import './styles.css';
import './magicui-overrides.css';
import { setHTML, enhanceButtons } from './ui.tsx';
import { isSupabaseConfigured } from './lib/supabase.ts';
import {
  listCandidates,
  getCandidateDetail,
  saveCandidateProfile,
  getMyProfile,
  publishProfile,
  pauseProfile,
  unpublishProfile,
  saveEmployment,
  saveEmploymentPrivateDetails,
  saveLayoffRecord,
  signInWithEmail,
} from './lib/candidates.ts';
import {
  getUserAccount,
  selectRole,
  updatePrivateContacts,
  recordConsent,
  getCurrentUser,
} from './lib/auth.ts';
import {
  saveRecruiterProfile,
  saveToShortlist,
  removeFromShortlist,
  getShortlist,
  updateShortlistNote,
} from './lib/recruiters.ts';
import { uploadDocument } from './lib/documents.ts';
import {
  reportUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
  requestAccountDeletion,
  cancelAccountDeletion,
  getAccountDeletionStatus,
  getUserConsents,
  revokeConsent,
  exportUserData,
} from './lib/safety.ts';
import {
  reportReview,
  getPublishedReviews,
  submitReview,
} from './lib/reviews.ts';
import { getLiveStats } from './lib/stats.ts';

enhanceButtons(document);

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  message: '<path d="M4 4h16v12H9l-5 4z"/><path d="M8 8h8M8 12h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  pin: '<path d="M18 10c0 5-6 10-6 10S6 15 6 10a6 6 0 1 1 12 0"/><circle cx="12" cy="10" r="2"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.5.5 1.21.67 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51c.61.34 1.32.17 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.5.5-.67 1.21-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.user}</svg>`;
document.querySelectorAll('[data-icon]').forEach((e) => setHTML(e, icon(e.dataset.icon)));

// ---------------------------------------------------------------------------
// Sample candidate data (rich defaults for preview & offline mode)
// ---------------------------------------------------------------------------
const samplePeople = [
  {
    id: 'c-1',
    name: 'Ananya Sharma',
    role: 'Senior Product Designer',
    company: 'Stripe',
    location: 'Bengaluru',
    years: 6,
    discipline: 'Design',
    remote: true,
    immediate: true,
    skills: ['Product design', 'Figma', 'Design systems', 'Mobile UX'],
    summary: 'Turning complex financial products into simple, human experiences. Looking for a high-trust team building tools people love.',
    color: 'rose',
    prev: 'Product Designer · Razorpay',
    period: '2022 – 2026',
    verified: true,
    hasResume: true,
    contactMode: 'verified_recruiters',
    resumeMode: 'verified_recruiters',
    layoffCategory: 'division',
  },
  {
    id: 'c-2',
    name: 'Daniel Kim',
    role: 'Staff Software Engineer',
    company: 'Figma',
    location: 'San Francisco',
    years: 8,
    discipline: 'Engineering',
    remote: true,
    immediate: true,
    skills: ['React', 'TypeScript', 'WebAssembly', 'Frontend architecture'],
    summary: 'Building thoughtful collaboration tools for creators. Previously scaled canvas performance and real-time syncing for millions of daily active users.',
    color: 'slate',
    prev: 'Software Engineer · Atlassian',
    period: '2021 – 2026',
    verified: true,
    hasResume: true,
    contactMode: 'request_access',
    resumeMode: 'request_access',
    layoffCategory: 'team',
  },
  {
    id: 'c-3',
    name: 'Priya Nair',
    role: 'Lead Product Manager',
    company: 'Spotify',
    location: 'London',
    years: 7,
    discipline: 'Product',
    remote: false,
    immediate: false,
    skills: ['Product strategy', 'Growth', 'Consumer tech', 'Discovery'],
    summary: 'Product leader focused on discovery, personalization, and user engagement algorithms. Experienced with cross-functional leadership in high-velocity tech orgs.',
    color: 'sand',
    prev: 'Senior PM · Deliveroo',
    period: '2020 – 2026',
    verified: true,
    hasResume: false,
    contactMode: 'request_access',
    resumeMode: 'hidden',
    layoffCategory: 'division',
  },
  {
    id: 'c-4',
    name: 'Marcus Vance',
    role: 'Principal Infrastructure Engineer',
    company: 'AWS',
    location: 'New York',
    years: 11,
    discipline: 'Engineering',
    remote: true,
    immediate: true,
    skills: ['Kubernetes', 'Go', 'Distributed systems', 'Terraform', 'PostgreSQL'],
    summary: 'Specialized in resilient cloud infrastructure, multi-region failover, and high-throughput low-latency pipelines.',
    color: 'lilac',
    prev: 'Staff SRE · Datadog',
    period: '2019 – 2026',
    verified: true,
    hasResume: true,
    contactMode: 'verified_recruiters',
    resumeMode: 'verified_recruiters',
    layoffCategory: 'company_wide',
  },
  {
    id: 'c-5',
    name: 'Elena Rostova',
    role: 'Senior Data Scientist',
    company: 'Meta',
    location: 'London',
    years: 5,
    discipline: 'Data',
    remote: true,
    immediate: false,
    skills: ['Python', 'Machine learning', 'PyTorch', 'Experimentation', 'Causal inference'],
    summary: 'Applying deep learning and statistical modeling to user retention and recommendation ranking.',
    color: 'rose',
    prev: 'Data Analyst · DeepMind',
    period: '2021 – 2026',
    verified: false,
    hasResume: true,
    contactMode: 'request_access',
    resumeMode: 'request_access',
    layoffCategory: 'team',
  },
  {
    id: 'c-6',
    name: 'Rohan Verma',
    role: 'Senior Backend Engineer',
    company: 'Google',
    location: 'Bengaluru',
    years: 7,
    discipline: 'Engineering',
    remote: true,
    immediate: true,
    skills: ['Java', 'Go', 'gRPC', 'System design', 'Microservices'],
    summary: 'Designed and operated large scale distributed backend systems with five-nines reliability requirements.',
    color: 'slate',
    prev: 'Software Engineer · Flipkart',
    period: '2020 – 2026',
    verified: true,
    hasResume: true,
    contactMode: 'request_access',
    resumeMode: 'request_access',
    layoffCategory: 'division',
  },
  {
    id: 'c-7',
    name: 'Chloe Bennett',
    role: 'Lead Design Systems Architect',
    company: 'Airbnb',
    location: 'San Francisco',
    years: 9,
    discipline: 'Design',
    remote: true,
    immediate: true,
    skills: ['Design systems', 'Figma', 'React', 'Accessibility', 'Interaction design'],
    summary: 'Bridging design and engineering to build accessible, delightful component systems used by hundreds of engineers and designers.',
    color: 'sand',
    prev: 'Senior Designer · Dropbox',
    period: '2019 – 2026',
    verified: true,
    hasResume: true,
    contactMode: 'verified_recruiters',
    resumeMode: 'verified_recruiters',
    layoffCategory: 'team',
  },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let people = [...samplePeople];
let saved = new Set();
let page = 'discover';
let activeProfileType = 'candidate'; // 'candidate' or 'recruiter'
let draft = null;
let recruiterDraft = null;
let resume = null;
let toastTimer;
let currentAccount = null;
let deletionStatus = null;

// Shortlist private notes store (persisted in localStorage for preview)
const shortlistNotes = new Map(
  JSON.parse(localStorage.getItem('ml_shortlist_notes') || '[]'),
);

function persistNotes() {
  localStorage.setItem('ml_shortlist_notes', JSON.stringify([...shortlistNotes.entries()]));
}

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (n) =>
  n.split(' ').map((x) => x[0]).slice(0, 2).join('');

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function toast(t) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = t;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 4200);
}

// ---------------------------------------------------------------------------
// Save / shortlist
// ---------------------------------------------------------------------------
async function save(id) {
  const isSaved = saved.has(id);
  if (isSaved) {
    saved.delete(id);
    if (isSupabaseConfigured) {
      removeFromShortlist(id).catch(console.error);
    }
    toast('Removed from shortlist.');
  } else {
    saved.add(id);
    if (isSupabaseConfigured) {
      saveToShortlist(id, shortlistNotes.get(id)).catch(console.error);
    }
    toast('Saved to shortlist.');
  }
  render();
}

// ---------------------------------------------------------------------------
// Render candidate list & shortlist
// ---------------------------------------------------------------------------
function render() {
  const searchInput = $('#search');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const disc = [...document.querySelectorAll('[name=discipline]:checked')].map((x) => x.value);

  const locVal = $('#location')?.value;
  const remoteVal = $('#remote')?.checked;
  const availVal = $('#available')?.checked;
  const verifiedOnlyVal = $('#verified-only')?.checked;
  const hasResumeVal = $('#has-resume')?.checked;

  let list = people.filter((p) => {
    if (page === 'shortlist' && !saved.has(p.id)) return false;
    if (q) {
      const haystack = [p.name, p.role, p.company, p.location, ...(p.skills || [])].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (disc.length && !disc.includes(p.discipline)) return false;
    if (locVal && p.location !== locVal) return false;
    if (remoteVal && !p.remote) return false;
    if (availVal && !p.immediate) return false;
    if (verifiedOnlyVal && !p.verified) return false;
    if (hasResumeVal && !p.hasResume) return false;
    return true;
  });

  const expVal = $('#experience')?.value;
  if (expVal) {
    const [min, max] = expVal.split('-').map(Number);
    list = list.filter((p) => p.years >= min && p.years <= max);
  }

  const sortVal = $('#sort')?.value;
  if (sortVal === 'experience') list.sort((a, b) => b.years - a.years);
  if (sortVal === 'name') list.sort((a, b) => a.name.localeCompare(b.name));

  const savedCountEl = $('#saved-count');
  if (savedCountEl) savedCountEl.textContent = saved.size;

  const resultCountEl = $('#result-count');
  if (resultCountEl) resultCountEl.textContent = `${list.length} ${list.length === 1 ? 'person' : 'people'}`;

  const resultCaptionEl = $('#result-caption');
  if (resultCaptionEl) resultCaptionEl.textContent = page === 'shortlist' ? ' in your shortlist' : ' ready for what’s next';

  const container = $('#candidate-list');
  if (!container) return;

  setHTML(
    container,
    list.length
      ? list
          .map((p) => {
            const note = shortlistNotes.get(p.id);
            return `
      <article class="candidate">
        <span class="avatar ${p.color}">${initials(p.name)}</span>
        <div>
          <button class="candidate-name" data-detail="${p.id}">${esc(p.name)}</button>
          <div class="candidate-role">${esc(p.role)} <b>· Ex-${esc(p.company)}</b></div>
          <div class="candidate-meta">
            <span>${icon('pin')}${esc(p.location)}</span>
            <span>${icon('briefcase')}${p.years} years experience</span>
            ${p.remote ? '<span>Open to remote</span>' : ''}
            ${p.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
            ${p.hasResume ? '<span style="color:#515966;">📄 Résumé</span>' : ''}
          </div>
          <p class="candidate-summary">${esc(p.summary)}</p>
          <div class="tags">${(p.skills || []).map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div>
        </div>
        <div class="candidate-actions">
          <span class="availability ${p.immediate ? '' : 'later'}">${p.immediate ? 'Available now' : 'Available in 2 weeks'}</span>
          <div class="candidate-actionline">
            <button class="iconbutton ${saved.has(p.id) ? 'saved' : ''}" data-save="${p.id}" aria-label="${saved.has(p.id) ? 'Remove' : 'Save'} ${esc(p.name)}" aria-pressed="${saved.has(p.id)}">${icon('bookmark')}</button>
            <button class="profilelink" data-detail="${p.id}">View profile <span>↗</span></button>
          </div>
        </div>

        ${
          page === 'shortlist'
            ? `
        <div class="candidate-note-box" style="grid-column: 1 / -1;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:500;font-size:12px;color:#5a6270;">PRIVATE RECRUITER NOTE</span>
            <button class="textbutton" data-toggle-note="${p.id}">${note ? 'Edit note' : '+ Add private note'}</button>
          </div>
          ${
            note
              ? `<p style="margin:6px 0 0;font-size:13px;color:#353b45;">${esc(note)}</p>`
              : '<p class="muted" style="margin:4px 0 0;font-size:12px;font-style:italic;">Add confidential notes on candidate fit, compensation, or interview stage.</p>'
          }
          <div id="note-edit-${p.id}" class="note-edit-area" hidden>
            <textarea id="note-input-${p.id}" rows="2" placeholder="Write private notes only visible to you...">${esc(note || '')}</textarea>
            <div class="note-actions">
              <button class="button primary small" data-save-note="${p.id}">Save note</button>
              <button class="button small" data-cancel-note="${p.id}">Cancel</button>
            </div>
          </div>
        </div>
        `
            : ''
        }
      </article>
    `;
          })
          .join('')
      : `
      <div class="empty">
        <h3>${page === 'shortlist' && !saved.size ? 'Your next team starts here.' : 'No people match these filters.'}</h3>
        <p>${page === 'shortlist' && !saved.size ? 'Save profiles from Discover talent to keep them together.' : 'Try another skill, location or experience level.'}</p>
        <button class="button" ${page === 'shortlist' && !saved.size ? 'data-page="discover"' : 'data-reset'}>
          ${page === 'shortlist' && !saved.size ? 'Discover talent' : 'Clear filters'}
        </button>
      </div>
    `,
  );
}

// ---------------------------------------------------------------------------
// Reset filters
// ---------------------------------------------------------------------------
function reset() {
  document.querySelectorAll('.filters input').forEach((x) => (x.checked = false));
  const loc = $('#location');
  if (loc) loc.value = '';
  const exp = $('#experience');
  if (exp) exp.value = '';
  const s = $('#search');
  if (s) s.value = '';
  render();
}

// ---------------------------------------------------------------------------
// Navigate
// ---------------------------------------------------------------------------
function navigate(next) {
  page = next;
  location.hash = next;
  document.querySelectorAll('.navitem').forEach((e) => e.classList.toggle('active', e.dataset.page === next));
  const crumb = $('#crumb');
  if (crumb) {
    crumb.textContent = {
      discover: 'Discover talent',
      shortlist: 'Shortlist',
      reviews: 'Manager reviews',
      stats: 'Statistics',
      profile: 'My profile',
      settings: 'Settings',
    }[next];
  }

  const dir = $('#directory');
  if (dir) dir.hidden = !['discover', 'shortlist'].includes(next);
  const rev = $('#reviews-page');
  if (rev) rev.hidden = next !== 'reviews';
  const st = $('#stats-page');
  if (st) st.hidden = next !== 'stats';
  const prof = $('#profile-page');
  if (prof) prof.hidden = next !== 'profile';
  const set = $('#settings-page');
  if (set) set.hidden = next !== 'settings';

  const titles = {
    discover: ['GOOD PEOPLE. NEW POSSIBILITIES.', 'Find the person.<br><span>Not just the résumé.</span>', 'Meet talented people ready for their next chapter in tech.'],
    shortlist: ['A LITTLE CLOSER TO YOUR NEXT TEAM.', 'People worth<br><span>a conversation.</span>', 'Your saved candidates, together in one place.'],
    reviews: ['BETTER TEAMS START WITH UNDERSTANDING.', 'The people<br><span>behind the teams.</span>', 'First-hand experiences that bring context to management.'],
    stats: ['UNDERSTANDING THE LANDSCAPE.', 'Numbers that<br><span>tell a story.</span>', 'Aggregated, privacy-safe statistics about the community.'],
    profile: ['THERE’S MORE TO YOUR STORY.', 'Your experience.<br><span>Your next chapter.</span>', 'Give the right team a clear picture of what you bring.'],
    settings: ['YOUR ACCOUNT.', 'Privacy and<br><span>account controls.</span>', 'Manage your data, preferences, and account.'],
  };

  const pageHead = $('.page-heading');
  if (pageHead) {
    setHTML(pageHead, `<div class="eyebrow">${titles[next][0]}</div><h1>${titles[next][1]}</h1><p>${titles[next][2]}</p>`);
  }

  if (next === 'reviews') renderReviews();
  if (next === 'stats') renderStats();
  if (next === 'profile') renderProfile();
  if (next === 'settings') renderSettings();
  render();
}

// ---------------------------------------------------------------------------
// Candidate detail dialog
// ---------------------------------------------------------------------------
function detail(id) {
  const p = people.find((p) => p.id === id);
  if (!p) return;

  const contactLabel = {
    verified_recruiters: 'Visible to verified recruiters',
    request_access: 'Available on request',
    hidden: 'Private',
  };

  setHTML(
    $('#detail-content'),
    `
    <div class="detail-body">
      <div class="detail-heading">
        <span class="avatar ${p.color}">${initials(p.name)}</span>
        <div>
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.role)} · Ex-${esc(p.company)}</p>
          <div class="candidate-meta">
            <span>${icon('pin')}${esc(p.location)}</span>
            <span>${icon('briefcase')}${p.years} years experience</span>
            ${p.remote ? '<span>Open to remote</span>' : ''}
            ${p.verified ? '<span class="verified-badge">✓ Employment verified</span>' : '<span style="color:#8a9099;">Unverified record</span>'}
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>About</h3>
        <p>${esc(p.summary)}</p>
        <div class="tags">${(p.skills || []).map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div>
      </div>

      <div class="detail-section">
        <h3>Work experience</h3>
        <div class="employment">
          <strong>${esc(p.role)} · ${esc(p.company)}</strong>
          <small>${esc(p.period || 'Recent')}</small>
          ${p.layoffCategory ? `<small>Departure category: ${esc(p.layoffCategory)} restructuring</small>` : ''}
        </div>
        ${p.prev ? `<div class="employment">${esc(p.prev)}<small>Previous role</small></div>` : ''}
      </div>

      <div class="detail-section">
        <h3>Résumé & contact permissions</h3>
        <p>Contact setting: <strong>${contactLabel[p.contactMode] || 'Private'}</strong></p>
        <p>Résumé setting: <strong>${contactLabel[p.resumeMode] || 'Private'}</strong></p>
        <p class="muted">${esc(p.name.split(' ')[0])} chooses when to share their résumé, email and phone number with hiring teams.</p>
        ${p.contactMode === 'request_access' ? '<button class="button primary" data-contact-request>Request an introduction ↗</button>' : ''}
        ${p.contactMode === 'verified_recruiters' ? '<button class="button primary" data-contact-request>Direct contact ↗</button>' : ''}
        ${p.contactMode === 'hidden' ? '<p class="form-note">Contact details are private. This profile is visible for discovery only.</p>' : ''}
      </div>

      <div class="safety-row">
        <button class="report-link" data-report-candidate="${p.id}">Report profile to moderation</button>
        <span style="color:#d0d4dc;">·</span>
        <button class="report-link" data-block-candidate="${p.id}">Block candidate</button>
      </div>

      <div class="notice">Personal emails, phone numbers, exit letters, salary slips, and manager LinkedIn profiles are kept strictly private per privacy policy.</div>
    </div>
  `,
  );

  // Wire safety links
  const reportBtn = document.querySelector(`[data-report-candidate="${p.id}"]`);
  if (reportBtn) {
    reportBtn.onclick = () => {
      $('#detail').close();
      openReportDialog('candidate', p.id, p.name);
    };
  }

  const blockBtn = document.querySelector(`[data-block-candidate="${p.id}"]`);
  if (blockBtn) {
    blockBtn.onclick = () => {
      $('#detail').close();
      openBlockDialog(p.id, p.name);
    };
  }

  // Wire contact request
  const contactBtn = document.querySelector('[data-contact-request]');
  if (contactBtn) {
    contactBtn.onclick = () => {
      const contactForm = $('#contact-form');
      if (contactForm) contactForm.elements.candidate_id.value = id;
      $('#contact-dialog').showModal();
    };
  }

  $('#detail').showModal();
}

// ---------------------------------------------------------------------------
// Open Safety Dialogs
// ---------------------------------------------------------------------------
function openReportDialog(targetType, targetId, targetLabel) {
  const form = $('#report-form');
  if (!form) return;
  form.reset();
  $('#report-target-type').value = targetType;
  $('#report-target-id').value = targetId;
  $('#report-dialog-title').textContent = `Report ${targetType === 'candidate' ? 'candidate' : 'review'}: ${targetLabel}`;
  const feedback = $('#report-feedback');
  if (feedback) setHTML(feedback, '');
  $('#report-dialog').showModal();
}

function openBlockDialog(blockedId, name) {
  const form = $('#block-form');
  if (!form) return;
  form.reset();
  $('#block-target-id').value = blockedId;
  const feedback = $('#block-feedback');
  if (feedback) setHTML(feedback, '');
  $('#block-dialog').showModal();
}

// ---------------------------------------------------------------------------
// Render reviews page — with 4 structured ratings & reporting
// ---------------------------------------------------------------------------
async function renderReviews() {
  const sampleReviews = [
    {
      id: 'rev-1',
      name: 'Alex Morgan',
      title: 'Engineering Manager',
      company: 'TechCorp',
      color: 'slate',
      leadership: 5,
      communication: 4,
      fairness: 5,
      growth: 4,
      quote: 'Clear expectations, regular feedback, and room to make decisions. During a difficult transition, communication stayed honest.',
    },
    {
      id: 'rev-2',
      name: 'Jamie Park',
      title: 'Design Director',
      company: 'StudioGlobal',
      color: 'rose',
      leadership: 4,
      communication: 5,
      fairness: 4,
      growth: 4,
      quote: 'Made time for mentorship and protected focus time. I would have appreciated more visibility into decisions across the wider organization.',
    },
  ];

  let displayReviews = sampleReviews;
  if (isSupabaseConfigured) {
    try {
      const live = await getPublishedReviews();
      if (live && live.length) {
        displayReviews = live.map((r, i) => ({
          id: r.id,
          name: r.manager_name,
          title: r.review_title || 'Engineering Leader',
          company: r.company_name || 'Verified Company',
          color: (['slate', 'rose', 'sand', 'lilac'])[i % 4],
          leadership: r.leadership_rating || r.rating,
          communication: r.communication_rating || r.rating,
          fairness: r.fairness_rating || r.rating,
          growth: r.career_growth_rating || r.rating,
          quote: r.review_body,
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }

  const ratingBar = (label, value) => `
    <div class="rating-bar-row">
      <span class="rating-bar-label">${label}</span>
      <div class="rating-bar"><div class="rating-bar-fill" style="width:${(value || 3) * 20}%"></div></div>
      <span class="rating-bar-value">${value || 3}/5</span>
    </div>`;

  setHTML(
    $('#reviews-page'),
    `
    <div class="review-toolbar">
      <p>Manager profiles are separate from candidate profiles. Verified reviews only.</p>
      <button class="button primary" id="write-review">Write a review +</button>
    </div>
    <div class="manager-grid">${displayReviews
      .map(
        (m) => `
      <article class="manager-card">
        <span class="avatar ${m.color}">${initials(m.name)}</span>
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.title)} · ${esc(m.company)}</p>
        <div class="structured-ratings">
          ${ratingBar('Leadership', m.leadership)}
          ${ratingBar('Communication', m.communication)}
          ${ratingBar('Fairness', m.fairness)}
          ${ratingBar('Career growth', m.growth)}
        </div>
        <div class="review-rating">☆ ${(((m.leadership || 3) + (m.communication || 3) + (m.fairness || 3) + (m.growth || 3)) / 4).toFixed(1)} / 5 · average</div>
        <div class="review-quote">"${esc(m.quote)}"</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid #eef0f3;">
          <span style="font-size:12px;color:#8f96a3;">Sample review · former direct report</span>
          <button class="report-link" data-report-review="${m.id}" data-report-name="${esc(m.name)}">Report review</button>
        </div>
      </article>
    `,
      )
      .join('')}</div>
    <div class="notice">Manager profiles are linked using a verified LinkedIn URL. Author identity remains anonymous to the public; manager LinkedIn URLs are never shared.</div>
  `,
  );

  const writeBtn = $('#write-review');
  if (writeBtn) writeBtn.onclick = () => $('#review-dialog').showModal();

  document.querySelectorAll('[data-report-review]').forEach((btn) => {
    btn.onclick = () => {
      openReportDialog('review', btn.dataset.reportReview, btn.dataset.reportName || 'Manager review');
    };
  });
}

// ---------------------------------------------------------------------------
// Render stats page (live aggregate counts & threshold protection)
// ---------------------------------------------------------------------------
async function renderStats() {
  let statsData = {
    totalPublished: people.length,
    totalVerified: people.filter((p) => p.verified).length,
    companiesRepresented: new Set(people.map((p) => p.company)).size,
    remoteAvailable: people.filter((p) => p.remote).length,
    roleDistribution: { Engineering: 3, Design: 2, Product: 1, Data: 1 },
    locationDistribution: { Bengaluru: 2, 'San Francisco': 2, London: 2, 'New York': 1 },
    thresholdMet: false,
  };

  if (isSupabaseConfigured) {
    try {
      const live = await getLiveStats();
      statsData = {
        ...live,
        thresholdMet: live.totalPublished >= 10,
      };
    } catch (e) {
      console.error(e);
    }
  }

  setHTML(
    $('#stats-page'),
    `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${statsData.totalPublished}</div>
        <div class="stat-label">Published professionals</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${statsData.totalVerified}</div>
        <div class="stat-label">Verified professionals</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${statsData.companiesRepresented}</div>
        <div class="stat-label">Companies represented</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${statsData.remoteAvailable}</div>
        <div class="stat-label">Open to remote</div>
      </div>
    </div>

    ${
      !statsData.thresholdMet && statsData.totalPublished < 10
        ? `
      <div class="notice" style="margin-bottom:24px;">
        <strong>Differential privacy threshold (spec §16.7):</strong> Segment distributions require a minimum of 10 published profiles before breakdown data is revealed. Currently ${statsData.totalPublished} candidate profiles are published.
      </div>
    `
        : ''
    }

    <div class="stats-charts">
      <div class="chart-placeholder">
        <h3>Role distribution</h3>
        ${
          statsData.thresholdMet || !isSupabaseConfigured
            ? Object.entries(statsData.roleDistribution || {})
                .map(
                  ([role, count]) => `
              <div class="rating-bar-row">
                <span class="rating-bar-label">${esc(role)}</span>
                <div class="rating-bar"><div class="rating-bar-fill" style="width:${Math.min(100, count * 25)}%"></div></div>
                <span class="rating-bar-value">${count}</span>
              </div>
            `,
                )
                .join('')
            : '<p class="muted">Protected until 10 candidates are published.</p>'
        }
      </div>

      <div class="chart-placeholder">
        <h3>Top locations</h3>
        ${
          statsData.thresholdMet || !isSupabaseConfigured
            ? Object.entries(statsData.locationDistribution || {})
                .map(
                  ([loc, count]) => `
              <div class="rating-bar-row">
                <span class="rating-bar-label">${esc(loc)}</span>
                <div class="rating-bar"><div class="rating-bar-fill" style="width:${Math.min(100, count * 35)}%"></div></div>
                <span class="rating-bar-value">${count}</span>
              </div>
            `,
                )
                .join('')
            : '<p class="muted">Protected until 10 candidates are published.</p>'
        }
      </div>

      <div class="chart-placeholder">
        <h3>Privacy policy enforcement</h3>
        <p class="muted">Public benchmarks protect individual and small-team anonymity. Teams of fewer than 10 are never isolated in published statistics.</p>
      </div>

      <div class="chart-placeholder">
        <h3>Verification accuracy</h3>
        <p class="muted">Profiles verified with company credentials or severance evidence are flagged with verified badges across all search indexes.</p>
      </div>
    </div>
  `,
  );
}

// ---------------------------------------------------------------------------
// Render profile page (Job Seeker or Hiring Team)
// ---------------------------------------------------------------------------
function renderProfile() {
  const profileContainer = $('#profile-page');
  if (!profileContainer) return;

  const switcherHtml = `
    <div class="profile-type-switcher">
      <button type="button" class="profile-type-tab ${activeProfileType === 'candidate' ? 'active' : ''}" data-switch-profile="candidate">
        ${icon('user')}
        <div>
          <strong>Job Seeker Profile</strong>
          <small>Looking for a job · share your experience & résumé</small>
        </div>
      </button>
      <button type="button" class="profile-type-tab ${activeProfileType === 'recruiter' ? 'active' : ''}" data-switch-profile="recruiter">
        ${icon('briefcase')}
        <div>
          <strong>Hiring Team Profile</strong>
          <small>Hiring talent · setup company access & discover people</small>
        </div>
      </button>
    </div>
  `;

  if (activeProfileType === 'recruiter') {
    renderRecruiterProfile(switcherHtml);
    return;
  }

  // Streamlined Job Seeker form without unneeded fields
  setHTML(
    profileContainer,
    `
    <div class="profile-layout">
      <div>
        ${switcherHtml}
        <form id="candidate-form" class="form-content">
          <div class="form-header-badge">
            <span class="status-pill verified">Job seeker profile</span>
            <h2>Tell your story</h2>
            <p class="muted">Share your recent experience and résumé so hiring teams can discover you.</p>
          </div>

          <!-- Section 1: Essentials -->
          <div class="form-row">
            <label>Full name<input name="name" required autocomplete="name" placeholder="First and last name"></label>
            <label>Location<input name="location" required placeholder="e.g. Bengaluru, San Francisco, London"></label>
          </div>
          <div class="form-row">
            <label>Discipline<select name="discipline" required>
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Product">Product</option>
              <option value="Data">Data & Analytics</option>
              <option value="Other">Other</option>
            </select></label>
            <label>Years of experience<input name="years" type="number" min="0" max="60" required placeholder="e.g. 5"></label>
          </div>
          <div class="form-row">
            <label>Preferred locations (optional)<input name="preferred_locations" placeholder="Comma-separated cities or regions"></label>
            <label>Available from<input name="available_from" type="date"></label>
          </div>
          <label class="checklabel"><input name="remote" type="checkbox">Open to remote work</label>
          
          <label>Short introduction<textarea name="about" rows="3" required placeholder="A brief intro about your background, what you enjoy building, and the kind of team you want to join next."></textarea></label>

          <!-- Section 2: Latest employment -->
          <h3 class="form-section-title">Most recent company & role</h3>
          <div class="form-row">
            <label>Company name<input name="company" required placeholder="e.g. Stripe, Google, Spotify"></label>
            <label>Role title<input name="role_title" required placeholder="e.g. Senior Frontend Engineer, Staff Designer"></label>
          </div>
          <div class="form-row">
            <label>Organization / Department (optional)<input name="org_name" placeholder="e.g. Payments, Core Infra"></label>
            <label>Team name (optional)<input name="team_name" placeholder="e.g. Checkout flow, Design Systems"></label>
          </div>
          <div class="form-row">
            <label>Start date<input name="started_on" type="date" required></label>
            <label>End date<input name="ended_on" type="date"></label>
          </div>

          <!-- Section 3: Layoff details -->
          <h3 class="form-section-title">Layoff details</h3>
          <div class="form-row">
            <label>Layoff notification date<input name="layoff_date" type="date"></label>
            <label>Last working date<input name="last_working_date" type="date"></label>
          </div>
          <label>Restructuring category<select name="layoff_category">
            <option value="undisclosed">Prefer not to say</option>
            <option value="company_wide">Company-wide workforce reduction</option>
            <option value="division">Division or business unit closure</option>
            <option value="team">Team restructuring</option>
            <option value="individual">Individual position elimination</option>
          </select></label>

          <!-- Section 4: Former manager details (private) -->
          <h3 class="form-section-title">Former manager details (private)</h3>
          <div class="form-row">
            <label>Manager's name (optional)<input name="manager" placeholder="Private — not shown to recruiters"></label>
            <label>Manager's LinkedIn URL (optional)<input name="manager_linkedin" type="url" placeholder="https://www.linkedin.com/in/..."></label>
          </div>
          <p class="form-note">Manager details are private and used only for optional review context.</p>

          <!-- Section 5: Documents & contact details -->
          <h3 class="form-section-title">Documents & contact details</h3>
          <label>Résumé (PDF, up to 10 MB)<input name="resume" type="file" accept="application/pdf,.pdf"></label>
          <div class="form-row">
            <label>Exit / Relieving letter (optional verification)<input name="exit_letter" type="file" accept="application/pdf,image/*"></label>
            <label>Salary slip (optional verification)<input name="salary_slip" type="file" accept="application/pdf,image/*"></label>
          </div>
          <p class="form-note">Exit letters and salary slips are NEVER visible to recruiters — used solely for internal verification.</p>

          <div class="form-row">
            <label>Personal email (private)<input name="email" type="email" required autocomplete="email" placeholder="you@personal.com"></label>
            <label>Phone number (private)<input name="phone" type="tel" autocomplete="tel" placeholder="+91 98765 43210"></label>
          </div>
          <label>Former company email (optional verification challenge)<input name="workemail" type="email" placeholder="you@formercompany.com"></label>

          <!-- Action buttons -->
          <div class="profile-actions" style="margin-top:28px;">
            <button class="button primary" type="submit">Save profile ↗</button>
            <button class="button" type="button" id="preview-recruiter-btn">${icon('eye')} Preview as recruiter</button>
            <button class="button" type="button" id="publish-btn">Publish profile</button>
            <button class="button" type="button" id="pause-btn" style="display:none">Pause profile</button>
          </div>

          <div id="profile-feedback" role="status"></div>
        </form>
      </div>

      <aside class="profile-aside" style="margin-top: 76px;">
        ${icon('shield')}
        <h3>Your story, on your terms.</h3>
        <p>Hiring teams see your experience, availability, and résumé.</p>
        <p>Your personal email, work email, phone, exit letters, and salary slips are <strong>never</strong> visible to recruiters without your permission.</p>
        <p>Manager name and LinkedIn URL are <strong>private</strong>.</p>
      </aside>
    </div>
  `,
  );

  // Restore draft values
  if (draft) {
    for (const [k, v] of Object.entries(draft)) {
      const el = $('#candidate-form')?.elements.namedItem(k);
      if (el && el.type !== 'file') {
        if (el.type === 'checkbox') el.checked = v === 'on' || v === true;
        else el.value = v;
      }
    }
  }

  // Recruiter preview handler
  const previewBtn = $('#preview-recruiter-btn');
  if (previewBtn) {
    previewBtn.onclick = () => {
      const form = $('#candidate-form');
      const formData = form ? Object.fromEntries(new FormData(form)) : draft || {};
      openRecruiterPreview(formData);
    };
  }

  // Form submission
  const form = $('#candidate-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const resumeFile = f.elements.resume?.files[0];
      if (resumeFile && (!resumeFile.name.toLowerCase().endsWith('.pdf') || resumeFile.size > 10 * 1024 * 1024)) {
        toast('Choose a PDF smaller than 10 MB.');
        return;
      }

      resume = resumeFile || resume;
      draft = Object.fromEntries([...new FormData(f)].filter(([k]) => !['resume', 'exit_letter', 'salary_slip'].includes(k)));

      setHTML(
        $('#profile-feedback'),
        `
        <div class="success-note">
          <strong>Profile saved to local session.</strong><br>
          ${esc(draft.name)} · ${esc(draft.role_title)} at ${esc(draft.company)}<br>
          ${draft.discipline ? `Discipline: ${esc(draft.discipline)} · ` : ''}${esc(draft.location)} · ${esc(draft.years)} years experience<br>
          <p>${esc(draft.about)}</p>
          ${resume ? `<p style="font-size:13px;color:#515966;">📄 Résumé attached: ${esc(resume.name)}</p>` : ''}
          <p style="margin-top:10px;font-size:13px;color:#28743a;">✓ Privacy protection active: Contact details are shared only on approved introductions.</p>
        </div>
      `,
      );
      $('#profile-feedback')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }

  $('#publish-btn')?.addEventListener('click', () => {
    if (!isSupabaseConfigured) {
      toast('Demo mode: Profile ready to publish. Connect Supabase to persist live.');
    }
  });
}

// ---------------------------------------------------------------------------
// Open Recruiter Preview Modal
// ---------------------------------------------------------------------------
function openRecruiterPreview(d) {
  const roleName = d.role_title || 'Software Professional';
  setHTML(
    $('#preview-content'),
    `
    <div class="detail-heading">
      <span class="avatar lilac">${initials(d.name || 'Preview User')}</span>
      <div>
        <h2>${esc(d.name || 'Your Full Name')}</h2>
        <p>${esc(roleName)} · Ex-${esc(d.company || 'Latest Company')}</p>
        <div class="candidate-meta">
          <span>${icon('pin')}${esc(d.location || 'Your Location')}</span>
          <span>${icon('briefcase')}${d.years || '0'} years experience</span>
          ${d.remote === 'on' || d.remote === true ? '<span>Open to remote</span>' : ''}
          <span class="verified-badge">✓ Verified preview</span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>About</h3>
      <p>${esc(d.about || 'Your professional summary will be displayed here for hiring teams.')}</p>
      ${d.discipline ? `<div class="tags"><span class="tag">${esc(d.discipline)}</span></div>` : ''}
    </div>

    <div class="detail-section">
      <h3>Work experience</h3>
      <div class="employment">
        <strong>${esc(roleName)} · ${esc(d.company || 'Company')}</strong>
        <small>${esc(d.started_on || 'Start')} – ${esc(d.ended_on || 'Present')}</small>
        ${d.org_name ? `<small>${esc(d.org_name)}${d.team_name ? ' / ' + esc(d.team_name) : ''}</small>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <h3>Contact permissions</h3>
      <p>Contact request: <strong>Introduction required (default)</strong></p>
      <p class="muted">Hiring teams introduce themselves and their role before your personal email or phone number are shared.</p>
    </div>

    <div class="notice" style="margin-top:20px;">
      <strong>Privacy guarantee:</strong> Personal email (${esc(d.email || 'hidden')}), phone (${esc(d.phone || 'hidden')}), exit letters, salary slips, and manager LinkedIn are <strong>never</strong> shown directly to hiring teams.
    </div>
  `,
  );

  $('#preview-dialog').showModal();
}

// ---------------------------------------------------------------------------
// Render hiring team / recruiter profile page
// ---------------------------------------------------------------------------
function renderRecruiterProfile(switcherHtml) {
  const profileContainer = $('#profile-page');
  if (!profileContainer) return;

  setHTML(
    profileContainer,
    `
    <div class="profile-layout">
      <div>
        ${switcherHtml || ''}
        <form id="recruiter-form" class="form-content">
          <div class="form-header-badge">
            <span class="status-pill pending">Hiring team profile</span>
            <h2>Hiring team profile</h2>
            <p class="muted">Set up your company profile to discover talent, build shortlists, and request candidate introductions.</p>
          </div>

          <div class="form-row">
            <label>Full name<input name="name" required autocomplete="name" placeholder="First and last name"></label>
            <label>Your role title<input name="title" required placeholder="e.g. Head of Talent, Engineering Manager, Founder"></label>
          </div>
          <div class="form-row">
            <label>Hiring company<input name="company" required placeholder="Company or studio name"></label>
            <label>Corporate work email<input name="work_email" type="email" required placeholder="you@company.com"></label>
          </div>
          <label>LinkedIn profile URL<input name="linkedin_url" type="url" placeholder="https://www.linkedin.com/in/..."></label>

          <label>What roles are you hiring for?<textarea name="hiring_focus" rows="3" placeholder="e.g. We are hiring Senior Fullstack Engineers and Product Designers in Bengaluru and remote across APAC."></textarea></label>

          <p class="form-note">Your work email is verified with a domain challenge. It ensures only genuine hiring teams access candidate introductions.</p>

          <div class="profile-actions" style="margin-top:24px;">
            <button class="button primary" type="submit">Save recruiter profile ↗</button>
          </div>
          <div id="recruiter-feedback" role="status"></div>
        </form>
      </div>

      <aside class="profile-aside" style="margin-top: 76px;">
        ${icon('shield')}
        <h3>Verified hiring teams.</h3>
        <p>Company email verification ensures only legitimate hiring professionals can access candidate profiles.</p>
        <p>Your work email is kept private and used solely for verification.</p>
        <p>Once verified, you can search candidates, build shortlists, and request introductions.</p>
      </aside>
    </div>
  `,
  );

  // Restore recruiter draft values
  if (recruiterDraft) {
    for (const [k, v] of Object.entries(recruiterDraft)) {
      const el = $('#recruiter-form')?.elements.namedItem(k);
      if (el) el.value = v;
    }
  }

  const recruiterForm = $('#recruiter-form');
  if (recruiterForm) {
    recruiterForm.onsubmit = (e) => {
      e.preventDefault();
      recruiterDraft = Object.fromEntries(new FormData(e.currentTarget));
      setHTML(
        $('#recruiter-feedback'),
        `
        <div class="success-note">
          <strong>Hiring team profile saved to preview session.</strong><br>
          ${esc(recruiterDraft.name)} · ${esc(recruiterDraft.title)} at ${esc(recruiterDraft.company)}<br>
          <span style="font-size:13px;color:#515966;">Corporate work email: ${esc(recruiterDraft.work_email)}</span><br>
          <p style="margin-top:8px;font-size:13px;color:#28743a;">✓ Domain challenge queued: In the live platform, a verification email is sent to confirm corporate domain access.</p>
        </div>
      `,
      );
      $('#recruiter-feedback')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }
}


// ---------------------------------------------------------------------------
// Render settings page (Safety, Data Export, Consent, Deletion)
// ---------------------------------------------------------------------------
async function renderSettings() {
  let scheduledDate = null;
  if (isSupabaseConfigured) {
    try {
      const del = await getAccountDeletionStatus();
      if (del && del.status === 'scheduled') {
        scheduledDate = del.scheduled_for;
      }
    } catch (e) {
      console.error(e);
    }
  }

  setHTML(
    $('#settings-page'),
    `
    <div class="settings-layout">
      <div class="settings-section">
        <h3>Account information</h3>
        <p class="muted">Manage your profile identity and role permissions.</p>
        <div class="setting-row">
          <span>Account role</span>
          <span class="status-pill verified">${currentAccount ? esc(currentAccount.account_type) : 'Candidate (preview)'}</span>
        </div>
        <div class="setting-row">
          <span>Full name</span>
          <span>${currentAccount ? esc(currentAccount.full_name) : 'Preview User'}</span>
        </div>
        <div class="setting-row">
          <span>Login status</span>
          <span>${isSupabaseConfigured ? 'Connected to Supabase' : 'Offline demo session'}</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>Data & privacy rights</h3>
        <p class="muted">You have complete ownership and portability of your data.</p>
        <button class="button" id="export-btn">${icon('upload')} Export my data (JSON)</button>
        <p class="form-note">Download an instant machine-readable archive containing your complete profile, employment records, contact settings, and metadata.</p>
      </div>

      <div class="settings-section">
        <h3>Consent & permissions</h3>
        <p class="muted">Manage your active authorizations under platform privacy policies.</p>
        <div class="consent-card">
          <div class="consent-card-header">
            <h4>Platform Terms & Privacy Policy</h4>
            <span class="consent-badge active">Active · v1.0</span>
          </div>
          <p>Authorizes storage of your professional history and profile searchability.</p>
          <button class="button small" id="revoke-privacy-consent">Revoke consent</button>
        </div>
        <div class="consent-card">
          <div class="consent-card-header">
            <h4>Public Aggregates & Industry Research</h4>
            <span class="consent-badge active">Opted-in</span>
          </div>
          <p>Allows anonymized, thresholded data to contribute to public layoff research (minimum 10 candidates per category).</p>
          <button class="button small" id="toggle-stats-consent">Opt out of public metrics</button>
        </div>
      </div>

      <div class="settings-section danger-zone">
        <h3>Danger zone</h3>
        <p class="muted">Permanently delete your account and all associated data.</p>
        <div id="deletion-status-area">
          ${
            scheduledDate
              ? `
            <div class="danger-callout">
              <strong>Account deletion scheduled for ${new Date(scheduledDate).toLocaleDateString()}</strong>
              <p style="margin:4px 0 10px;">Your account is unlisted. All records will be permanently purged when the 30-day grace period concludes.</p>
              <button class="button small" id="cancel-deletion-btn">Cancel deletion request</button>
            </div>
          `
              : `
            <button class="button danger" id="delete-btn">Request account deletion</button>
            <p class="form-note">Account deletion is scheduled with a 30-day grace period. You can cancel at any time before final purge.</p>
          `
          }
        </div>
      </div>
    </div>
  `,
  );

  // Wire export button
  $('#export-btn')?.addEventListener('click', async () => {
    try {
      let exportData;
      if (isSupabaseConfigured) {
        exportData = await exportUserData();
      } else {
        exportData = {
          export_metadata: {
            exported_at: new Date().toISOString(),
            system: 'MassLaidOff',
            version: '1.0',
          },
          candidate_profile: draft || samplePeople[0],
          session_saved_candidates: [...saved],
          private_recruiter_notes: Object.fromEntries(shortlistNotes),
        };
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `masslaidoff-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Complete data export downloaded.');
    } catch (e) {
      toast(e?.message || 'Could not export data.');
    }
  });

  // Wire consent buttons
  $('#revoke-privacy-consent')?.addEventListener('click', async () => {
    if (isSupabaseConfigured) {
      try {
        await revokeConsent('privacy_policy');
        toast('Privacy consent revoked. Profile unlisted.');
      } catch (e) {
        toast(e?.message || 'Could not update consent.');
      }
    } else {
      toast('Demo mode: Consent revoked. Profile would be unlisted.');
    }
  });

  $('#toggle-stats-consent')?.addEventListener('click', async () => {
    if (isSupabaseConfigured) {
      try {
        await revokeConsent('public_stats');
        toast('Opted out of public statistics aggregation.');
      } catch (e) {
        toast(e?.message || 'Could not update consent.');
      }
    } else {
      toast('Demo mode: Preference updated.');
    }
  });

  // Wire delete button
  $('#delete-btn')?.addEventListener('click', () => {
    $('#deletion-dialog').showModal();
  });

  // Wire cancel deletion button
  $('#cancel-deletion-btn')?.addEventListener('click', async () => {
    if (isSupabaseConfigured) {
      try {
        await cancelAccountDeletion();
        toast('Account deletion cancelled.');
        renderSettings();
      } catch (e) {
        toast(e?.message || 'Could not cancel deletion.');
      }
    } else {
      toast('Account deletion request cancelled.');
      scheduledDate = null;
      renderSettings();
    }
  });
}

// ---------------------------------------------------------------------------
// Event delegation (Navigation, Shortlist, Detail, Notes, Roles)
// ---------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const t = e.target.closest(
    '[data-page],[data-detail],[data-save],[data-close],[data-reset],[data-role],[data-switch-profile],[data-toggle-note],[data-save-note],[data-cancel-note]',
  );
  if (!t) return;

  if (t.dataset.switchProfile) {
    activeProfileType = t.dataset.switchProfile;
    renderProfile();
    return;
  }

  if (t.dataset.page) {
    navigate(t.dataset.page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (t.dataset.detail) detail(t.dataset.detail);
  if (t.dataset.save) save(t.dataset.save);
  if (t.hasAttribute('data-close')) t.closest('dialog')?.close();
  if (t.hasAttribute('data-reset')) reset();

  // Shortlist note toggles
  if (t.dataset.toggleNote) {
    const id = t.dataset.toggleNote;
    const editArea = $(`#note-edit-${id}`);
    if (editArea) editArea.hidden = !editArea.hidden;
  }
  if (t.dataset.saveNote) {
    const id = t.dataset.saveNote;
    const input = $(`#note-input-${id}`);
    if (input) {
      const val = input.value.trim();
      shortlistNotes.set(id, val);
      persistNotes();
      if (isSupabaseConfigured) {
        updateShortlistNote(id, val).catch(console.error);
      }
      toast('Private note saved.');
      render();
    }
  }
  if (t.dataset.cancelNote) {
    const id = t.dataset.cancelNote;
    const editArea = $(`#note-edit-${id}`);
    if (editArea) editArea.hidden = true;
  }

  // Role dialog
  if (t.dataset.role) {
    activeProfileType = t.dataset.role;
    currentAccount = { account_type: t.dataset.role, full_name: 'Preview User' };
    $('#role-dialog')?.close();
    navigate('profile');
    toast(`Selected: ${t.dataset.role === 'candidate' ? 'Job Seeker' : 'Hiring Team'} profile.`);
  }
});

// ---------------------------------------------------------------------------
// Filter & search handlers
// ---------------------------------------------------------------------------
const resetBtn = $('#reset');
if (resetBtn) resetBtn.onclick = reset;
const searchEl = $('#search');
if (searchEl) searchEl.oninput = render;
document.querySelectorAll('.filters input,.filters select,#sort').forEach((e) => (e.onchange = render));

// ---------------------------------------------------------------------------
// Review form handler — with 4 ratings
// ---------------------------------------------------------------------------
const reviewForm = $('#review-form');
if (reviewForm) {
  reviewForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      const u = new URL(data.get('linkedin'));
      if (!['linkedin.com', 'www.linkedin.com'].includes(u.hostname) || !u.pathname.startsWith('/in/')) {
        toast('Use a LinkedIn profile URL beginning with linkedin.com/in/.');
        return;
      }
    } catch {
      toast('Enter a valid LinkedIn URL.');
      return;
    }

    if (
      !data.get('leadership_rating') ||
      !data.get('communication_rating') ||
      !data.get('fairness_rating') ||
      !data.get('career_growth_rating')
    ) {
      toast('Please rate all four areas.');
      return;
    }

    const avg = (
      (Number(data.get('leadership_rating')) +
        Number(data.get('communication_rating')) +
        Number(data.get('fairness_rating')) +
        Number(data.get('career_growth_rating'))) /
      4
    ).toFixed(1);

    if (isSupabaseConfigured) {
      try {
        await submitReview({
          managerName: data.get('manager'),
          managerLinkedinUrl: data.get('linkedin'),
          company: data.get('company'),
          relationship: data.get('relationship'),
          rating: Math.round(Number(avg)),
          leadershipRating: Number(data.get('leadership_rating')),
          communicationRating: Number(data.get('communication_rating')),
          fairnessRating: Number(data.get('fairness_rating')),
          careerGrowthRating: Number(data.get('career_growth_rating')),
          reviewTitle: data.get('title'),
          reviewBody: data.get('review'),
        });
        toast('Review submitted for moderation.');
      } catch (err) {
        toast(err?.message || 'Could not submit review.');
      }
    }

    setHTML(
      $('#review-feedback'),
      `<div class="success-note">
      Review preview (average: ${avg}/5)<br>
      Leadership: ${data.get('leadership_rating')}/5 · Communication: ${data.get('communication_rating')}/5<br>
      Fairness: ${data.get('fairness_rating')}/5 · Career growth: ${data.get('career_growth_rating')}/5<br>
      Review submitted for trust & safety moderation.
    </div>`,
    );
  };
}

// ---------------------------------------------------------------------------
// Safety Report Form Handler
// ---------------------------------------------------------------------------
const reportForm = $('#report-form');
if (reportForm) {
  reportForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const targetType = data.get('target_type');
    const targetId = data.get('target_id');
    const reportType = data.get('report_type');
    const details = data.get('details');

    if (isSupabaseConfigured) {
      try {
        if (targetType === 'candidate') {
          await reportUser({ reportedUserId: targetId, reportType, details });
        } else {
          await reportReview(targetId, reportType, details);
        }
      } catch (err) {
        toast(err?.message || 'Could not submit report.');
        return;
      }
    }

    setHTML(
      $('#report-feedback'),
      '<div class="success-note">Report submitted. Our moderation team reviews every report confidentially.</div>',
    );
    setTimeout(() => {
      $('#report-dialog')?.close();
      toast('Report submitted. Thank you for keeping MassLaidOff safe.');
    }, 1500);
  };
}

// ---------------------------------------------------------------------------
// Block Form Handler
// ---------------------------------------------------------------------------
const blockForm = $('#block-form');
if (blockForm) {
  blockForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const blockedId = data.get('blocked_id');
    const reason = data.get('reason');

    if (isSupabaseConfigured) {
      try {
        await blockUser(blockedId, reason);
      } catch (err) {
        toast(err?.message || 'Could not block user.');
        return;
      }
    }

    people = people.filter((p) => p.id !== blockedId);
    saved.delete(blockedId);
    $('#block-dialog')?.close();
    toast('User blocked. They will no longer appear in your directory.');
    render();
  };
}

// ---------------------------------------------------------------------------
// Account Deletion Form Handler
// ---------------------------------------------------------------------------
const deletionForm = $('#deletion-form');
if (deletionForm) {
  deletionForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const reason = data.get('reason');

    if (isSupabaseConfigured) {
      try {
        await requestAccountDeletion(reason);
      } catch (err) {
        toast(err?.message || 'Could not submit deletion request.');
        return;
      }
    }

    setHTML(
      $('#deletion-feedback'),
      '<div class="success-note">Account deletion scheduled. Your profile is unlisted. You have 30 days to cancel before records are purged.</div>',
    );
    setTimeout(() => {
      $('#deletion-dialog')?.close();
      renderSettings();
      toast('Account deletion scheduled (30-day grace period).');
    }, 1500);
  };
}

// ---------------------------------------------------------------------------
// Contact request form handler
// ---------------------------------------------------------------------------
const contactForm = $('#contact-form');
if (contactForm) {
  contactForm.onsubmit = (e) => {
    e.preventDefault();
    setHTML(
      $('#contact-feedback'),
      '<div class="success-note">Request preview complete. In the live platform, the candidate can accept before any contact information is shared.</div>',
    );
  };
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (
    e.key === '/' &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) &&
    !document.querySelector('dialog[open]') &&
    ['discover', 'shortlist'].includes(page)
  ) {
    e.preventDefault();
    $('#search')?.focus();
  }
});

// ---------------------------------------------------------------------------
// Hash routing
// ---------------------------------------------------------------------------
window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (['discover', 'shortlist', 'reviews', 'stats', 'profile', 'settings'].includes(next) && next !== page) {
    navigate(next);
  }
});

const initialPage = location.hash.slice(1);
navigate(['discover', 'shortlist', 'reviews', 'stats', 'profile', 'settings'].includes(initialPage) ? initialPage : 'discover');

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
async function bootstrap() {
  if (!isSupabaseConfigured) {
    // Already loaded with high quality sample data
    render();
    return;
  }

  try {
    currentAccount = await getUserAccount();
    const liveList = await listCandidates();
    if (liveList && liveList.length) {
      people = liveList;
    }
    const myShortlist = await getShortlist();
    if (myShortlist && myShortlist.length) {
      saved = new Set(myShortlist.map((s) => s.candidate_id));
      myShortlist.forEach((s) => {
        if (s.private_note) shortlistNotes.set(s.candidate_id, s.private_note);
      });
      persistNotes();
    }
    render();
  } catch (error) {
    console.error(error);
  }
}

// Profile form Supabase submit handlers (Candidate & Recruiter)
document.addEventListener(
  'submit',
  async (event) => {
    // 1. Hiring team / recruiter form
    if (event.target.id === 'recruiter-form') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!isSupabaseConfigured) return;

      const form = event.target;
      const values = Object.fromEntries(new FormData(form));
      const feedback = $('#recruiter-feedback');

      try {
        const user = await getCurrentUser();
        if (!user) {
          try {
            await signInWithEmail(values.work_email);
            setHTML(
              feedback,
              '<div class="success-note">Check your corporate email for a secure sign-in link to verify your domain.</div>',
            );
          } catch (authError) {
            toast(authError?.message || 'Could not send the verification link.');
          }
          return;
        }

        await saveRecruiterProfile({
          company: values.company,
          title: values.title,
          workEmail: values.work_email,
          linkedinUrl: values.linkedin_url || undefined,
        });

        setHTML(feedback, '<div class="success-note">Hiring team profile saved successfully. Corporate domain verification is active.</div>');
      } catch (err) {
        toast(err?.message || 'Could not save recruiter profile.');
      }
      return;
    }

    // 2. Job seeker / candidate form
    if (event.target.id !== 'candidate-form') return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!isSupabaseConfigured) return;

    const form = event.target;
    const values = Object.fromEntries(
      [...new FormData(form)].filter(([key]) => !['resume', 'exit_letter', 'salary_slip'].includes(key)),
    );
    const feedback = $('#profile-feedback');

    try {
      const user = await getCurrentUser();
      if (!user) {
        try {
          await signInWithEmail(values.email);
          setHTML(
            feedback,
            '<div class="success-note">Check your email for a secure sign-in link. Your profile can be saved after you return.</div>',
          );
        } catch (authError) {
          toast(authError?.message || 'Could not send the sign-in link.');
        }
        return;
      }

      // Save profile with sensible defaults for removed fields
      const profile = await saveCandidateProfile({
        headline: values.role_title || 'Software Professional',
        primaryRole: values.role_title,
        location: values.location,
        yearsExperience: Number(values.years) || 0,
        summary: values.about || '',
        skills: [],
        discipline: values.discipline,
        openToRemote: values.remote === 'on',
        availableFrom: values.available_from || undefined,
        preferredLocations: values.preferred_locations
          ? values.preferred_locations.split(',').map((s) => s.trim())
          : undefined,
        industry: undefined,
        contactVisibility: 'request_access',
        resumeVisibility: 'request_access',
      });

      // Save private contacts
      await updatePrivateContacts({
        personal_email: values.email,
        phone_number: values.phone || null,
        company_email: values.workemail || null,
      });

      // Save employment
      if (values.company && values.role_title) {
        const employment = await saveEmployment({
          candidateId: profile.id,
          company: values.company,
          roleTitle: values.role_title,
          orgName: values.org_name || undefined,
          teamName: values.team_name || undefined,
          startedOn: values.started_on || undefined,
          endedOn: values.ended_on || undefined,
          isLatest: true,
          shortDescription: undefined,
        });

        // Save manager details (private)
        if (values.manager || values.manager_linkedin) {
          await saveEmploymentPrivateDetails({
            employmentId: employment.id,
            managerName: values.manager,
            managerLinkedinUrl: values.manager_linkedin,
          });
        }

        // Save layoff record
        if (values.layoff_date || values.layoff_category !== 'undisclosed') {
          await saveLayoffRecord({
            candidateId: profile.id,
            employmentId: employment.id,
            layoffDate: values.layoff_date || undefined,
            lastWorkingDate: values.last_working_date || undefined,
            layoffCategory: values.layoff_category,
            publicStatsConsent: true,
          });
        }
      }

      // Upload documents
      const resumeFile = form.elements.resume?.files[0];
      if (resumeFile) await uploadDocument(profile.id, resumeFile, 'resume');
      const exitFile = form.elements.exit_letter?.files[0];
      if (exitFile) await uploadDocument(profile.id, exitFile, 'exit_letter');
      const salaryFile = form.elements.salary_slip?.files[0];
      if (salaryFile) await uploadDocument(profile.id, salaryFile, 'salary_slip');

      // Record consent
      await recordConsent('privacy_policy', '1.0');

      setHTML(feedback, '<div class="success-note">Your profile has been saved successfully.</div>');
    } catch (error) {
      toast(error?.message || 'Could not save your profile.');
    }
  },
  true,
);

bootstrap();

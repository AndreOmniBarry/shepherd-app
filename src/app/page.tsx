'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PLANS } from '@/lib/plans';
import SplashIntro from '@/components/SplashIntro';
import { rolePortal } from '@/lib/role-portal';

const C = {
  purple: '#534AB7', purpleDark: '#3C3489', purpleDarker: '#241F52', purpleLight: '#7B74CC',
  purpleBg: '#EEEDFE', purpleFaint: '#F7F6FF',
  teal: '#1D9E75', tealBg: '#E1F5EE',
  coral: '#D85A30', coralBg: '#FAECE7',
  amber: '#BA7517', amberBg: '#FAEEDA',
  text: '#0F0A2E', sub: '#4A4272', muted: '#9890C4',
  border: 'rgba(83,74,183,0.12)', white: '#FFFFFF', bg: '#F4F3FB',
};

const STRUCTURES = [
  { icon: 'ti-building-church', label: 'Cell Church', sub: 'Fellowships → Cells', accent: 'purple' },
  { icon: 'ti-map-2', label: 'Zonal', sub: 'Zones → Districts → Cells', accent: 'teal' },
  { icon: 'ti-buildings', label: 'Multi-Campus', sub: 'Campus → Fellowship → Cell', accent: 'amber' },
  { icon: 'ti-building-bank', label: 'Department', sub: 'Departments → Units', accent: 'coral' },
  { icon: 'ti-home', label: 'House Network', sub: 'Network → Home Groups', accent: 'purple' },
  { icon: 'ti-user', label: 'Single Congregation', sub: 'One pastor, no sub-structure', accent: 'teal' },
] as const;

const FEATURES = [
  { icon: 'ti-users', title: 'Cell & Fellowship Structure', body: 'Members roll up through cells, fellowships, and branches — attendance, growth, and follow-up tracked at every level, scoped so no branch sees another\'s data.', accent: 'purple' },
  { icon: 'ti-calendar-check', title: 'Attendance & Absence Follow-Up', body: 'Every service and cell meeting logged, with automatic absence alerts and a real follow-up pipeline — bereavement, family emergency, or simply informed in advance.', accent: 'teal' },
  { icon: 'ti-coin', title: 'Giving & Accounts', body: 'Income, expenses, and approval workflows in one ledger, with financial periods and a live net balance — built for boards that ask for receipts.', accent: 'amber' },
  { icon: 'ti-heart-handshake', title: 'Partnership Portal', body: 'Track covenant partners by giving band, monthly targets, and consistency — with collection-rate charts your partnership office actually reads.', accent: 'coral' },
  { icon: 'ti-heart', title: 'Care & Follow-Up Pipeline', body: 'First-timers and altar-call leads move through a real pipeline — contacted, converted, closed — instead of a notebook that gets lost.', accent: 'purple' },
  { icon: 'ti-checkbox', title: 'Workforce & Serving', body: 'Department rosters, serving schedules, and self-service confirm/decline for every volunteer — no more phone-tree reminders.', accent: 'teal' },
  { icon: 'ti-zap', title: 'Moshe, Your AI Agent', body: 'Ask your church\'s own data a question in plain language — attendance trends, giving patterns, who\'s drifting — and get a real answer, not a spreadsheet.', accent: 'amber' },
  { icon: 'ti-speakerphone', title: 'Chat, Feed & Events', body: 'Internal messaging, a church-wide feed, a shared calendar, and public event registration pages — the parts of church life that aren\'t attendance.', accent: 'coral' },
];

const STEPS = [
  { n: '01', title: 'Describe your church', body: 'A guided setup walks through your structure, branches, ministries, and giving types — SHEPHERD builds the right portals for how your church actually runs.' },
  { n: '02', title: 'Build your team', body: 'Invite fellowship heads, cell leaders, accounts, partnership, care team — every role gets their own portal and a signup link.' },
  { n: '03', title: 'Go live in minutes', body: 'Start your 30-day trial immediately — no card required. Core features are ready from day one.' },
];

function MockDashboard() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 3), 2400); return () => clearInterval(id); }, []);
  const nav = ['Dashboard', 'Members', 'Fellowships', 'Cells', 'Attendance', 'Giving', 'Reports'];
  return (
    <div style={{ background: C.white, borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px rgba(36,31,82,0.35)', border: `0.5px solid ${C.border}`, width: '100%', maxWidth: 620 }}>
      <div style={{ background: C.purpleDarker, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {['#FF5F57', '#FFBD2E', '#28C840'].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontFamily: 'monospace' }}>app.shepherd.church</div>
      </div>
      <div style={{ display: 'flex', minHeight: 340 }}>
        <div style={{ width: 150, background: C.purpleDarker, padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          {nav.map((item, i) => (
            <div key={i} style={{ padding: '8px 14px', margin: '0 8px', borderRadius: 7, background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: i === 0 ? C.purpleLight : 'rgba(255,255,255,0.15)' }} />
              <div style={{ fontSize: 11, color: i === 0 ? C.white : 'rgba(255,255,255,0.45)', fontWeight: i === 0 ? 600 : 400 }}>{item}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 18, background: C.bg }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>Dashboard · Grace Chapel</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { l: 'This Sunday', v: tick === 0 ? '812' : tick === 1 ? '824' : '798', sub: 'attendance' },
              { l: 'Cells reporting', v: '46 / 48', sub: '96%' },
              { l: 'Giving (MTD)', v: '₦4.2M', sub: '+8% vs last mo.' },
              { l: 'Follow-up queue', v: '7', sub: '2 urgent' },
            ].map((k, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 9, padding: '10px 12px', border: `0.5px solid ${C.border}` }}>
                <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3 }}>{k.l}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{k.v}</div>
                <div style={{ fontSize: 9, color: C.teal, marginTop: 1 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: C.white, borderRadius: 9, padding: 12, border: `0.5px solid ${C.border}` }}>
            <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 8 }}>Attendance — last 6 weeks</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
              {[62, 71, 68, 80, 74, 88].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 5 ? C.purple : C.purpleBg, borderRadius: 3, transition: 'height 0.6s ease' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccentColor(accent: string) {
  return accent === 'purple' ? { c: C.purple, bg: C.purpleBg }
    : accent === 'teal' ? { c: C.teal, bg: C.tealBg }
    : accent === 'amber' ? { c: C.amber, bg: C.amberBg }
    : { c: C.coral, bg: C.coralBg };
}

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Logged-in users can still land here by typing the root URL — the nav
  // should send them back into the app instead of pitching them a trial
  // they're already past.
  const [portal, setPortal] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()).then(({ data }) => {
      if (data?.role) setPortal(rolePortal(data.role));
    }).catch(() => {});
  }, []);

  function scrollTo(id: string) {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div style={{ fontFamily: 'var(--font-inter, -apple-system, Inter, sans-serif)', background: C.bg, color: C.text, overflowX: 'hidden' }}>
      <SplashIntro />

      {/* Nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: scrolled ? 'rgba(244,243,251,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(10px)' : 'none', borderBottom: scrolled ? `0.5px solid ${C.border}` : '0.5px solid transparent', transition: 'all 0.2s ease' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
            <div style={{ width: 30, height: 30, background: C.purple, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', width: 4, height: 16, background: C.white, borderRadius: 2 }} />
              <div style={{ position: 'absolute', width: 16, height: 4, background: C.white, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.2px' }}>SHEP.HERD</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="shep-landing-nav-links">
            <button onClick={() => scrollTo('features')} style={navLinkStyle}>Features</button>
            <button onClick={() => scrollTo('pricing')} style={navLinkStyle}>Pricing</button>
            <button onClick={() => router.push('/docs')} style={navLinkStyle}>Docs</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="shep-landing-nav-cta">
            {portal ? (
              <button onClick={() => router.push(portal)} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Go to Dashboard →</button>
            ) : (
              <>
                <button onClick={() => router.push('/login')} style={{ background: 'transparent', border: 'none', color: C.sub, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: '9px 6px' }}>Log in</button>
                <button onClick={() => router.push('/setup')} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Start free trial</button>
              </>
            )}
          </div>

          <button onClick={() => setMobileMenuOpen(v => !v)} className="shep-landing-burger" style={{ display: 'none', background: 'transparent', border: 'none', fontSize: 22, color: C.text, cursor: 'pointer' }}>☰</button>
        </div>
        {mobileMenuOpen && (
          <div style={{ padding: '4px 24px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => scrollTo('features')} style={{ ...navLinkStyle, textAlign: 'left', padding: '10px 0' }}>Features</button>
            <button onClick={() => scrollTo('pricing')} style={{ ...navLinkStyle, textAlign: 'left', padding: '10px 0' }}>Pricing</button>
            <button onClick={() => router.push('/docs')} style={{ ...navLinkStyle, textAlign: 'left', padding: '10px 0' }}>Docs</button>
            {portal ? (
              <button onClick={() => router.push(portal)} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>Go to Dashboard →</button>
            ) : (
              <>
                <button onClick={() => router.push('/login')} style={{ ...navLinkStyle, textAlign: 'left', padding: '10px 0' }}>Log in</button>
                <button onClick={() => router.push('/setup')} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>Start free trial</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '64px 24px 40px', display: 'flex', gap: 48, alignItems: 'center' }} className="shep-landing-hero">
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: C.purple, background: C.purpleBg, borderRadius: 20, padding: '5px 14px', marginBottom: 20 }}>
            Built for cell churches, zonal denominations & multi-campus ministries
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-1.3px', lineHeight: 1.08, marginBottom: 20 }}>
            Run your church like the ministry it's becoming.
          </h1>
          <p style={{ fontSize: 16.5, color: C.sub, lineHeight: 1.65, marginBottom: 30, maxWidth: 480 }}>
            Attendance, follow-up, giving, workforce, partnership, and an AI agent that actually knows your data — one platform, scoped to your structure, from a single congregation to a multi-branch denomination.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <button onClick={() => router.push('/setup')} style={{ background: C.purple, color: C.white, border: 'none', borderRadius: 11, padding: '14px 26px', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(83,74,183,0.3)' }}>
              Start your 30-day free trial →
            </button>
            <button onClick={() => router.push('/docs')} style={{ background: C.white, color: C.text, border: `1px solid ${C.border}`, borderRadius: 11, padding: '14px 26px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              See it in action
            </button>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted }}>No credit card required · Core features free for 30 days</div>
        </div>
        <div style={{ flex: 1, minWidth: 320, display: 'flex', justifyContent: 'center' }} className="shep-landing-hero-mock">
          <MockDashboard />
        </div>
      </div>

      {/* Structures */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '20px 24px 60px' }}>
        <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 20 }}>
          One platform, however your church is organised
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {STRUCTURES.map((s, i) => {
            const a = AccentColor(s.accent);
            return (
              <div key={i} style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: a.bg, color: a.c, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                  <IconGlyph name={s.icon} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 10.5, color: C.muted }}>{s.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features */}
      <div id="features" style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 24px 70px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Everything, in one place</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.6px' }}>Built from how churches actually run</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => {
            const a = AccentColor(f.accent);
            return (
              <div key={i} style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: a.c }}>
                  <IconGlyph name={f.icon} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 7 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{f.body}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: C.purpleDarker, padding: '70px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.purpleLight, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Getting started</div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: C.white, letterSpacing: '-0.6px' }}>Live in minutes, not months</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {STEPS.map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.purpleLight, marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.white, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" style={{ maxWidth: 1160, margin: '0 auto', padding: '70px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Simple pricing</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.6px', marginBottom: 12 }}>Every plan starts with a 30-day trial</h2>
          <div style={{ fontSize: 14, color: C.sub, maxWidth: 520, margin: '0 auto' }}>No card required. Attendance, members, cells, and giving are free to try — Moshe AI, the partnership portal, and SMS/WhatsApp alerts unlock the moment you go active.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {PLANS.map(plan => {
            const a = AccentColor(plan.accent);
            const featured = plan.badge !== '';
            return (
              <div key={plan.id} className="shep-pricing-card" style={{ background: C.white, border: featured ? `1.5px solid ${a.c}` : `0.5px solid ${C.border}`, borderRadius: 16, padding: 28, position: 'relative', boxShadow: featured ? '0 16px 40px rgba(83,74,183,0.14)' : 'none' }}>
                {plan.badge && <div style={{ position: 'absolute', top: -12, left: 28, background: a.c, color: C.white, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 12px' }}>{plan.badge}</div>}
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16 }}>{plan.description}</div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: a.c }}>{plan.price}</span>
                  {plan.period && <span style={{ fontSize: 13, color: C.muted }}>{plan.period}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                      <span style={{ color: a.c, fontWeight: 700 }}>✓</span>
                      <span style={{ color: C.sub }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push('/setup')} style={{ width: '100%', background: featured ? a.c : C.purpleFaint, color: featured ? C.white : C.purple, border: 'none', borderRadius: 10, padding: '12px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  Start free trial
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ maxWidth: 1160, margin: '0 auto 70px', padding: '0 24px' }}>
        <div style={{ background: `linear-gradient(120deg, ${C.purple}, ${C.purpleDark})`, borderRadius: 24, padding: '56px 40px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: C.white, letterSpacing: '-0.5px', marginBottom: 14 }}>Ready to see your whole church in one view?</h2>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', marginBottom: 26 }}>Set up takes minutes. Your first 30 days are free.</p>
          <button onClick={() => router.push('/setup')} style={{ background: C.white, color: C.purple, border: 'none', borderRadius: 11, padding: '14px 30px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Start your free trial →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `0.5px solid ${C.border}`, padding: '28px 24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: C.muted }}>© {new Date().getFullYear()} SHEP.HERD</div>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href="mailto:support@justshephrd.com" style={{ ...navLinkStyle, fontSize: 12.5, textDecoration: 'none' }}>Support</a>
            <button onClick={() => router.push('/docs')} style={{ ...navLinkStyle, fontSize: 12.5 }}>Docs</button>
            <button onClick={() => router.push('/login')} style={{ ...navLinkStyle, fontSize: 12.5 }}>Log in</button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .shep-landing-nav-links, .shep-landing-nav-cta { display: none !important; }
          .shep-landing-burger { display: block !important; }
          .shep-landing-hero { flex-direction: column; }
          .shep-landing-hero h1 { font-size: 34px !important; }
          .shep-landing-hero-mock { width: 100%; }
        }
        .shep-pricing-card {
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease;
        }
        .shep-pricing-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 44px rgba(83,74,183,0.18);
        }
      `}</style>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: C.sub, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: '9px 4px' };

const ICON_PATHS: Record<string, React.ReactNode> = {
  'ti-users': <><circle cx="9" cy="7" r="3" /><path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M21 21c0-2.8-1.8-5-4-5.5" /></>,
  'ti-calendar-check': <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="m9 16 2 2 4-4" /></>,
  'ti-coin': <><circle cx="12" cy="12" r="9" /><path d="M14.8 9a2 2 0 0 0-1.9-1.4h-1.8a2 2 0 0 0 0 4h1.8a2 2 0 0 1 0 4h-1.8a2 2 0 0 1-1.9-1.4" /><line x1="12" y1="6" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="18" /></>,
  'ti-heart-handshake': <><path d="M12 6.5a3.5 3.5 0 0 0-6-2.4C4.7 5 4.3 6.7 5 8l1 1.5" /><path d="M2 13l3-3 3 2h4l4-3 3 2-5 5h-3l-2-1.5" /><path d="M14 8.5A3.5 3.5 0 0 1 19 6c1.3.6 1.7 2.3 1 3.6L19 11" /></>,
  'ti-heart': <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></>,
  'ti-checkbox': <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 12l2 2 4-4" /></>,
  'ti-zap': <><polygon points="13,2 3,14 11,14 11,22 21,10 13,10" /></>,
  'ti-speakerphone': <><path d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M14 8a4 4 0 0 1 0 8M17 5a8 8 0 0 1 0 14" /></>,
  'ti-building-church': <><path d="M12 2v4" /><path d="M10 4h4" /><path d="M4 21V10l8-5 8 5v11" /><path d="M9 21v-6h6v6" /></>,
  'ti-map-2': <><path d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6z" /><line x1="9" y1="4" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="20" /></>,
  'ti-buildings': <><rect x="3" y="10" width="6" height="11" /><rect x="10" y="6" width="6" height="15" /><rect x="17" y="13" width="4" height="8" /></>,
  'ti-building-bank': <><path d="M12 3l9 7H3l9-7z" /><path d="M4 10h16" /><path d="M4 21h16" /><path d="M6 10v11" /><path d="M10 10v11" /><path d="M14 10v11" /><path d="M18 10v11" /></>,
  'ti-home': <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-6h4v6" /></>,
  'ti-user': <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" /></>,
};

function IconGlyph({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

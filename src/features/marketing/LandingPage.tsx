import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BlurFade } from "../../components/magicui/blur-fade";
import { MagicCard } from "../../components/magicui/magic-card";
import { ScrollProgress } from "../../components/magicui/scroll-progress";
import { AppLink, ArrowIcon, Logo, ShieldIcon } from "../../components/core";
import { useAuth } from "../../app/auth-context";

export function LandingPage() {
  const auth = useAuth();
  useEffect(() => {
    document.title = "MassLaidOff - Experience deserves another opportunity";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.from(".hero-copy > *", {
        opacity: 0,
        y: 22,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
      });
      gsap.from(".hero-stage", {
        opacity: 0,
        y: 28,
        scale: 0.985,
        duration: 0.9,
        delay: 0.15,
        ease: "power3.out",
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) =>
        gsap.from(element, {
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
          opacity: 0,
          y: 24,
          duration: 0.65,
        }),
      );
    });
    return () => context.revert();
  }, []);

  return (
    <div className="landing-page">
      <ScrollProgress
        className="masslaidoff-scroll-progress"
        aria-hidden="true"
      />
      <div className="announcement">
        Built for professionals affected by layoffs - and the teams ready to
        hire them.
      </div>
      <header className="landing-nav">
        <Logo />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <AppLink to="/manager-reviews">Manager reviews</AppLink>
          <AppLink to="/data">Public data</AppLink>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="nav-actions">
          {auth.authenticated ? (
            <AppLink to="/app" className="button button-small">
              Open workspace
            </AppLink>
          ) : (
            <>
              <AppLink to="/login/hiring" className="nav-text-link">
                For hiring teams
              </AppLink>
              <AppLink to="/login/job-seeker" className="button button-small">
                Log in
              </AppLink>
            </>
          )}
        </div>
      </header>
      <main>
        <section className="hero-section">
          <BlurFade className="hero-copy" duration={0.45} offset={8} blur="3px">
            <p className="eyebrow">Backed By Ketan Raj</p>
            <h1>
              Your role ended.
              <br />
              Your impact <em>didn’t.</em>
            </h1>
            <p className="hero-lede">
              Build a trusted record of your work and become discoverable to
              verified hiring teams - without giving up control of your private
              information.
            </p>
            <div className="hero-actions">
              <AppLink to="/login/job-seeker?mode=signup" className="button button-primary">
                Create your profile <ArrowIcon />
              </AppLink>
              <AppLink to="/login/hiring?mode=signup" className="button button-secondary">
                I’m hiring - show me talent <ArrowIcon />
              </AppLink>
            </div>
            <div className="privacy-note">
              <span>✓</span> You decide who can see your contact details and
              résumé.
            </div>
          </BlurFade>
          <div
            className="hero-stage"
            aria-label="A preview of a candidate profile on MassLaidOff"
          >
            <div className="stage-orbit orbit-large" />
            <div className="stage-orbit orbit-small" />
            <div className="floating-person float-one">
              <span>MK</span>
              <div>
                <strong>Staff engineer</strong>
                <small>Infrastructure · 11 years</small>
              </div>
            </div>
            <MagicCard
              className="hero-profile"
              gradientColor="#b8cafa"
              gradientOpacity={0.08}
              gradientSize={220}
            >
              <div className="profile-top">
                <span className="profile-avatar">AS</span>
                <span className="availability">
                  <i /> Available now
                </span>
              </div>
              <p className="profile-label">VERIFIED EMPLOYMENT</p>
              <h2>Ketan Raj</h2>
              <p className="profile-role">Software Engineer · Bengaluru</p>
              <blockquote>
                “I turn complex systems into products people understand.”
              </blockquote>
              <div className="tag-list">
                <span>Design systems</span>
                <span>Research</span>
                <span>0→1 products</span>
              </div>
              <div className="profile-footer">
                <span>2 years’ experience</span>
                <strong>Recruiter view</strong>
              </div>
            </MagicCard>
            <div className="floating-person float-two">
              <span>RV</span>
              <div>
                <strong>Product leader</strong>
                <small>B2B SaaS · 7 years</small>
              </div>
            </div>
          </div>
        </section>
        <section className="discipline-strip">
          <div className="discipline-list">
            {["Engineering", "Product", "Design", "Data", "Security"].map(
              (item) => (
                <span key={item}>{item}</span>
              ),
            )}
          </div>
        </section>
        <section className="belief-section" data-reveal>
          <p className="section-kicker">
            A CHANGE OF PLANS.
            <br />
            NOT A CHANGE OF POTENTIAL.
          </p>
          <h2>
            Layoffs remove roles.
            <br />
            <span>They don’t remove talent.</span>
          </h2>
          <AppLink to="/login/hiring" className="underlined-link">
            Meet the network <ArrowIcon />
          </AppLink>
        </section>
        <section className="content-section" id="how-it-works">
          <div className="section-heading" data-reveal>
            <div>
              <p className="section-kicker">HOW MASSLAIDOFF WORKS</p>
              <h2>
                A direct path to the
                <br />
                right conversation.
              </h2>
            </div>
            <p>
              MassLaidOff records real experience, protects sensitive evidence,
              and helps verified recruiters find people ready for their next
              role.
            </p>
          </div>
          <div className="step-grid">
            {[
              [
                "01",
                "Build your record",
                "Add your experience, layoff details, résumé, and availability.",
              ],
              [
                "02",
                "Control your visibility",
                "Choose how verified recruiters can contact you.",
              ],
              [
                "03",
                "Get discovered",
                "Hiring teams search verified professional records.",
              ],
            ].map(([number, title, text]) => (
              <article key={number} data-reveal>
                <span className="step-number">{number}</span>
                <div className="step-symbol">
                  {number === "01" ? "+" : number === "02" ? "◉" : "↗"}
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="reviews-feature" data-reveal>
          <div className="reviews-copy">
            <p className="section-kicker light">MANAGER REVIEWS</p>
            <h2>Better teams start with better context.</h2>
            <p>
              First-hand manager reviews remain available only to members with a
              verified company email.
            </p>
            <ul>
              <li>
                <span>01</span> Structured leadership ratings
              </li>
              <li>
                <span>02</span> Manager LinkedIn stays private
              </li>
              <li>
                <span>03</span> Authors never appear publicly
              </li>
            </ul>
            <AppLink to="/manager-reviews" className="button button-light">
              Read manager reviews <ArrowIcon />
            </AppLink>
          </div>
          <div className="review-preview">
            <p className="review-company">VERIFIED MEMBER ACCESS</p>
            <div className="review-score">
              <strong>
                <ShieldIcon />
              </strong>
              <span>
                COMPANY EMAIL
                <br />
                REQUIRED
              </span>
            </div>
            <blockquote>
              “Review content unlocks only after server-side verification.”
            </blockquote>
            <p className="review-anonymous">
              <ShieldIcon /> Anonymous author. Verified access.
            </p>
          </div>
        </section>
        <section className="privacy-section" id="privacy" data-reveal>
          <div>
            <p className="section-kicker light">PRIVACY IS PRODUCT BEHAVIOR</p>
            <h2>
              Your work is visible.
              <br />
              Your private details are yours.
            </h2>
            <p>
              Company email verifies employment without becoming public. Salary
              slips, exit letters, and manager LinkedIn remain private.
            </p>
            <AppLink to="/login/job-seeker?mode=signup" className="button button-light">
              Create a protected profile <ArrowIcon />
            </AppLink>
          </div>
          <div className="privacy-panel">
            <div className="privacy-panel-head">
              <strong>Recruiter visibility</strong>
              <span>Private by default</span>
            </div>
            {[
              ["Work history", true],
              ["Availability", true],
              ["Contact details", false],
              ["Résumé download", false],
              ["Employment evidence", false],
            ].map(([label, active]) => (
              <div className="privacy-row" key={String(label)}>
                <span>{String(label)}</span>
                <span className={`switch ${active ? "active" : ""}`}>
                  <i />
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="closing-section" data-reveal>
          <p className="eyebrow">
            ONE GOOD CONVERSATION CAN START THE NEXT CHAPTER.
          </p>
          <h2>Choose how you’re here.</h2>
          <div className="hero-actions centered">
            <AppLink to="/login/job-seeker?mode=signup" className="button button-primary">
              I was laid off <ArrowIcon />
            </AppLink>
            <AppLink to="/login/hiring?mode=signup" className="button button-secondary">
              I’m hiring - show me talent <ArrowIcon />
            </AppLink>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>A private talent record for people moving forward.</p>
        <nav>
          <AppLink to="/manager-reviews">Manager reviews</AppLink>
          <AppLink to="/data">Public data</AppLink>
          <a href="#privacy">Privacy</a>
        </nav>
        <span>© 2026 MassLaidOff</span>
      </footer>
    </div>
  );
}

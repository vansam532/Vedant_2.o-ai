import { createClient } from "@supabase/supabase-js";
import "./style.css";

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

const app = $("#app");
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const state = {
  user: null,
  profile: null,
  page: "overview",
  theme: localStorage.getItem("vedant-theme") || "dark",
  chat: [],
  chatBusy: false,
  selectedFile: null,
  records: {},
  toastTimer: null
};

const modules = [
  ["overview", "⌂", "Overview"],
  ["assistant", "✦", "AI Assistant"],
  ["learning", "▤", "Learning Hub"],
  ["courses", "▣", "Courses"],
  ["quiz", "✓", "Quizzes & Tests"],
  ["create", "✧", "Create Studio"],
  ["crm", "♧", "CRM & Leads"],
  ["hr", "♙", "HR Management"],
  ["appointments", "◷", "Appointments"],
  ["analytics", "▥", "Analytics"],
  ["admin", "⚙", "Admin Console"]
];

const escapeHTML = (s = "") =>
  String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const initials = (s = "V") =>
  s.trim().split(/\s+/).slice(0, 2)
    .map(x => x[0]).join("").toUpperCase();

const isAdmin = () =>
  state.profile?.role === "admin" ||
  state.profile?.role === "owner";

const fmtDate = d =>
  d ? new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }) : "—";

/* INTRO VIDEO */

function playIntro() {
  const overlay = document.createElement("div");
  overlay.id = "intro-screen";

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99999",
    background: "#080b16",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  });

  const video = document.createElement("video");

  video.src = "/vedant-intro.mp4";
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.controls = false;

  Object.assign(video.style, {
    width: "100%",
    height: "100%",
    objectFit: "contain"
  });

  overlay.appendChild(video);
  document.body.appendChild(overlay);

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    overlay.remove();
    boot();
  };

  video.addEventListener("ended", finish, { once: true });
  video.addEventListener("error", finish, { once: true });

  video.play().catch(() => {
    const button = document.createElement("button");
    button.textContent = "Tap to Start VEDANT AI";

    Object.assign(button.style, {
      position: "absolute",
      padding: "16px 25px",
      borderRadius: "14px",
      background: "#7657ff",
      color: "white",
      border: "0",
      fontSize: "17px"
    });

    button.onclick = () => {
      video.play().catch(finish);
      button.remove();
    };

    overlay.appendChild(button);
  });
}

/* NOTIFICATIONS */

function toast(msg, error = false) {
  let el = $("#toast");

  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.append(el);
  }

  el.textContent = msg;
  el.className = "toast show" + (error ? " error" : "");

  clearTimeout(state.toastTimer);

  state.toastTimer = setTimeout(
    () => el.classList.remove("show"),
    3200
  );
}

function logo() {
  return `
    <span class="brand-mark">V</span>
    <span class="brand-copy">
      <b>VEDANT AI</b>
      <small>Learn · Create · Grow</small>
    </span>
  `;
}

/* AUTHENTICATION */

function showAuth() {
  app.innerHTML = `
    <main class="auth-screen">
      <section class="auth-card">

        <div class="auth-brand">${logo()}</div>

        <div class="eyebrow">YOUR AI SUPER PLATFORM</div>

        <h1>Welcome to <span>VEDANT AI</span></h1>

        <p class="muted">
          Learn, create and grow — all in one workspace.
        </p>

        <div class="auth-tabs">
          <button class="active" data-auth-tab="login">Login</button>
          <button data-auth-tab="signup">Create account</button>
        </div>

        <form id="authForm">

          <label>
            Email
            <input name="email" type="email"
              placeholder="you@example.com"
              required autocomplete="email">
          </label>

          <label>
            Password
            <input name="password" type="password"
              placeholder="At least 8 characters"
              minlength="8" required
              autocomplete="current-password">
          </label>

          <button class="primary full" type="submit" id="authSubmit">
            Login securely <span>→</span>
          </button>

        </form>

        <p class="tiny muted center">
          Your account is protected by Supabase Authentication.
        </p>

        ${!supabase ? `
          <div class="notice warn">
            Setup required: add Supabase URL and anon key
            to your environment variables.
          </div>
        ` : ""}

      </section>
    </main>
  `;

  let mode = "login";

  $$("[data-auth-tab]").forEach(b => {
    b.onclick = () => {
      mode = b.dataset.authTab;

      $$("[data-auth-tab]").forEach(x =>
        x.classList.toggle("active", x === b)
      );

      $("#authSubmit").innerHTML =
        mode === "login"
          ? 'Login securely <span>→</span>'
          : 'Create account <span>→</span>';
    };
  });

  $("#authForm").onsubmit = async e => {
    e.preventDefault();

    if (!supabase) {
      toast("पहले Supabase configuration जोड़ें।", true);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email");
    const password = fd.get("password");

    const btn = $("#authSubmit");
    btn.disabled = true;
    btn.textContent = "Please wait…";

    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({
            email,
            password
          })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: email.split("@")[0]
              }
            }
          });

      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        toast("Account created. Email verify करके login करें।");
      } else {
        await boot();
      }

    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = mode === "login"
        ? "Login securely →"
        : "Create account →";
    }
  };
}

/* MAIN WORKSPACE */

function shell() {
  const nav = modules.filter(
    m => m[0] !== "admin" || isAdmin()
  );

  app.innerHTML = `
    <div class="layout">

      <aside class="sidebar" id="sidebar">

        <a class="brand" href="#">${logo()}</a>

        <button class="new-chat" data-go="assistant">
          ＋ <span>New AI chat</span>
        </button>

        <div class="nav-caption">WORKSPACE</div>

        <nav>
          ${nav.map(([id, ic, label]) => `
            <button class="nav-link ${state.page === id ? "active" : ""}"
              data-go="${id}">
              <span class="nav-ic">${ic}</span>
              <span>${label}</span>
            </button>
          `).join("")}
        </nav>

        <div class="sidebar-foot">
          <div class="profile">
            <div class="avatar">
              ${initials(state.profile?.full_name || state.user?.email || "V")}
            </div>

            <div class="profile-copy">
              <b>${escapeHTML(state.profile?.full_name || "VEDANT User")}</b>
              <small>${escapeHTML(state.profile?.role || "student")}</small>
            </div>

            <button class="dots" id="logoutBtn" title="Logout">↪</button>
          </div>
        </div>

      </aside>

      <main class="main">

        <header class="topbar">

          <button class="icon-btn mobile-menu" id="menuBtn">☰</button>

          <div class="mobile-brand">${logo()}</div>

          <div class="crumb">
            <span>Workspace</span>
            <b>/ ${modules.find(m => m[0] === state.page)?.[2] || "Overview"}</b>
          </div>

          <div class="top-actions">
            <span class="online"><i></i> Workspace</span>
            <button class="icon-btn" id="themeBtn" title="Toggle theme">◐</button>
            <div class="avatar small">
              ${initials(state.profile?.full_name || "V")}
            </div>
          </div>

        </header>

        <section class="content" id="content">
          ${renderPage()}
        </section>

      </main>

    </div>

    <div id="toast" class="toast"></div>
  `;

  document.body.dataset.theme = state.theme;

  $$("[data-go]").forEach(b => {
    b.onclick = () => go(b.dataset.go);
  });

  $("#menuBtn").onclick = () =>
    $("#sidebar").classList.toggle("open");

  $("#themeBtn").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("vedant-theme", state.theme);
    document.body.dataset.theme = state.theme;
  };

  $("#logoutBtn").onclick = async () => {
    if (supabase) await supabase.auth.signOut();
    state.user = null;
    state.profile = null;
    state.chat = [];
    showAuth();
  };

  wirePage();
}

function go(page) {
  state.page = page;
  $("#sidebar")?.classList.remove("open");
  shell();
}

/* PAGE ROUTER */

function renderPage() {
  switch (state.page) {
    case "overview": return overview();
    case "assistant": return assistant();
    case "learning": return learning();
    case "courses": return courses();
    case "quiz": return quiz();
    case "create": return createStudio();
    case "crm": return crm();
    case "hr": return hr();
    case "appointments": return appointments();
    case "analytics": return analytics();
    case "admin": return admin();
    default: return overview();
  }
}

function pageHead(kicker, title, desc, action = "") {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">${kicker}</div>
        <h1>${title}</h1>
        <p>${desc}</p>
      </div>
      ${action}
    </div>
  `;
}

/* OVERVIEW */

function overview() {
  const greeting = new Date().getHours() < 12
    ? "morning"
    : new Date().getHours() < 17
      ? "afternoon"
      : "evening";

  const firstName = escapeHTML(
    (state.profile?.full_name || "there").split(" ")[0]
  );

  return `
    ${pageHead(
      "YOUR WORKSPACE",
      "Good " + greeting + ", " + firstName + " 👋",
      "Your learning, AI and business workspace starts here."
    )}

    <div class="hero">

      <div>
        <div class="hero-tag">✦ VEDANT AI INTELLIGENCE</div>

        <h2>
          Think bigger.<br>
          <span>Build your future.</span>
        </h2>

        <p>
          One platform for learning new skills, creating
          smarter work and growing your business.
        </p>

        <button class="primary" data-go="assistant">
          Start with AI <span>→</span>
        </button>
      </div>

      <div class="hero-orb">
        <div class="orb-v">V</div>
        <div class="orb-ring r1"></div>
        <div class="orb-ring r2"></div>
      </div>

    </div>

    <div class="section-title">
      <div>
        <h2>Your tools</h2>
        <p>Jump into a workspace module</p>
      </div>
    </div>

    <div class="module-grid">

      ${modules
        .filter(m => m[0] !== "admin" || isAdmin())
        .filter(m => m[0] !== "overview")
        .map(([id, ic, label], i) => `
          <button class="module-card c${i % 5}" data-go="${id}">
            <span class="module-icon">${ic}</span>
            <b>${label}</b>
            <small>${moduleDesc(id)}</small>
            <span class="card-arrow">↗</span>
          </button>
        `).join("")}

    </div>

    <div class="bottom-grid">

      <div class="panel">
        <div class="panel-head">
          <h3>Quick start</h3>
          <span class="muted">Suggested actions</span>
        </div>

        <div class="quick-list">

          <button data-go="assistant">
            <span>✦</span>
            <div>
              <b>Ask VEDANT AI</b>
              <small>Get help with any question</small>
            </div>
            <i>→</i>
          </button>

          <button data-go="courses">
            <span>▣</span>
            <div>
              <b>Explore courses</b>
              <small>Continue your learning journey</small>
            </div>
            <i>→</i>
          </button>

          <button data-go="crm">
            <span>♧</span>
            <div>
              <b>Manage leads</b>
              <small>Keep business relationships organized</small>
            </div>
            <i>→</i>
          </button>

        </div>
      </div>

      <div class="panel">

        <div class="panel-head">
          <h3>Platform status</h3>
          <span class="status-pill">Connected UI</span>
        </div>

        <p class="muted small-text">
          Your workspace is ready. Connect Supabase and
          configure your server-side AI service.
        </p>

        <div class="status-row">
          <span>Authentication</span>
          <b>${supabase ? "Supabase configured" : "Setup needed"}</b>
        </div>

        <div class="status-row">
          <span>AI service</span>
          <b>Server API</b>
        </div>

        <div class="status-row">
          <span>Database</span>
          <b>Supabase</b>
        </div>

      </div>

    </div>
  `;
}

function moduleDesc(id) {
  return ({
    assistant: "Chat, ask and analyze",
    learning: "Your learning dashboard",
    courses: "Lessons and course library",
    quiz: "Practice and assessments",
    create: "Writing and creative tools",
    crm: "Customers and sales pipeline",
    hr: "Team and employee records",
    appointments: "Bookings and schedules",
    analytics: "Workspace insights",
    admin: "Platform configuration"
  })[id] || "Open workspace";
}

/* AI ASSISTANT */

function assistant() {
  return `
    ${pageHead(
      "VEDANT INTELLIGENCE",
      "AI Assistant",
      "Ask questions, understand files and get practical help.",
      "<span class='status-pill'><i></i> VEDANT AI</span>"
    )}

    <div class="ai-layout">

      <div class="chat-panel panel">

        <div class="chat-top">
          <div class="ai-avatar">V</div>

          <div>
            <b>VEDANT AI</b>
            <small>Learn · Create · Grow</small>
          </div>

          <button class="text-btn" id="clearChat">
            New conversation
          </button>
        </div>

        <div id="chatMessages" class="chat-messages">

          ${state.chat.length
            ? state.chat.map(m => chatBubble(m.text, m.role)).join("")
            : `
              <div class="chat-welcome">
                <div class="welcome-spark">✦</div>
                <h2>How can I help you today?</h2>

                <p>
                  मैं आपकी पढ़ाई, skills, ideas और business
                  में मदद कर सकता हूँ।
                </p>

                <div class="prompt-grid">
                  <button data-prompt="Explain a difficult topic in simple Hindi.">📚 Explain a topic</button>
                  <button data-prompt="Create a 30-day skill learning plan for me.">🎯 Build a skill plan</button>
                  <button data-prompt="Help me develop a business idea into a plan.">💡 Business planning</button>
                  <button data-prompt="Write a professional email for me.">✍️ Write content</button>
                </div>
              </div>
            `
          }

        </div>

        <form id="aiForm" class="ai-composer">

          <div class="file-chip" id="fileChip"></div>

          <textarea id="aiInput" rows="1"
            placeholder="Message VEDANT AI…"></textarea>

          <div class="composer-tools">

            <label class="attach-btn" title="Attach PDF or image">
              ＋
              <input id="aiFile" type="file"
                accept="image/*,.pdf" hidden>
            </label>

            <span>PDF / image · Enter to send</span>

            <button class="send-btn" id="aiSend" type="submit">
              ↑
            </button>

          </div>

        </form>

        <p class="tiny muted center">
          AI can make mistakes. Verify important information.
        </p>

      </div>

      <aside class="ai-side">

        <div class="panel">
          <h3>What can I do?</h3>

          <div class="capability">
            <span>✦</span>
            <div>
              <b>Understand</b>
              <small>Ask questions and explore ideas</small>
            </div>
          </div>

          <div class="capability">
            <span>▤</span>
            <div>
              <b>Analyze files</b>
              <small>Ask about supported PDFs and images</small>
            </div>
          </div>

          <div class="capability">
            <span>✧</span>
            <div>
              <b>Create</b>
              <small>Draft, plan, summarize and brainstorm</small>
            </div>
          </div>

          <div class="capability">
            <span>◉</span>
            <div>
              <b>Multilingual</b>
              <small>Hindi and English conversations</small>
            </div>
          </div>

        </div>

        <div class="panel">
          <h3>Privacy reminder</h3>
          <p class="muted small-text">
            Do not upload passwords, financial credentials
            or sensitive personal documents. Uploaded content
            is sent to the configured AI provider for processing.
          </p>
        </div>

      </aside>

    </div>
  `;
}

function chatBubble(text, role) {
  return `
    <div class="message ${role === "user" ? "user" : ""}">
      ${role === "model"
        ? '<div class="ai-avatar mini-v">V</div>'
        : ""
      }
      <div class="message-bubble">
        ${escapeHTML(text).replace(/\n/g, "<br>")}
      </div>
    </div>
  `;
}

/* LEARNING */

function learning() {
  return `
    ${pageHead(
      "LEARNING HUB",
      "Learn something new",
      "Organize your learning journey and track progress."
    )}

    <div class="stats-grid">

      <div class="stat-card">
        <small>Enrolled courses</small>
        <b id="courseCount">—</b>
        <span>Available in your account</span>
      </div>

      <div class="stat-card">
        <small>Completed lessons</small>
        <b>—</b>
        <span>Progress tracking setup</span>
      </div>

      <div class="stat-card">
        <small>Quiz performance</small>
        <b>—</b>
        <span>Attempts will appear here</span>
      </div>

    </div>

    <div class="panel empty-panel">
      <div class="empty-icon">▤</div>
      <h2>Your learning space</h2>

      <p>
        Create courses from the Courses module.
        Enrollments and progress are stored in your
        Supabase database.
      </p>

      <button class="primary" data-go="courses">
        Browse courses →
      </button>
    </div>
  `;
}

/* COURSES */

function courses() {
  return `
    ${pageHead(
      "LEARNING MANAGEMENT",
      "Courses",
      "Create, publish and manage learning content.",
      isAdmin()
        ? '<button class="primary" id="addCourseBtn">＋ Add course</button>'
        : ""
    )}

    <div class="panel">
      <div class="panel-head">
        <h3>Course library</h3>
        <span class="muted">Cloud database</span>
      </div>

      <div id="courseList" class="data-list">
        <div class="loading">Loading courses…</div>
      </div>
    </div>
  `;
}

/* QUIZZES */

function quiz() {
  return `
    ${pageHead(
      "ASSESSMENT CENTER",
      "Quizzes & Tests",
      "Practice questions and create assessments."
    )}

    <div class="module-grid two">

      <div class="panel feature-panel">
        <div class="module-icon">✓</div>
        <h3>Take a quiz</h3>
        <p class="muted">
          Attempt available quizzes and review your results.
        </p>
        <button class="primary" id="loadQuizzes">
          View quizzes
        </button>
      </div>

      <div class="panel feature-panel">
        <div class="module-icon">＋</div>
        <h3>Create a quiz</h3>
        <p class="muted">
          Build a question set for your learners.
        </p>
        <button class="secondary" id="createQuiz">
          Create quiz
        </button>
      </div>

    </div>

    <div class="panel">
      <h3>Quiz library</h3>
      <div id="quizList" class="data-list muted">
        Select View quizzes to load available tests.
      </div>
    </div>
  `;
}

/* CREATE STUDIO */

function createStudio() {
  return `
    ${pageHead(
      "CREATIVE WORKSPACE",
      "Create Studio",
      "Turn your ideas into useful content."
    )}

    <div class="create-grid">

      <button class="create-tile"
        data-create="Write a professional email about: ">
        <span>✉</span>
        <b>Email writer</b>
        <small>Professional messages</small>
      </button>

      <button class="create-tile"
        data-create="Create a detailed content plan for: ">
        <span>▤</span>
        <b>Content planner</b>
        <small>Posts and calendars</small>
      </button>

      <button class="create-tile"
        data-create="Create a step-by-step project plan for: ">
        <span>◈</span>
        <b>Project planner</b>
        <small>Tasks and milestones</small>
      </button>

      <button class="create-tile"
        data-create="Brainstorm 10 creative ideas for: ">
        <span>✧</span>
        <b>Idea generator</b>
        <small>Explore possibilities</small>
      </button>

    </div>

    <div class="panel">
      <h3>What would you like to create?</h3>

      <textarea class="large-input" id="createPrompt"
        placeholder="Describe what you want to create…"></textarea>

      <button class="primary" id="createWithAI">
        Generate with AI →
      </button>

      <div id="createResult" class="result-area"></div>
    </div>
  `;
}

/* CRM */

function crm() {
  return `
    ${pageHead(
      "CUSTOMER RELATIONSHIP MANAGEMENT",
      "CRM & Leads",
      "Keep track of prospects, customers and follow-ups.",
      '<button class="primary" id="addLead">＋ Add lead</button>'
    )}

    <div class="stats-grid">

      <div class="stat-card">
        <small>Total leads</small>
        <b id="leadCount">—</b>
      </div>

      <div class="stat-card">
        <small>New</small>
        <b id="newLeadCount">—</b>
      </div>

      <div class="stat-card">
        <small>Converted</small>
        <b id="wonLeadCount">—</b>
      </div>

    </div>

    <div class="panel">
      <div class="panel-head">
        <h3>Lead pipeline</h3>
        <span class="muted">Private workspace data</span>
      </div>

      <div id="leadList" class="data-list">
        <div class="loading">Loading leads…</div>
      </div>
    </div>
  `;
}

/* HR */

function hr() {
  return `
    ${pageHead(
      "PEOPLE OPERATIONS",
      "HR Management",
      "Manage your team directory and employee records.",
      isAdmin()
        ? '<button class="primary" id="addEmployee">＋ Add employee</button>'
        : ""
    )}

    <div class="panel">
      <div class="panel-head">
        <h3>Team directory</h3>
        <span class="muted">Admin-managed</span>
      </div>

      <div id="employeeList" class="data-list">
        <div class="loading">Loading team…</div>
      </div>
    </div>
  `;
}

/* APPOINTMENTS */

function appointments() {
  return `
    ${pageHead(
      "SCHEDULING",
      "Appointments",
      "Manage meeting requests and bookings.",
      '<button class="primary" id="bookAppointment">＋ New appointment</button>'
    )}

    <div class="panel">
      <div class="panel-head">
        <h3>Upcoming appointments</h3>
        <span class="muted">Your schedule</span>
      </div>

      <div id="appointmentList" class="data-list">
        <div class="loading">Loading appointments…</div>
      </div>
    </div>
  `;
}

/* ANALYTICS */

function analytics() {
  return `
    ${pageHead(
      "INSIGHTS",
      "Analytics",
      "A snapshot of activity in your workspace."
    )}

    <div class="stats-grid">

      <div class="stat-card">
        <small>Courses</small>
        <b id="anCourses">—</b>
        <span>In course library</span>
      </div>

      <div class="stat-card">
        <small>Leads</small>
        <b id="anLeads">—</b>
        <span>In CRM</span>
      </div>

      <div class="stat-card">
        <small>Appointments</small>
        <b id="anAppointments">—</b>
        <span>Scheduled records</span>
      </div>

    </div>

    <div class="panel">
      <h3>Workspace activity</h3>

      <p class="muted small-text">
        Analytics are calculated from records your account
        is authorized to access. Add records in each module
        to see activity here.
      </p>

      <div class="chart-placeholder">
        <span>▥</span>
        <b>Insights will appear here</b>
        <small>Connect and populate your workspace database.</small>
      </div>
    </div>
  `;
}

/* ADMIN */

function admin() {
  return `
    ${pageHead(
      "PLATFORM CONTROL",
      "Admin Console",
      "Manage roles, workspace access and system setup."
    )}

    <div class="notice warn">
      Admin access is controlled by the Supabase profiles.role
      field and Row Level Security policies. Do not promote
      users from the browser.
    </div>

    <div class="panel">
      <h3>System configuration</h3>

      <div class="status-row">
        <span>Supabase client</span>
        <b>${supabase ? "Configured" : "Missing"}</b>
      </div>

      <div class="status-row">
        <span>AI service</span>
        <b>Server-side API</b>
      </div>

      <div class="status-row">
        <span>Role</span>
        <b>${escapeHTML(state.profile?.role || "student")}</b>
      </div>

      <p class="muted small-text">
        Set your first owner role manually using the SQL
        instructions in README. Never expose service-role
        credentials in frontend code.
      </p>
    </div>

    <div class="panel">
      <h3>Team access</h3>
      <div id="adminUsers" class="data-list">
        Loading profiles…
      </div>
    </div>
  `;
}

/* PAGE EVENTS */

function wirePage() {
  $$("[data-go]").forEach(b => {
    b.onclick = () => go(b.dataset.go);
  });

  $$("[data-prompt]").forEach(b => {
    b.onclick = () => {
      $("#aiInput").value = b.dataset.prompt;
      $("#aiInput").focus();
    };
  });

  if (state.page === "assistant") wireAssistant();
  if (state.page === "courses") loadCourses();
  if (state.page === "crm") loadLeads();
  if (state.page === "hr") loadEmployees();
  if (state.page === "appointments") loadAppointments();
  if (state.page === "analytics") loadAnalytics();
  if (state.page === "admin") loadAdmin();
  if (state.page === "quiz") wireQuiz();
  if (state.page === "create") wireCreate();

  if (state.page === "overview" || state.page === "learning") {
    loadCourseCount();
  }
}

/* AI CHAT EVENTS */

function wireAssistant() {
  $("#clearChat").onclick = () => {
    state.chat = [];
    go("assistant");
  };

  $("#aiFile").onchange = e => {
    state.selectedFile = e.target.files[0] || null;

    $("#fileChip").textContent = state.selectedFile
      ? `📎 ${state.selectedFile.name} · ${Math.round(state.selectedFile.size / 1024)} KB`
      : "";
  };

  $("#aiForm").onsubmit = async e => {
    e.preventDefault();

    const text = $("#aiInput").value.trim();

    if (!text && !state.selectedFile) return;

    await askAI(text, state.selectedFile);
  };

  $("#aiInput").onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#aiForm").requestSubmit();
    }
  };
}

/* AI REQUEST */

async function askAI(text, file) {
  if (state.chatBusy) return;

  if (file && file.size > 15 * 1024 * 1024) {
    return toast("File size 15 MB से कम रखें।", true);
  }

  const userText = text ||
    `Please analyze the attached file: ${file.name}`;

  state.chat.push({
    role: "user",
    text: userText
  });

  state.chatBusy = true;
  go("assistant");

  const box = $("#chatMessages");

  box.insertAdjacentHTML(
    "beforeend",
    chatBubble("सोच रहा हूँ…", "model")
  );

  box.scrollTop = box.scrollHeight;

  $("#aiSend").disabled = true;

  try {
    let attachment = null;

    if (file) {
      attachment = {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: await toBase64(file)
      };
    }

    const r = await fetch("/api/ai/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": await authHeader()
      },

      body: JSON.stringify({
        message: userText,
        history: state.chat.slice(0, -1),
        attachment
      })
    });

    const data = await r.json();

    if (!r.ok) {
      throw new Error(data.error || "AI request failed");
    }

    state.chat.push({
      role: "model",
      text: data.reply
    });

    const msgs = $("#chatMessages");

    msgs.lastElementChild?.remove();

    msgs.insertAdjacentHTML(
      "beforeend",
      chatBubble(data.reply, "model")
    );

    msgs.scrollTop = msgs.scrollHeight;

  } catch (err) {
    state.chat.push({
      role: "model",
      text: err.message
    });

    const msgs = $("#chatMessages");

    msgs.lastElementChild?.remove();

    msgs.insertAdjacentHTML(
      "beforeend",
      chatBubble(err.message, "model")
    );

    toast(err.message, true);

  } finally {
    state.chatBusy = false;
    state.selectedFile = null;

    $("#aiFile").value = "";
    $("#fileChip").textContent = "";
    $("#aiInput").value = "";
    $("#aiSend").disabled = false;
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();

    r.onload = () =>
      resolve(String(r.result).split(",")[1]);

    r.onerror = reject;

    r.readAsDataURL(file);
  });
}

async function authHeader() {
  if (!supabase) return "";

  const { data } = await supabase.auth.getSession();

  return data.session?.access_token
    ? `Bearer ${data.session.access_token}`
    : "";
}

/* DATABASE */

async function db(table, query) {
  if (!supabase) {
    throw new Error(
      "Supabase configured नहीं है। .env और SQL setup करें।"
    );
  }

  return await query(supabase.from(table));
}

/* COURSE DATABASE */

async function loadCourses() {
  try {
    const { data, error } = await db(
      "courses",
      q => q.select("*").order("created_at", {
        ascending: false
      })
    );

    if (error) throw error;

    $("#courseList").innerHTML = data.length
      ? data.map(c => `
          <div class="data-row">
            <div class="row-icon">▣</div>

            <div class="row-main">
              <b>${escapeHTML(c.title)}</b>
              <small>
                ${escapeHTML(c.description || "No description")}
                · ${escapeHTML(c.level || "All levels")}
              </small>
            </div>

            <span class="status-pill">
              ${escapeHTML(c.status || "draft")}
            </span>
          </div>
        `).join("")
      : '<div class="empty-state">No courses yet. Add your first course.</div>';

  } catch (e) {
    $("#courseList").innerHTML =
      `<div class="empty-state">${escapeHTML(e.message)}</div>`;
  }

  $("#addCourseBtn")?.addEventListener("click", async () => {
    const title = prompt("Course title?");
    if (!title) return;

    const description = prompt("Short description?") || "";

    try {
      const { error } = await db(
        "courses",
        q => q.insert({
          title,
          description,
          created_by: state.user.id,
          status: "draft"
        })
      );

      if (error) throw error;

      toast("Course created");
      loadCourses();

    } catch (e) {
      toast(e.message, true);
    }
  });
}

async function loadCourseCount() {
  if (!supabase) return;

  try {
    const { count, error } = await supabase
      .from("courses")
      .select("*", {
        count: "exact",
        head: true
      });

    if (error) throw error;

    const el = $("#courseCount");

    if (el) el.textContent = count ?? 0;

  } catch {}
}

/* CRM DATABASE */

async function loadLeads() {
  try {
    const { data, error } = await db(
      "leads",
      q => q.select("*").order("created_at", {
        ascending: false
      })
    );

    if (error) throw error;

    $("#leadCount").textContent = data.length;

    $("#newLeadCount").textContent =
      data.filter(x => x.status === "new").length;

    $("#wonLeadCount").textContent =
      data.filter(x => x.status === "converted").length;

    $("#leadList").innerHTML = data.length
      ? data.map(l => `
          <div class="data-row">

            <div class="avatar">${initials(l.name)}</div>

            <div class="row-main">
              <b>${escapeHTML(l.name)}</b>
              <small>
                ${escapeHTML(l.email || l.phone || "No contact")}
                · ${escapeHTML(l.source || "Direct")}
              </small>
            </div>

            <select class="status-select" data-lead="${l.id}">
              ${["new", "contacted", "qualified", "converted", "lost"]
                .map(s => `
                  <option ${l.status === s ? "selected" : ""}>
                    ${s}
                  </option>
                `).join("")}
            </select>

          </div>
        `).join("")
      : '<div class="empty-state">No leads yet. Add your first lead.</div>';

    $$("[data-lead]").forEach(s => {
      s.onchange = async () => {
        const { error } = await db(
          "leads",
          q => q.update({
            status: s.value
          }).eq("id", s.dataset.lead)
        );

        if (error) toast(error.message, true);
        else toast("Lead updated");
      };
    });

  } catch (e) {
    $("#leadList").innerHTML =
      `<div class="empty-state">${escapeHTML(e.message)}</div>`;
  }

  $("#addLead").onclick = async () => {
    const name = prompt("Lead name?");
    if (!name) return;

    const email = prompt("Email (optional)?") || null;

    try {
      const { error } = await db(
        "leads",
        q => q.insert({
          name,
          email,
          status: "new",
          created_by: state.user.id
        })
      );

      if (error) throw error;

      toast("Lead added");
      loadLeads();

    } catch (e) {
      toast(e.message, true);
    }
  };
}

/* HR DATABASE */

async function loadEmployees() {
  try {
    const { data, error } = await db(
      "profiles",
      q => q.select("id,full_name,role,created_at")
        .order("created_at", {
          ascending: false
        })
    );

    if (error) throw error;

    $("#employeeList").innerHTML = data.length
      ? data.map(p => `
          <div class="data-row">

            <div class="avatar">
              ${initials(p.full_name || "U")}
            </div>

            <div class="row-main">
              <b>${escapeHTML(p.full_name || "New user")}</b>
              <small>Joined ${fmtDate(p.created_at)}</small>
            </div>

            <span class="status-pill">
              ${escapeHTML(p.role || "student")}
            </span>

          </div>
        `).join("")
      : '<div class="empty-state">No team profiles available.</div>';

  } catch (e) {
    $("#employeeList").innerHTML =
      `<div class="empty-state">${escapeHTML(e.message)}</div>`;
  }

  $("#addEmployee")?.addEventListener("click", () => {
    toast(
      "Invite flow can be added with Supabase Edge Function / admin invite API."
    );
  });
}

/* APPOINTMENTS DATABASE */

async function loadAppointments() {
  try {
    const { data, error } = await db(
      "appointments",
      q => q.select("*").order("starts_at", {
        ascending: true
      })
    );

    if (error) throw error;

    $("#appointmentList").innerHTML = data.length
      ? data.map(a => `
          <div class="data-row">

            <div class="row-icon">◷</div>

            <div class="row-main">
              <b>${escapeHTML(a.title)}</b>
              <small>
                ${fmtDate(a.starts_at)}
                · ${escapeHTML(a.notes || "")}
              </small>
            </div>

            <span class="status-pill">
              ${escapeHTML(a.status || "requested")}
            </span>

          </div>
        `).join("")
      : '<div class="empty-state">No appointments scheduled.</div>';

  } catch (e) {
    $("#appointmentList").innerHTML =
      `<div class="empty-state">${escapeHTML(e.message)}</div>`;
  }

  $("#bookAppointment").onclick = async () => {
    const title = prompt("Appointment title?");
    if (!title) return;

    const date = prompt("Start date/time (YYYY-MM-DDTHH:MM)");
    if (!date) return;

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return toast("Date/time सही format में लिखें।", true);
    }

    try {
      const { error } = await db(
        "appointments",
        q => q.insert({
          title,
          starts_at: parsedDate.toISOString(),
          status: "requested",
          created_by: state.user.id
        })
      );

      if (error) throw error;

      toast("Appointment requested");
      loadAppointments();

    } catch (e) {
      toast(e.message, true);
    }
  };
}

/* ANALYTICS DATABASE */

async function loadAnalytics() {
  if (!supabase) return;

  const queries = [
    ["courses", "#anCourses"],
    ["leads", "#anLeads"],
    ["appointments", "#anAppointments"]
  ];

  for (const [table, sel] of queries) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", {
          count: "exact",
          head: true
        });

      if (error) throw error;

      $(sel).textContent = count ?? 0;

    } catch {
      $(sel).textContent = "—";
    }
  }
}

/* ADMIN DATABASE */

async function loadAdmin() {
  if (!isAdmin()) return;

  try {
    const { data, error } = await db(
      "profiles",
      q => q.select("id,full_name,role,created_at")
        .order("created_at", {
          ascending: false
        })
        .limit(50)
    );

    if (error) throw error;

    $("#adminUsers").innerHTML = data.map(p => `
      <div class="data-row">

        <div class="avatar">
          ${initials(p.full_name || "U")}
        </div>

        <div class="row-main">
          <b>${escapeHTML(p.full_name || "User")}</b>
          <small>
            ${p.id.slice(0, 8)}… · ${fmtDate(p.created_at)}
          </small>
        </div>

        <span class="status-pill">
          ${escapeHTML(p.role || "student")}
        </span>

      </div>
    `).join("");

  } catch (e) {
    $("#adminUsers").innerHTML =
      `<div class="empty-state">${escapeHTML(e.message)}</div>`;
  }
}

/* QUIZ EVENTS */

function wireQuiz() {
  $("#loadQuizzes").onclick = async () => {
    const el = $("#quizList");

    try {
      const { data, error } = await db(
        "quizzes",
        q => q.select("*").order("created_at", {
          ascending: false
        })
      );

      if (error) throw error;

      el.innerHTML = data.length
        ? data.map(q => `
            <div class="data-row">

              <div class="row-icon">✓</div>

              <div class="row-main">
                <b>${escapeHTML(q.title)}</b>
                <small>${escapeHTML(q.description || "Practice quiz")}</small>
              </div>

              <span class="status-pill">
                ${q.published ? "published" : "draft"}
              </span>

            </div>
          `).join("")
        : "No quizzes published yet.";

    } catch (e) {
      el.textContent = e.message;
    }
  };

  $("#createQuiz").onclick = () => {
    toast("Quiz builder schema is included; question editor is a next UI milestone.");
  };
}

/* CREATE STUDIO EVENTS */

function wireCreate() {
  $$("[data-create]").forEach(b => {
    b.onclick = () => {
      $("#createPrompt").value = b.dataset.create;
      $("#createPrompt").focus();
    };
  });

  $("#createWithAI").onclick = () => {
    const promptText = $("#createPrompt").value.trim();

    if (!promptText) {
      return toast("अपना topic लिखें।", true);
    }

    go("assistant");

    setTimeout(() => {
      $("#aiInput").value = promptText;
      $("#aiForm").requestSubmit();
    }, 50);
  };
}

/* APPLICATION BOOT */

async function boot() {
  if (!supabase) {
    showAuth();
    return;
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError.message);
    showAuth();
    return;
  }

  if (!session) {
    showAuth();
    return;
  }

  state.user = session.user;

  const {
    data: profile,
    error
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Profile read:", error.message);
  }

  state.profile = profile || {
    id: session.user.id,
    full_name:
      session.user.user_metadata?.full_name ||
      session.user.email,
    role: "student"
  };

  shell();

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      state.user = null;
      state.profile = null;
      showAuth();
    }
  });
}

/* SERVICE WORKER */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(err => console.warn("Service Worker:", err));
  });
}

/* START VEDANT AI */

playIntro();

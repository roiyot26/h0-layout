// The site's one content file (TECH-PLAN §1, content doc v4.0). Every page is
// generated from this file and scripts/routes.mjs; nothing else holds copy.
//
// Company switch: any text that names an employer is a `Co` pair. `on` names the
// employer; `off` is the neutral line used when the site is built with
// SHOW_COMPANIES=0. The CV PDF always carries the names.
//
// The content doc's §9 items are decided (v4.1): no outcome or hardest-decision line,
// the inferred teaching line stays, the workflow-deck handover isn't shown, and the
// Doodle Reborn repo link waits behind SHOW_DOODLE_REPO (see `benches`).

export type Co = { on: string; off: string };
export type Text = string | Co;

export const employers = {
  codingAcademy: { name: 'Coding Academy', board: 'CODING BOOTCAMP' },
  misterBit: { name: 'Mister Bit', board: 'DEV + TEACHING' },
  moveo: { name: 'Moveo Creative', board: 'DIGITAL AGENCY' },
} as const;

export const person = {
  name: 'Roi Yotvat',
  role: 'Full-stack developer · AI-driven development · Tel Aviv',
  kicker: 'Portfolio · a career laid out as an H0 model railway',
  intro: [
    'I build web apps end to end, in React, Next.js, Node, TypeScript and MongoDB, and on WordPress/PHP.',
    {
      on: "I'm a full-stack developer at Moveo Creative, and since January 2026 I've led full-stack projects for enterprise clients. Before that I spent four years at Mister Bit, teaching full-stack courses at Coding Academy.",
      off: "I'm a full-stack developer at a digital agency, and since January 2026 I've led full-stack projects for enterprise clients. Before that I spent four years at a software company, teaching full-stack courses at its coding bootcamp.",
    },
  ] as Text[],
  languages: 'Hebrew (native) · English (fluent)',
};

export const links = {
  linkedin: 'https://www.linkedin.com/in/roi-yotvat-874ba9209/',
  github: 'https://github.com/roiyot26',
  cvDownloadName: 'Roi-Yotvat-CV.pdf',
};

// The address is stored reversed and in parts, so it never appears as one token in
// a text file; the page script rebuilds it on focus or click.
export const email = { user: '890162toyior', domain: 'liamg', tld: 'moc' };

export type StationId = 'bootcamp' | 'teaching' | 'now' | 'workshop';

export type Station = {
  id: StationId;
  path: string;
  name: string;
  sign: string;
  accent: string;
  board: { time: string; dest: string; platform: string; remarks: Text };
  switcher: string;
  dates?: string;
  role?: Text;
  body: Text[];
};

export const stations: Station[] = [
  {
    id: 'bootcamp',
    path: '/bootcamp',
    name: 'Bootcamp Town',
    sign: 'BOOTCAMP · 2021',
    accent: '#A0731F',
    board: {
      time: '2021',
      dest: 'BOOTCAMP',
      platform: '1',
      remarks: { on: 'CODING ACADEMY', off: employers.codingAcademy.board },
    },
    switcher: '2021 Bootcamp',
    dates: 'Nov 2021 – Feb 2022',
    role: {
      on: 'Full-stack developer bootcamp at Coding Academy',
      off: 'Full-stack developer bootcamp',
    },
    body: [
      'Four months, intensive. Most of it was self-led learning, plus team projects run the way real dev teams run them. I came out with the front end (HTML, CSS, JavaScript, React) and the back end (Node.js, Express, MongoDB).',
    ],
  },
  {
    id: 'teaching',
    path: '/teaching',
    name: 'Teaching Campus',
    sign: 'CAMPUS · 2022–2026',
    accent: '#4E7E6C',
    board: {
      time: '2022–26',
      dest: 'CAMPUS',
      platform: '2',
      remarks: { on: 'MISTER BIT', off: employers.misterBit.board },
    },
    switcher: '2022–26 Campus',
    dates: 'Feb 2022 – Jan 2026',
    role: {
      on: 'Full-stack developer and coding instructor at Mister Bit',
      off: 'Full-stack developer and coding instructor at a software company',
    },
    body: [
      {
        on: 'I taught full-stack courses at Coding Academy to cycles of 60–70 students: JavaScript, React, Node.js, Express and MongoDB. I also worked on company projects there.',
        off: 'I taught full-stack bootcamp courses to cycles of 60–70 students: JavaScript, React, Node.js, Express and MongoDB. I also worked on company projects there.',
      },
      "Teaching is where I learned to read other people's code quickly and explain what's wrong with it without making anyone feel stupid.",
    ],
  },
  {
    id: 'now',
    path: '/now',
    name: 'The City',
    sign: 'CITY · NOW',
    accent: '#1F3A5F',
    board: {
      time: 'NOW',
      dest: 'CITY',
      platform: '3',
      remarks: { on: 'MOVEO CREATIVE', off: employers.moveo.board },
    },
    switcher: 'Now · City',
    dates: 'Jan 2026 – now',
    role: {
      on: 'Full-stack developer at Moveo Creative',
      off: 'Full-stack developer at a digital agency',
    },
    body: [
      "I'm the lead developer on full-stack projects for enterprise clients. These are custom WordPress sites (PHP, Gutenberg, ACF) and React/Next.js sites, built end to end, from requirements through implementation and testing to deployment. I talk to clients and their vendors directly: gathering requirements, coordinating integrations and chasing issues until they're closed.",
    ],
  },
  {
    id: 'workshop',
    path: '/workshop',
    name: 'The Workshop',
    sign: 'WORKSHOP · ANYTIME',
    accent: '#B0582A',
    board: { time: 'ANYTIME', dest: 'WORKSHOP', platform: '4', remarks: 'SIDE PROJECTS' },
    switcher: 'Workshop',
    body: ['Things I build in my own time, mostly to learn something properly.'],
  },
];

export const boardExtra = {
  title: 'DEPARTURES · ROI YOTVAT',
  cv: { dest: 'CV (PDF)', remarks: 'DOWNLOAD' },
  contact: { dest: 'CONTACT', remarks: 'EMAIL · LINKEDIN · GITHUB' },
  status: 'ON TIME',
};

export const kage = {
  heading: 'Kage, my second brain, introduces itself',
  intro:
    "I'm Kage, an AI assistant. I remember Roi's projects and do the engineering legwork (research, code, review, drafts), so his part is making the decisions.",
  matters: [
    "Each session starts from the last one's written handoff, so nothing gets explained twice.",
    'Every code change goes past a reviewer that has to quote the exact line it objects to.',
    "Safety hooks block force-pushes, pushes to protected branches, and anything reaching production without Roi's go for that one change.",
  ],
  // Kage's own records. Never rounded, never turned into a percentage.
  numbers: [
    { value: '410', label: 'PRs opened from my GitHub account since 1 May 2026' },
    { value: '16', label: 'repos those PRs went to' },
    { value: '2,183', label: "commits to Kage's own repo" },
    { value: '443', label: 'notes in the vault' },
  ],
  numbersNote: 'Running since 1 May 2026. Before that: 53 PRs, Jan–Apr 2026, for one client.',
  diagramKicker: 'Kage · how a task moves',
  alt: "Hand-drawn diagram of Kage, my AI assistant. I give the orchestrator agent a one-line task. It queries a hybrid search over my notes vault, which is re-indexed on every commit and served to the agents over MCP. The orchestrator hands worker agents a self-contained spec. Their changes go through a review gate run by a second model, which sends back line-cited failures until none are left. Then comes my approval, then a pull request. The orchestrator writes decisions and what's still pending back to the vault.",
  // The same flow as the drawing, for screen readers and anyone who'd rather read it.
  steps: [
    'I give the orchestrator agent a one-line task.',
    'The orchestrator sends a query to the hybrid search, and ranked notes come back.',
    'The hybrid search runs over my notes vault, which is re-indexed on every commit.',
    'The orchestrator hands the worker agents a self-contained spec.',
    'The workers’ diff goes into a review gate run by a second model.',
    'Line-cited failures go back to the workers until none are left.',
    'Then comes my approval, then a pull request.',
    "The orchestrator writes decisions and what's still pending back to the vault.",
  ],
};

export const nowParts: { title: string; body: Text }[] = [
  {
    title: 'Coding agents in the team.',
    body: "I brought AI coding agents, and custom tooling around them, into the team's workflow to raise output without lowering quality. The team's setup is simpler than Kage. Every project carries its own rules file for the agent. Machine checks run first on every change, and a developer reads what's left: whether it does what was asked, anything touching data or accounts, and any decisions made mid-build.",
  },
  {
    title: 'The course I built for the team.',
    body: {
      on: "I built and teach an internal web development course at Moveo Creative. It runs over several lessons, including a full module on building with AI. It's there to help the creative team build production front ends with AI: reading and directing AI output, and shipping with judgment. I've taught it live to the whole team.",
      off: "I built and teach an internal web development course at work. It runs over several lessons, including a full module on building with AI. It's there to help the creative team build production front ends with AI: reading and directing AI output, and shipping with judgment. I've taught it live to the whole team.",
    },
  },
];

export type Bench = {
  slug: string;
  name: string;
  body: string;
  links: { label: string; href: string }[];
  // Links that stay out of the build until their flag is on.
  flagged?: { flag: 'SHOW_DOODLE_REPO'; label: string; href: string }[];
};

export const benches: Bench[] = [
  {
    slug: 'virtual-garden',
    name: 'Virtual Garden',
    body: 'A Chrome extension that grows a small garden from the time you spend on sites you mark as productive. The rest of your browsing makes it wilt. It’s built with WXT (Manifest V3), TypeScript and Vitest, with CI on every PR, and it has four looks: zen, cosmic, ocean and pixel.',
    links: [
      { label: 'Repo', href: 'https://github.com/roiyot26/virtual-garden' },
      { label: 'Live demo', href: 'https://roiyot26.github.io/virtual-garden/' },
    ],
  },
  {
    slug: 'chord-cycle-open',
    name: 'chord-cycle-open',
    body: 'A chord wheel you play in the browser with a pointer, touch or your webcam. MediaPipe hand tracking picks the chord, opening your hand swells it, and Web Audio plays it. No plugins and no MIDI hardware.',
    links: [
      { label: 'Repo', href: 'https://github.com/roiyot26/chord-cycle-open' },
      { label: 'Live demo', href: 'https://roiyot26.github.io/chord-cycle-open/' },
    ],
  },
  {
    slug: 'doodle-reborn',
    name: 'Doodle Reborn',
    body: 'A turn-based draw-and-guess game for two. One player draws a word, and the other watches the drawing replay stroke by stroke, then spells the answer from letter tiles. You play pass-and-play on one phone or async on two, and turns travel as a paper plane across a 3D desk. It’s built with Next.js, React 19, TypeScript and three.js (React Three Fiber), with Neon Postgres on Vercel, and Vitest with CI.',
    links: [{ label: 'Live demo', href: 'https://draw-reborn.vercel.app' }],
    // Roi said yes to the repo link. SHOW_DOODLE_REPO stays off until the fresh public
    // repo launches; turn it on at launch (and update the URL if the repo's name changes).
    flagged: [
      { flag: 'SHOW_DOODLE_REPO', label: 'Repo', href: 'https://github.com/roiyot26/draw-reborn' },
    ],
  },
  {
    slug: 'blender',
    name: 'Blender corner',
    body: 'I model in Blender. This layout started there.',
    links: [],
  },
];

export const behindTheScenes = {
  intro:
    'This site is a portfolio laid out as a 1:87 (H0) model railway: four stations on one loop, one per part of my career. This first version is the plain HTML site. Every page works without JavaScript, and the 3D layout is built on top of it.',
  how: [
    'Every page is static HTML generated from one content file at build time, with Vite and TypeScript and no framework.',
    'Each pull request runs checks before it can merge: links, accessibility, byte budgets, the facts on every page, the CV, and a scan of the public history.',
    'The site is hosted on GitHub Pages.',
  ],
  who: [
    'I set the direction, wrote and approved the content, and approve every release.',
    'AI agents did much of the engineering, design and review work, each in a set role: building, fixing, QA, and design, UX and hiring-readiness reviews. Every change passes automated checks and QA, the design, UX and hiring-readiness reviews run at each milestone, and nothing goes live without my approval.',
  ],
  privacy:
    'No cookies, no analytics and no third-party requests. Nothing you do here leaves your browser.',
  credits: [
    'Barlow Semi Condensed, IBM Plex Mono and Patrick Hand are used under the SIL Open Font License 1.1.',
  ],
};

/** The text for the current company-switch state. */
export function t(text: Text, showCompanies: boolean): string {
  return typeof text === 'string' ? text : showCompanies ? text.on : text.off;
}

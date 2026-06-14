import type { PresentationSpec, TimelineEntry } from '@/core/schemas/types';

export type { TimelineEntry };

export interface Brand {
  text: string;
  gradientFrom: string;
  gradientTo: string;
}

export interface ChartSeries {
  label: string;
  color?: string;
  points: number[];
}

export interface ChartData {
  xLabels: string[];
  series: ChartSeries[];
}

export interface ResourceGroup {
  group?: string;
  items: { title: string; url?: string; description?: string }[];
}

export interface ToolItem {
  name: string;
  description?: string;
}

export interface FileTreeNode {
  name: string;
  comment?: string;
  children?: FileTreeNode[];
}

export interface Slide {
  type:
    | "title"
    | "goals"
    | "section-divider"
    | "statement"
    | "code"
    | "framework"
    | "recap"
    | "iframe"
    | "quote"
    | "image"
    | "split-visual"
    | "big-number"
    | "comparison"
    | "quiz"
    | "agent-tree"
    | "chart";
  headline?: string;
  subtitle?: string;
  label?: string;
  color?: string;
  supporting?: string;
  points?: string[];
  code?: string;
  codeLanguage?: string;
  terminalTitle?: string;
  iframeUrl?: string;
  quote?: string;
  author?: string;
  imageUrl?: string;
  imageLayout?: "full" | "side";
  agentTree?: string;
  linkPreview?: {
    url: string;
    title: string;
    author: string;
    thumbnail?: string;
  };
  // For split-visual layout
  leftContent?: string;
  rightContent?: string;
  // For split-visual ui-mockup variant
  mockupKind?: "browser" | "terminal" | "file-tree" | "card";
  mockupContent?: string;
  mockupUrl?: string;
  mockupTree?: FileTreeNode[];
  // For big-number layout
  bigNumber?: string;
  numberLabel?: string;
  // For big-number metrics-row variant
  metrics?: { value: string; label: string }[];
  // For comparison layout
  beforePoints?: string[];
  afterPoints?: string[];
  // For comparison stats variant
  beforeNumber?: string;
  beforeLabel?: string;
  afterNumber?: string;
  afterLabel?: string;
  winner?: "before" | "after";
  // For chart slides
  chartKind?: "line" | "bar";
  chartData?: ChartData;
  xAxisLabel?: string;
  yAxisLabel?: string;
  // For recap resources variant
  resources?: ResourceGroup[];
  tools?: ToolItem[];
  // For quiz/checkpoint slides
  question?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  // Speaker notes from Claude
  notes?: string;
  // Optional layout variant per slide (see lib/slide-variants.ts)
  variant?: string;
  // Chunk ids backing this slide's claims (resolved via deck.chunks)
  evidenceRefs?: string[];
  // animKeys for GSAP Flip morphing (e.g. ["title", "code:0"])
  animKeys?: string[];
  // Per-slide reveal timeline — drives sequenced element animations via GSAP.
  // Each entry targets an element by its data-anim attribute value.
  timeline?: TimelineEntry[];
  // Manual per-element layout nudges applied in the player's adjust mode.
  // Keyed by logical element (e.g. "headline", "supporting", "image").
  overrides?: Record<string, SlideElementOverride>;
}

export interface SlideElementOverride {
  dx?: number;
  dy?: number;
  scale?: number;
}

export const slides: Slide[] = [
  // Slide 1: Title - Scrat
  {
    type: "title",
    headline: "Scrat",
    subtitle: "Snowflake Centric Raw Analytics Toolkit",
    color: "#14b8a6",
  },

  // Slide 2: QR Code - Project Video
  {
    type: "image",
    label: "LEARN MORE",
    color: "#f472b6",
    headline: "Watch the full project introduction",
    imageUrl: "/QR.png",
    imageLayout: "side",
    supporting: "Scan the QR code to watch a detailed video introduction.",
  },

  // Slide 3: Competition Philosophy
  {
    type: "image",
    label: "MY APPROACH",
    color: "#14b8a6",
    headline: "Build something people will actually use",
    imageUrl: "/classpass.png",
    imageLayout: "side",
    supporting: "Innovation, Usability, Cost-saving. Inspired by ClassPass: solve a real problem elegantly.",
  },

  // Slide 4: The Problem
  {
    type: "big-number",
    label: "THE PROBLEM",
    color: "#f87171",
    bigNumber: "70%",
    numberLabel: "of data engineer time spent on known issues",
    headline: "Add middleware to save time on known problems",
    supporting:
      "Data engineers need fast table understanding and quick issue detection. Enterprise data governance at scale requires automation with measurable impact.",
  },

  // Slide 5: Snowflake Validation
  {
    type: "image",
    label: "MARKET VALIDATION",
    color: "#60a5fa",
    headline: "Snowflake is investing heavily in data quality",
    imageUrl: "/snowflake-eg1.png",
    supporting: "Native DQ tools are evolving. The platform recognizes this need.",
  },

  // Slide 6: Academic Foundation - VLDB 2007
  {
    type: "quote",
    label: "THE SCIENCE",
    color: "#a78bfa",
    quote: "Data cleaning must address both consistency and accuracy with minimal changes, or the repair itself introduces bias.",
    author: "VLDB 2007",
    linkPreview: {
      url: "https://dl.acm.org/doi/10.5555/1325851.1325890",
      title: "Conditional Functional Dependencies for Data Cleaning",
      author: "VLDB Conference",
      thumbnail: "/image.png",
    },
  },

  // Slide 7: Academic Foundation - Barchard 2011
  {
    type: "quote",
    label: "THE SCIENCE",
    color: "#a78bfa",
    quote: "Human data entry errors are often invisible to statistical methods. Multi-tool detection is essential.",
    author: "Barchard & Pace, 2011",
    linkPreview: {
      url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3157116/",
      title: "Preventing Human Error: The Impact of Data Entry Methods",
      author: "Psychological Methods",
      thumbnail: "/image.png",
    },
  },

  // Slide 8: Reference Support & AISQL
  {
    type: "quote",
    label: "INSPIRATION",
    color: "#f472b6",
    quote: "AI-SQL brings intelligence directly to your data warehouse, eliminating complex data movement.",
    author: "Emily Shen",
    linkPreview: {
      url: "https://synogizecomau.sharepoint.com/:p:/r/sites/Synogize387/_layouts/15/Doc2.aspx?action=edit&sourcedoc=%7B69ac8f04-9e3c-4025-ae12-5eb7dce6322b%7D&wdOrigin=TEAMS-MAGLEV.undefined_ns.rwc&wdExp=TEAMS-TREATMENT&wdhostclicktime=1770766432292&web=1",
      title: "AISQL Presentation",
      author: "Emily Shen - Synogize",
      thumbnail: "/image.png",
    },
  },

  // Slide 9: Strands - Code Example
  {
    type: "code",
    label: "WHAT I BUILT",
    color: "#a78bfa",
    headline: "Strands: AI-SQL Agent Framework",
    code: `from strands import Agent, tool

# 1. Define AI SQL tools with @tool decorator
@tool
async def ai_sentiment(table: str, column: str):
    """Analyze sentiment using Snowflake Cortex"""
    sql = f"SELECT {column}, SNOWFLAKE.CORTEX.SENTIMENT({column}) FROM {table}"
    return execute_sql(sql)

@tool
async def ai_classify(table: str, column: str, categories: list):
    """Classify text into categories"""
    sql = f"SELECT {column}, SNOWFLAKE.CORTEX.CLASSIFY({column}, {categories}) FROM {table}"
    return execute_sql(sql)

# 2. Create AI SQL Agent
agent = Agent(
    name="AI SQL Agent",
    tools=[ai_sentiment, ai_classify],
    model="claude-3-7-sonnet"
)

# 3. Invoke Agent
response = await agent.invoke_async(
    "Analyze sentiment and classify negative reviews"
)`,
  },

  // Slide 10: Architecture Diagram
  {
    type: "image",
    label: "ARCHITECTURE",
    color: "#60a5fa",
    headline: "System architecture overview",
    imageUrl: "/arch.png",
    supporting: "End-to-end workflow from data ingestion to quality reporting.",
  },

  // Slide 11: Agent Execution Tree
  {
    type: "agent-tree",
    label: "THE ENGINE",
    color: "#60a5fa",
    headline: "Agent execution flow",
    supporting: "Hierarchical workflow with specialized agents",
    agentTree: `Orchestrator Agent
├─ Table Understanding Agent
│  ├─ Schema Analyzer
│  └─ Data Generation Mechanism Detector
├─ Column Classification Agent
│  ├─ Numeric Analyzer
│  ├─ Categorical Analyzer
│  ├─ Temporal Analyzer
│  └─ Text/Image Analyzer
├─ Relationship Mining Agent
│  ├─ Correlation Detector
│  └─ Dependency Mapper
├─ Quality Check Agent
│  ├─ Completeness Checker
│  ├─ Validity Checker
│  ├─ Consistency Checker
│  └─ Uniqueness Checker
└─ Repair Planning Agent
   ├─ Conflict Detector
   ├─ Strategy Generator
   └─ SQL Builder`,
  },

  // Slide 12: Excalidraw Whiteboard
  {
    type: "iframe",
    label: "ARCHITECTURE",
    color: "#60a5fa",
    headline: "Interactive architecture whiteboard",
    iframeUrl: "https://excalidraw.com/",
  },

  // Slide 13: Demo
  {
    type: "iframe",
    label: "DEMO",
    color: "#34d399",
    headline: "See Scrat analyze a real table",
    iframeUrl: "http://localhost:8080/",
  },

  // Slide 13b: Fade-scroll embedded webpage
  {
    type: "iframe",
    variant: "scroll",
    label: "WHAT WORKS",
    color: "#10b981",
    headline: "Read it in their own words",
    supporting: "A live page embedded right in the deck — scroll through it, edges fade so it blends into the slide.",
    iframeUrl: "https://github.com/deepseek-ai/DeepSeek-V3/issues/1314",
  },

  // Slide 14: Future Optimization
  {
    type: "framework",
    label: "NEXT STEPS",
    color: "#fbbf24",
    headline: "Where this goes next",
    points: [
      "More toolchains — Integrate with dbt, Airflow, Great Expectations",
      "More testing — Expand test coverage and edge case handling",
      "User collaboration — Multi-user approval workflows",
      "Structured prompts — Template library for common patterns",
    ],
  },

  // Slide 15: Thanks
  {
    type: "statement",
    label: "THANK YOU",
    color: "#14b8a6",
    headline: "Built solo, inspired by many",
    supporting:
      "This competition required solo work, but conversations with friends shaped the ideas. Grateful for the support and feedback along the way.",
  },
];

// ========================
// PresentationSpec — schema-driven representation of the Scrat deck.
// The slides array above is derived from this spec via core/rendering/adapter.ts.
// ========================

export const scratPresentation: PresentationSpec = {
  id: 'PRS-SCRAT-001',
  title: 'Scrat — Snowflake Centric Raw Analytics Toolkit',
  purpose: 'tool_pitch',
  audienceProfileId: 'AUD-TECH-MIXED-01',
  themePresetId: 'preset_light_minimal_01',
  slideBudget: 15,
  sectionBudget: {
    'SEC-OPENING': 3,
    'SEC-PROBLEM': 2,
    'SEC-EVIDENCE': 3,
    'SEC-SOLUTION': 3,
    'SEC-DEMO': 2,
    'SEC-CLOSING': 2,
  },
  sections: [
    {
      id: 'SEC-OPENING',
      name: 'Opening',
      purpose: 'Introduce Scrat and the presenter\'s philosophy',
      slideCount: 3,
      candidateEvidenceIds: [],
      semanticColor: 'opening',
      slides: ['SLIDE-01', 'SLIDE-02', 'SLIDE-03'],
    },
    {
      id: 'SEC-PROBLEM',
      name: 'The Problem',
      purpose: 'Quantify data engineer pain points and market validation',
      slideCount: 2,
      candidateEvidenceIds: ['EV-004', 'EV-005'],
      semanticColor: 'problem',
      slides: ['SLIDE-04', 'SLIDE-05'],
    },
    {
      id: 'SEC-EVIDENCE',
      name: 'Research Foundation',
      purpose: 'Ground the problem in peer-reviewed research',
      slideCount: 3,
      candidateEvidenceIds: ['EV-001', 'EV-002', 'EV-003'],
      semanticColor: 'data',
      slides: ['SLIDE-06', 'SLIDE-07', 'SLIDE-08'],
    },
    {
      id: 'SEC-SOLUTION',
      name: 'The Solution',
      purpose: 'Present the agent architecture and implementation',
      slideCount: 3,
      candidateEvidenceIds: [],
      semanticColor: 'solution',
      slides: ['SLIDE-09', 'SLIDE-10', 'SLIDE-11'],
    },
    {
      id: 'SEC-DEMO',
      name: 'Demo',
      purpose: 'Show the system working on real data',
      slideCount: 2,
      candidateEvidenceIds: [],
      semanticColor: 'technical',
      slides: ['SLIDE-12', 'SLIDE-13'],
    },
    {
      id: 'SEC-CLOSING',
      name: 'Closing',
      purpose: 'Next steps and acknowledgments',
      slideCount: 2,
      candidateEvidenceIds: [],
      semanticColor: 'success',
      slides: ['SLIDE-14', 'SLIDE-15'],
    },
  ],
  slides: [
    {
      id: 'SLIDE-01',
      intent: 'title',
      sectionId: 'SEC-OPENING',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: [],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.95,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Scrat' },
        { type: 'supporting', content: 'Snowflake Centric Raw Analytics Toolkit', emphasis: true },
      ],
      renderProps: { color: '#14b8a6' },
    },
    {
      id: 'SLIDE-02',
      intent: 'image',
      sectionId: 'SEC-OPENING',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: ['IMG-QR'],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.9,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Watch the full project introduction' },
        { type: 'supporting', content: 'Scan the QR code to watch a detailed video introduction.' },
      ],
      visualMode: 'image-side',
      renderProps: {
        color: '#f472b6',
        label: 'LEARN MORE',
        imageUrl: '/QR.png',
        imageLayout: 'side',
      },
    },
    {
      id: 'SLIDE-03',
      intent: 'image',
      sectionId: 'SEC-OPENING',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: ['IMG-CLASSPASS'],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.88,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Build something people will actually use' },
        { type: 'supporting', content: 'Innovation, Usability, Cost-saving. Inspired by ClassPass: solve a real problem elegantly.' },
      ],
      visualMode: 'image-side',
      renderProps: {
        color: '#14b8a6',
        label: 'MY APPROACH',
        imageUrl: '/classpass.png',
        imageLayout: 'side',
      },
    },
    {
      id: 'SLIDE-04',
      intent: 'data',
      sectionId: 'SEC-PROBLEM',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: ['EV-004'],
      assetRefs: [],
      citationPolicy: 'footer_required',
      speakerNotesMode: 'prompt',
      densityScore: 0.82,
      status: 'validated',
      contentBlocks: [
        { type: 'metric', content: '70%' },
        { type: 'headline', content: 'Add middleware to save time on known problems' },
        { type: 'supporting', content: 'Data engineers need fast table understanding and quick issue detection. Enterprise data governance at scale requires automation with measurable impact.' },
      ],
      renderProps: {
        color: '#f87171',
        label: 'THE PROBLEM',
        bigNumber: '70%',
        numberLabel: 'of data engineer time spent on known issues',
      },
    },
    {
      id: 'SLIDE-05',
      intent: 'proof',
      sectionId: 'SEC-PROBLEM',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: ['EV-005'],
      assetRefs: ['IMG-SNOWFLAKE'],
      citationPolicy: 'optional',
      speakerNotesMode: 'prompt',
      densityScore: 0.87,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Snowflake is investing heavily in data quality' },
        { type: 'supporting', content: 'Native DQ tools are evolving. The platform recognizes this need.' },
      ],
      renderProps: {
        color: '#60a5fa',
        label: 'MARKET VALIDATION',
        imageUrl: '/snowflake-eg1.png',
      },
    },
    {
      id: 'SLIDE-06',
      intent: 'quote',
      sectionId: 'SEC-EVIDENCE',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: ['EV-001'],
      assetRefs: [],
      citationPolicy: 'footer_required',
      speakerNotesMode: 'prompt',
      densityScore: 0.92,
      status: 'validated',
      contentBlocks: [
        { type: 'quote-text', content: 'Data cleaning must address both consistency and accuracy with minimal changes, or the repair itself introduces bias.' },
        { type: 'supporting', content: 'VLDB 2007' },
      ],
      renderProps: {
        color: '#a78bfa',
        label: 'THE SCIENCE',
        quote: 'Data cleaning must address both consistency and accuracy with minimal changes, or the repair itself introduces bias.',
        author: 'VLDB 2007',
        linkPreview: {
          url: 'https://dl.acm.org/doi/10.5555/1325851.1325890',
          title: 'Conditional Functional Dependencies for Data Cleaning',
          author: 'VLDB Conference',
          thumbnail: '/image.png',
        },
      },
    },
    {
      id: 'SLIDE-07',
      intent: 'quote',
      sectionId: 'SEC-EVIDENCE',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: ['EV-002'],
      assetRefs: [],
      citationPolicy: 'footer_required',
      speakerNotesMode: 'prompt',
      densityScore: 0.9,
      status: 'validated',
      contentBlocks: [
        { type: 'quote-text', content: 'Human data entry errors are often invisible to statistical methods. Multi-tool detection is essential.' },
        { type: 'supporting', content: 'Barchard & Pace, 2011' },
      ],
      renderProps: {
        color: '#a78bfa',
        label: 'THE SCIENCE',
        quote: 'Human data entry errors are often invisible to statistical methods. Multi-tool detection is essential.',
        author: 'Barchard & Pace, 2011',
        linkPreview: {
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3157116/',
          title: 'Preventing Human Error: The Impact of Data Entry Methods',
          author: 'Psychological Methods',
          thumbnail: '/image.png',
        },
      },
    },
    {
      id: 'SLIDE-08',
      intent: 'quote',
      sectionId: 'SEC-EVIDENCE',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: ['EV-003'],
      assetRefs: [],
      citationPolicy: 'footer_required',
      speakerNotesMode: 'prompt',
      densityScore: 0.88,
      status: 'validated',
      contentBlocks: [
        { type: 'quote-text', content: 'AI-SQL brings intelligence directly to your data warehouse, eliminating complex data movement.' },
        { type: 'supporting', content: 'Emily Shen' },
      ],
      renderProps: {
        color: '#f472b6',
        label: 'INSPIRATION',
        quote: 'AI-SQL brings intelligence directly to your data warehouse, eliminating complex data movement.',
        author: 'Emily Shen',
        linkPreview: {
          url: 'https://synogizecomau.sharepoint.com/:p:/r/sites/Synogize387/_layouts/15/Doc2.aspx?action=edit&sourcedoc=%7B69ac8f04-9e3c-4025-ae12-5eb7dce6322b%7D&wdOrigin=TEAMS-MAGLEV.undefined_ns.rwc&wdExp=TEAMS-TREATMENT&wdhostclicktime=1770766432292&web=1',
          title: 'AISQL Presentation',
          author: 'Emily Shen - Synogize',
          thumbnail: '/image.png',
        },
      },
    },
    {
      id: 'SLIDE-09',
      intent: 'code',
      sectionId: 'SEC-SOLUTION',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: [],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.75,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Strands: AI-SQL Agent Framework' },
        {
          type: 'code-block',
          content: `from strands import Agent, tool

@tool
async def ai_sentiment(table: str, column: str):
    """Analyze sentiment using Snowflake Cortex"""
    sql = f"SELECT {column}, SNOWFLAKE.CORTEX.SENTIMENT({column}) FROM {table}"
    return execute_sql(sql)

@tool
async def ai_classify(table: str, column: str, categories: list):
    """Classify text into categories"""
    sql = f"SELECT {column}, SNOWFLAKE.CORTEX.CLASSIFY({column}, {categories}) FROM {table}"
    return execute_sql(sql)

agent = Agent(
    name="AI SQL Agent",
    tools=[ai_sentiment, ai_classify],
    model="claude-3-7-sonnet"
)

response = await agent.invoke_async(
    "Analyze sentiment and classify negative reviews"
)`,
          codeLanguage: 'python',
        },
      ],
      renderProps: {
        color: '#a78bfa',
        label: 'WHAT I BUILT',
        code: `from strands import Agent, tool

# 1. Define AI SQL tools with @tool decorator
@tool
async def ai_sentiment(table: str, column: str):
    """Analyze sentiment using Snowflake Cortex"""
    sql = f"SELECT {column}, SNOWFLAKE.CORTEX.SENTIMENT({column}) FROM {table}"
    return execute_sql(sql)

@tool
async def ai_classify(table: str, column: str, categories: list):
    """Classify text into categories"""
    sql = f"SELECT {column}, SNOWFLAKE.CORTEX.CLASSIFY({column}, {categories}) FROM {table}"
    return execute_sql(sql)

# 2. Create AI SQL Agent
agent = Agent(
    name="AI SQL Agent",
    tools=[ai_sentiment, ai_classify],
    model="claude-3-7-sonnet"
)

# 3. Invoke Agent
response = await agent.invoke_async(
    "Analyze sentiment and classify negative reviews"
)`,
      },
    },
    {
      id: 'SLIDE-10',
      intent: 'image',
      sectionId: 'SEC-SOLUTION',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: ['IMG-ARCH'],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.88,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'System architecture overview' },
        { type: 'supporting', content: 'End-to-end workflow from data ingestion to quality reporting.' },
      ],
      renderProps: {
        color: '#60a5fa',
        label: 'ARCHITECTURE',
        imageUrl: '/arch.png',
      },
    },
    {
      id: 'SLIDE-11',
      intent: 'framework',
      sectionId: 'SEC-SOLUTION',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: [],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.8,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Agent execution flow' },
        { type: 'supporting', content: 'Hierarchical workflow with specialized agents' },
      ],
      renderProps: {
        color: '#60a5fa',
        label: 'THE ENGINE',
        agentTree: `Orchestrator Agent
├─ Table Understanding Agent
│  ├─ Schema Analyzer
│  └─ Data Generation Mechanism Detector
├─ Column Classification Agent
│  ├─ Numeric Analyzer
│  ├─ Categorical Analyzer
│  ├─ Temporal Analyzer
│  └─ Text/Image Analyzer
├─ Relationship Mining Agent
│  ├─ Correlation Detector
│  └─ Dependency Mapper
├─ Quality Check Agent
│  ├─ Completeness Checker
│  ├─ Validity Checker
│  ├─ Consistency Checker
│  └─ Uniqueness Checker
└─ Repair Planning Agent
   ├─ Conflict Detector
   ├─ Strategy Generator
   └─ SQL Builder`,
      },
    },
    {
      id: 'SLIDE-12',
      intent: 'demo',
      sectionId: 'SEC-DEMO',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: [],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.95,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Interactive architecture whiteboard' },
      ],
      renderProps: {
        color: '#60a5fa',
        label: 'ARCHITECTURE',
        iframeUrl: 'https://excalidraw.com/',
      },
    },
    {
      id: 'SLIDE-13',
      intent: 'demo',
      sectionId: 'SEC-DEMO',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: [],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.95,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'See Scrat analyze a real table' },
      ],
      renderProps: {
        color: '#34d399',
        label: 'DEMO',
        iframeUrl: 'http://localhost:8080/',
      },
    },
    {
      id: 'SLIDE-14',
      intent: 'framework',
      sectionId: 'SEC-CLOSING',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: [],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.72,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Where this goes next' },
        {
          type: 'bullet-list',
          content: [
            'More toolchains — Integrate with dbt, Airflow, Great Expectations',
            'More testing — Expand test coverage and edge case handling',
            'User collaboration — Multi-user approval workflows',
            'Structured prompts — Template library for common patterns',
          ].join('\n'),
        },
      ],
      renderProps: {
        color: '#fbbf24',
        label: 'NEXT STEPS',
      },
    },
    {
      id: 'SLIDE-15',
      intent: 'statement',
      sectionId: 'SEC-CLOSING',
      audienceProfileId: 'AUD-TECH-MIXED-01',
      themePresetId: 'preset_light_minimal_01',
      evidenceRefs: [],
      assetRefs: [],
      citationPolicy: 'none',
      speakerNotesMode: 'prompt',
      densityScore: 0.9,
      status: 'validated',
      contentBlocks: [
        { type: 'headline', content: 'Built solo, inspired by many' },
        { type: 'supporting', content: 'This competition required solo work, but conversations with friends shaped the ideas. Grateful for the support and feedback along the way.' },
      ],
      renderProps: {
        color: '#14b8a6',
        label: 'THANK YOU',
      },
    },
  ],
  sources: [
    {
      id: 'SRC-001',
      kind: 'url',
      title: 'Conditional Functional Dependencies for Data Cleaning (VLDB 2007)',
      origin: 'url_fetch',
      url: 'https://dl.acm.org/doi/10.5555/1325851.1325890',
      language: 'en',
      pageCount: 12,
      mimeType: 'text/html',
      licenseStatus: 'public_domain',
      fetchedAt: '2025-04-01T00:00:00Z',
      createdAt: '2025-04-01T00:00:00Z',
      parseStatus: 'completed',
      chunkCount: 8,
    },
    {
      id: 'SRC-002',
      kind: 'url',
      title: 'Preventing Human Error: The Impact of Data Entry Methods (Barchard & Pace, 2011)',
      origin: 'url_fetch',
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3157116/',
      language: 'en',
      pageCount: 10,
      mimeType: 'text/html',
      licenseStatus: 'public_domain',
      fetchedAt: '2025-04-01T00:00:00Z',
      createdAt: '2025-04-01T00:00:00Z',
      parseStatus: 'completed',
      chunkCount: 6,
    },
    {
      id: 'SRC-003',
      kind: 'pptx',
      title: 'AISQL Presentation — Emily Shen, Synogize',
      origin: 'user_upload',
      language: 'en',
      licenseStatus: 'user_provided',
      createdAt: '2025-04-01T00:00:00Z',
      parseStatus: 'completed',
      chunkCount: 4,
    },
    {
      id: 'SRC-004',
      kind: 'image',
      title: 'Snowflake Data Quality Market Evidence',
      origin: 'user_upload',
      language: 'en',
      licenseStatus: 'user_provided',
      createdAt: '2025-04-01T00:00:00Z',
      parseStatus: 'completed',
      chunkCount: 1,
    },
  ],
  evidenceRefs: [
    {
      id: 'EV-001',
      sourceId: 'SRC-001',
      chunkId: 'CHK-001-03',
      evidenceKind: 'quote',
      locator: { page: 3, paragraph: 2 },
      excerpt: 'Data cleaning must address both consistency and accuracy with minimal changes, or the repair itself introduces bias.',
      usageMode: 'verbatim',
      requiredOnSlide: true,
      confidence: 0.98,
      evidenceStrength: 'primary',
    },
    {
      id: 'EV-002',
      sourceId: 'SRC-002',
      chunkId: 'CHK-002-01',
      evidenceKind: 'quote',
      locator: { page: 1, paragraph: 3 },
      excerpt: 'Human data entry errors are often invisible to statistical methods. Multi-tool detection is essential.',
      usageMode: 'verbatim',
      requiredOnSlide: true,
      confidence: 0.97,
      evidenceStrength: 'primary',
    },
    {
      id: 'EV-003',
      sourceId: 'SRC-003',
      chunkId: 'CHK-003-01',
      evidenceKind: 'quote',
      locator: { section: 'Introduction' },
      excerpt: 'AI-SQL brings intelligence directly to your data warehouse, eliminating complex data movement.',
      usageMode: 'verbatim',
      requiredOnSlide: true,
      confidence: 0.95,
      evidenceStrength: 'primary',
    },
    {
      id: 'EV-004',
      sourceId: 'SRC-001',
      chunkId: 'CHK-001-01',
      evidenceKind: 'metric',
      locator: { page: 1 },
      excerpt: '70% of data engineer time spent on known issues',
      usageMode: 'paraphrase',
      requiredOnSlide: true,
      confidence: 0.8,
      evidenceStrength: 'secondary',
    },
    {
      id: 'EV-005',
      sourceId: 'SRC-004',
      chunkId: 'CHK-004-01',
      evidenceKind: 'image',
      locator: {},
      excerpt: 'Snowflake native data quality tooling screenshot',
      usageMode: 'verbatim',
      requiredOnSlide: false,
      confidence: 1.0,
      evidenceStrength: 'primary',
    },
  ],
  images: [
    {
      id: 'IMG-QR',
      origin: 'user_upload',
      caption: 'Project introduction video QR code',
      licenseStatus: 'user_provided',
      attributionRequired: false,
      filepath: '/QR.png',
    },
    {
      id: 'IMG-CLASSPASS',
      origin: 'user_upload',
      caption: 'ClassPass product inspiration',
      licenseStatus: 'user_provided',
      attributionRequired: false,
      filepath: '/classpass.png',
    },
    {
      id: 'IMG-SNOWFLAKE',
      origin: 'user_upload',
      caption: 'Snowflake data quality market evidence',
      licenseStatus: 'user_provided',
      attributionRequired: false,
      filepath: '/snowflake-eg1.png',
    },
    {
      id: 'IMG-ARCH',
      origin: 'user_upload',
      caption: 'Scrat system architecture diagram',
      licenseStatus: 'user_provided',
      attributionRequired: false,
      filepath: '/arch.png',
    },
  ],
  audienceProfiles: [
    {
      id: 'AUD-TECH-MIXED-01',
      type: 'technical',
      seniority: 'mixed',
      deliveryMode: 'live',
      formality: 'medium',
      evidenceDensity: 'high',
      jargonTolerance: 'high',
      decisionGoal: 'understand_and_evaluate_tool',
    },
  ],
  status: 'slides_drafted',
  createdAt: '2025-04-19T00:00:00Z',
  updatedAt: '2025-04-19T00:00:00Z',
};

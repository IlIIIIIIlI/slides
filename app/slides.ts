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
    | "agent-tree"; // New: agent execution tree
  headline: string;
  subtitle?: string;
  label?: string;
  color?: string;
  supporting?: string;
  points?: string[];
  code?: string;
  iframeUrl?: string;
  quote?: string;
  author?: string;
  imageUrl?: string;
  imageLayout?: "full" | "side"; // New: layout option for images
  agentTree?: string; // New: agent tree structure
  linkPreview?: {
    url: string;
    title: string;
    author: string;
    thumbnail?: string;
  };
  // For split-visual layout
  leftContent?: string;
  rightContent?: string;
  // For big-number layout
  bigNumber?: string;
  numberLabel?: string;
  // For comparison layout
  beforePoints?: string[];
  afterPoints?: string[];
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

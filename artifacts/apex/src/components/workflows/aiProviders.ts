export type ProviderCategory = 'thinking' | 'voice' | 'video' | 'automation' | 'visual' | 'research';

export interface AIProvider {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  bgColor: string;
  category: ProviderCategory;
  description: string;
  connected: boolean;
  outputType: 'text' | 'audio' | 'video' | 'image' | 'action';
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI GPT-4',
    shortName: 'OpenAI',
    icon: '🤖',
    color: '#10a37f',
    bgColor: 'rgba(16,163,127,0.12)',
    category: 'thinking',
    description: 'Powerful text generation, logic, and coding',
    connected: true,
    outputType: 'text',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    icon: '🧠',
    color: '#d97706',
    bgColor: 'rgba(217,119,6,0.12)',
    category: 'thinking',
    description: 'Deep reasoning, long documents, nuanced writing',
    connected: true,
    outputType: 'text',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    shortName: 'Perplexity',
    icon: '🔍',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.12)',
    category: 'research',
    description: 'Real-time web research and fact-finding',
    connected: true,
    outputType: 'text',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    shortName: 'ElevenLabs',
    icon: '🎙️',
    color: '#ec4899',
    bgColor: 'rgba(236,72,153,0.12)',
    category: 'voice',
    description: 'Hyper-realistic AI voice and audio synthesis',
    connected: false,
    outputType: 'audio',
  },
  {
    id: 'runway',
    name: 'Runway ML',
    shortName: 'Runway',
    icon: '🎬',
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.12)',
    category: 'video',
    description: 'AI video generation and editing',
    connected: false,
    outputType: 'video',
  },
  {
    id: 'sora',
    name: 'OpenAI Sora',
    shortName: 'Sora',
    icon: '🎥',
    color: '#10a37f',
    bgColor: 'rgba(16,163,127,0.12)',
    category: 'video',
    description: 'Photorealistic text-to-video generation',
    connected: false,
    outputType: 'video',
  },
  {
    id: 'veo',
    name: 'Google Veo',
    shortName: 'Veo',
    icon: '🎞️',
    color: '#ea4335',
    bgColor: 'rgba(234,67,53,0.12)',
    category: 'video',
    description: 'Google DeepMind cinematic video generation',
    connected: false,
    outputType: 'video',
  },
  {
    id: 'lindy',
    name: 'Lindy AI',
    shortName: 'Lindy',
    icon: '⚡',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
    category: 'automation',
    description: 'AI agent for publishing, scheduling, outreach',
    connected: false,
    outputType: 'action',
  },
  {
    id: 'napkin',
    name: 'Napkin AI',
    shortName: 'Napkin',
    icon: '📊',
    color: '#06b6d4',
    bgColor: 'rgba(6,182,212,0.12)',
    category: 'visual',
    description: 'Visual docs, diagrams, and infographics',
    connected: false,
    outputType: 'image',
  },
];

export function getProvider(id: string): AIProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  gradient: string;
  authorName: string;
  uses: number;
  steps: {
    id: string;
    name: string;
    provider: string;
    prompt: string;
    outputKey: string;
  }[];
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'youtube-video',
    name: 'YouTube Video Creator',
    description: 'Full end-to-end YouTube video from a single idea',
    category: 'video',
    icon: '🎥',
    gradient: 'linear-gradient(135deg, #ff0000 0%, #8b5cf6 100%)',
    authorName: 'Apex Team',
    uses: 1240,
    steps: [
      {
        id: 's1',
        name: 'Research Trends',
        provider: 'perplexity',
        prompt: 'Research the top 5 trending topics in {{topic}} right now. Include search volume data and why each is trending. Format as a numbered list.',
        outputKey: 'research',
      },
      {
        id: 's2',
        name: 'Script Writing',
        provider: 'claude',
        prompt: 'Write a compelling 8-minute YouTube script about the most interesting topic from this research:\n\n{{research}}\n\nInclude: hook (30s), main content (6m), CTA (30s). Use conversational language.',
        outputKey: 'script',
      },
      {
        id: 's3',
        name: 'Voiceover',
        provider: 'elevenlabs',
        prompt: 'Generate a professional voiceover for this script using a confident, engaging voice:\n\n{{script}}',
        outputKey: 'voiceover',
      },
      {
        id: 's4',
        name: 'Video Visuals',
        provider: 'runway',
        prompt: 'Generate cinematic B-roll footage and visual transitions to accompany the voiceover. Style: modern, high-energy. Script reference:\n\n{{script}}',
        outputKey: 'video',
      },
      {
        id: 's5',
        name: 'Publish & Schedule',
        provider: 'lindy',
        prompt: 'Schedule and publish this YouTube video at optimal time. Generate: title, description, tags, thumbnail text. Video: {{video}}',
        outputKey: 'published',
      },
    ],
  },
  {
    id: 'game-creator',
    name: 'Game Creator',
    description: 'Design a complete mobile game concept with assets and voices',
    category: 'game',
    icon: '🎮',
    gradient: 'linear-gradient(135deg, #10a37f 0%, #6366f1 100%)',
    authorName: 'Apex Team',
    uses: 873,
    steps: [
      {
        id: 's1',
        name: 'Game Concept',
        provider: 'openai',
        prompt: 'Create an original mobile game concept for: {{idea}}\n\nInclude: genre, core loop, unique mechanic, target audience, monetization. Keep it innovative and marketable.',
        outputKey: 'concept',
      },
      {
        id: 's2',
        name: 'Research Market',
        provider: 'perplexity',
        prompt: 'Research similar games to this concept and find gaps we can exploit:\n\n{{concept}}\n\nFind: top competitors, their ratings, what players complain about, revenue data.',
        outputKey: 'research',
      },
      {
        id: 's3',
        name: 'Game Design Doc',
        provider: 'claude',
        prompt: 'Write a complete Game Design Document (GDD) based on:\n\nConcept: {{concept}}\nMarket Research: {{research}}\n\nInclude: mechanics, levels, progression, UI flows, technical specs.',
        outputKey: 'gdd',
      },
      {
        id: 's4',
        name: 'Visual Assets',
        provider: 'runway',
        prompt: 'Generate game art assets: characters, backgrounds, UI elements. Style based on GDD:\n\n{{gdd}}',
        outputKey: 'assets',
      },
      {
        id: 's5',
        name: 'Character Voices',
        provider: 'elevenlabs',
        prompt: 'Generate character voice samples for the main characters described in:\n\n{{gdd}}',
        outputKey: 'voices',
      },
    ],
  },
  {
    id: 'podcast-creator',
    name: 'Podcast Episode',
    description: 'Research, script, and produce a podcast episode with AI voices',
    category: 'podcast',
    icon: '🎙️',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)',
    authorName: 'Apex Team',
    uses: 612,
    steps: [
      {
        id: 's1',
        name: 'Topic Research',
        provider: 'perplexity',
        prompt: 'Research everything about this podcast topic: {{topic}}\n\nFind: key facts, expert opinions, recent news, controversial angles, stats to cite.',
        outputKey: 'research',
      },
      {
        id: 's2',
        name: 'Episode Script',
        provider: 'claude',
        prompt: 'Write a 20-minute podcast episode script on {{topic}} using this research:\n\n{{research}}\n\nFormat as host dialogue with clear segments. Include intro, 3 main points, outro.',
        outputKey: 'script',
      },
      {
        id: 's3',
        name: 'Host Voice',
        provider: 'elevenlabs',
        prompt: 'Generate podcast audio with natural host voice:\n\n{{script}}',
        outputKey: 'audio',
      },
      {
        id: 's4',
        name: 'Show Notes',
        provider: 'openai',
        prompt: 'Create comprehensive show notes for this episode:\n\nScript: {{script}}\n\nInclude: summary, timestamps, key takeaways, links to research.',
        outputKey: 'notes',
      },
    ],
  },
  {
    id: 'blog-post',
    name: 'Blog Post Machine',
    description: 'Research and write an SEO-optimized blog post that ranks',
    category: 'blog',
    icon: '✍️',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #10a37f 100%)',
    authorName: 'Apex Team',
    uses: 2100,
    steps: [
      {
        id: 's1',
        name: 'SEO Research',
        provider: 'perplexity',
        prompt: 'Research SEO opportunities for: {{topic}}\n\nFind: high-volume keywords, questions people ask, competing articles, content gaps, ideal word count.',
        outputKey: 'seo',
      },
      {
        id: 's2',
        name: 'Outline',
        provider: 'openai',
        prompt: 'Create a detailed blog post outline for {{topic}} optimized for these SEO opportunities:\n\n{{seo}}\n\nInclude: H2/H3 headings, word count targets per section, internal link opportunities.',
        outputKey: 'outline',
      },
      {
        id: 's3',
        name: 'Write Article',
        provider: 'claude',
        prompt: 'Write the full blog post following this outline:\n\n{{outline}}\n\nStyle: expert but approachable, include data from research:\n{{seo}}\n\nTarget: 1500-2000 words.',
        outputKey: 'article',
      },
      {
        id: 's4',
        name: 'Visual Docs',
        provider: 'napkin',
        prompt: 'Create supporting infographics and diagrams for this article:\n\n{{article}}',
        outputKey: 'visuals',
      },
    ],
  },
  {
    id: 'social-campaign',
    name: 'Social Media Campaign',
    description: 'Generate a full multi-platform social campaign in minutes',
    category: 'marketing',
    icon: '📱',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea4335 100%)',
    authorName: 'Apex Team',
    uses: 1560,
    steps: [
      {
        id: 's1',
        name: 'Campaign Strategy',
        provider: 'claude',
        prompt: 'Create a 30-day social media campaign strategy for: {{brand}}\n\nGoal: {{goal}}\n\nInclude: content pillars, posting schedule, platform strategy (IG/TT/X/LinkedIn), KPIs.',
        outputKey: 'strategy',
      },
      {
        id: 's2',
        name: 'Content Creation',
        provider: 'openai',
        prompt: 'Write 10 post captions, 5 hooks, and 3 thread starters based on this strategy:\n\n{{strategy}}\n\nEach piece should be platform-optimized.',
        outputKey: 'content',
      },
      {
        id: 's3',
        name: 'Visual Assets',
        provider: 'runway',
        prompt: 'Generate social media visual assets (reels, stories, carousels) for the campaign content:\n\n{{content}}',
        outputKey: 'visuals',
      },
      {
        id: 's4',
        name: 'Auto-Publish',
        provider: 'lindy',
        prompt: 'Schedule and publish all content across platforms per the strategy:\n\n{{strategy}}\n\nContent: {{content}}\nVisuals: {{visuals}}',
        outputKey: 'published',
      },
    ],
  },
  {
    id: 'ai-collaboration',
    name: 'AI Collaboration Mode',
    description: 'Multiple AIs tackle your problem together, each bringing unique strengths',
    category: 'thinking',
    icon: '🤝',
    gradient: 'linear-gradient(135deg, #ffcc33 0%, #ff6b35 100%)',
    authorName: 'Apex Team',
    uses: 3200,
    steps: [
      {
        id: 's1',
        name: 'Idea Generation',
        provider: 'openai',
        prompt: 'Generate 5 creative approaches to: {{challenge}}\n\nBe bold and unconventional. Each idea should be distinctly different.',
        outputKey: 'ideas',
      },
      {
        id: 's2',
        name: 'Research & Context',
        provider: 'perplexity',
        prompt: 'Research the background, market context, and existing solutions for:\n\n{{challenge}}\n\nAlso evaluate these ideas:\n{{ideas}}',
        outputKey: 'research',
      },
      {
        id: 's3',
        name: 'Deep Analysis',
        provider: 'claude',
        prompt: 'Deeply analyze all input and create the best actionable plan:\n\nChallenge: {{challenge}}\nIdeas: {{ideas}}\nResearch: {{research}}\n\nProvide a structured execution plan.',
        outputKey: 'plan',
      },
      {
        id: 's4',
        name: 'Visual Summary',
        provider: 'napkin',
        prompt: 'Create a visual diagram/mind map of the execution plan:\n\n{{plan}}',
        outputKey: 'diagram',
      },
    ],
  },
];

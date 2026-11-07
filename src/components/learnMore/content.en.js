const en = {
  hero: {
    back: "Back to home",
    badge: "How Consenz works",
    title: "One document. A whole community. Consensus you can measure.",
    subtitle:
      "Consenz is a platform for drafting policy documents, bylaws and decisions together. Anyone can propose a change, every change opens to discussion and a transparent vote, and the document only changes once the community reaches the support threshold it set for itself.",
    primaryCta: "Tour the platform",
    secondaryCta: "Sign in",
    note: "Proposals, arguments and votes — all visible, all recorded, all attached to the text.",
    cardLabel: "Example of an open proposal",
    cardTitle: "Amendment to section 2.3 — quarterly reporting",
    cardDate: "04.05.2026",
    cardTime: "15:05",
    cardBody:
      "The quarterly report will be submitted within 15 days of the quarter's end, published to all participants, and opened for discussion before approval.",
    cardPro: "For",
    cardCon: "Against",
    cardThreshold: "Support threshold",
    cardResult: "The proposal passes the threshold",
    cardFootnote: "The gap between for and against reaches the document threshold",
  },
  pillars: {
    title: "The principle behind every screen",
    subtitle: "Three rules hold the whole process together — from the first proposal to the final version.",
    items: [
      {
        icon: "eye",
        title: "Complete transparency",
        text: "Every proposal, argument and vote is visible to all participants. No committee drafts behind closed doors — the document carries the story of its own changes.",
      },
      {
        icon: "scale",
        title: "Measurable consensus",
        text: "Agreement is not a feeling, it is a number. The support threshold is derived from the level of agreement the community has actually reached, and updates with every decision.",
      },
      {
        icon: "refresh",
        title: "A living document",
        text: "Every change is saved as a version. Compare, restore, reopen the discussion and keep building on what was already agreed — without losing the trail.",
      },
    ],
  },
  how: {
    title: "How it works, step by step",
    subtitle: "From an idea to an approved wording — five steps, no intermediaries.",
    steps: [
      {
        icon: "filePlus",
        title: "Open a document",
        text: "Start from a blank document or upload a PDF or Word file — topics and sections are extracted automatically. Set who takes part, how long a proposal stays open, and whether the points system applies.",
        chips: ["Manual creation", "PDF or Word upload", "Automatic extraction"],
      },
      {
        icon: "pencil",
        title: "Propose a change exactly where it belongs",
        text: "Edit a section, add a new one, rename a topic, or even edit an existing proposal. Before publishing, the system checks for similar proposals — so support is not split across duplicates.",
        chips: ["Edit a section", "New section", "Rename a topic", "Similar proposal check"],
      },
      {
        icon: "messages",
        title: "Discuss with arguments",
        text: "Every proposal carries its own conversation: arguments for and against, comments on the section, replies and likes. The discussion stays next to the text it is about.",
        chips: ["For and against arguments", "Section comments", "Replies and likes"],
      },
      {
        icon: "vote",
        title: "Vote",
        text: "For or against, once per proposal. Each proposal has its own timer, and the votes are counted when it ends. You can also vote on a section current wording — to keep it or remove it.",
        chips: ["For and against votes", "Voting period timer", "Votes on existing wording"],
      },
      {
        icon: "check",
        title: "The document updates",
        text: "A proposal that reaches the support threshold enters the text automatically, is saved as a new version and documented: who proposed it, what the previous wording was and what changed. Every version can be restored, and a summary can be sent to participants.",
        chips: ["Automatic approval", "A documented new version", "Restore and compare"],
      },
    ],
  },
  consensus: {
    overline: "The engine under the hood",
    title: "Consensus is not a feeling. It is a calculation.",
    subtitle:
      "The support threshold in each document is set by the community itself — based on the level of agreement it actually reaches. Three formulas, all public.",
    formulas: [
      {
        title: "Consensus score per proposal",
        text: "Every accepted proposal is scored between 0% and 100%: 50% means a balance of for and against, 100% means full support.",
      },
      {
        title: "The document consensus meter",
        text: "The average consensus score of every accepted proposal in the document. It summarises how agreed the wording is overall.",
      },
      {
        title: "The support threshold",
        text: "The consensus meter multiplied by the number of participants (minimum 2). A proposal passes when the gap between for and against reaches the threshold.",
      },
    ],
    exampleLabel: "Example",
    exampleText:
      "A document has 20 participants and a consensus meter of 50%. The support threshold is 10 — a proposal passes only when the gap between for and against reaches 10 or more.",
    exampleNote:
      "Proposals that keep broad agreement raise the bar for what comes next; divisive decisions lower it. The community decides for itself how hard it is to change the wording.",
    link: "Read the full consensus explainer",
  },
  capabilities: {
    title: "What else is inside",
    subtitle: "The tools that let a process last — not just one debate.",
    items: [
      {
        icon: "history",
        title: "Version history",
        text: "Every change is logged with its date, author and previous wording. Compare versions, restore an earlier one and follow how the text evolved.",
      },
      {
        icon: "duplicate",
        title: "Similar proposal check",
        text: "Before publishing, the system shows sections and proposals that already touch your change — and invites you to support them instead of splitting the vote.",
      },
      {
        icon: "languages",
        title: "Hebrew, Arabic and English",
        text: "Every document is translated into the language you read, including content, proposals and comments. You can also suggest translation fixes for community review.",
      },
      {
        icon: "users",
        title: "Groups and permissions",
        text: "Documents live inside groups, with group admins, join requests and invitations. The people it concerns are notified about every new proposal.",
      },
      {
        icon: "shield",
        title: "Document administration",
        text: "Document admins set the voting period, privacy and points policy, and can approve or reject exceptions — with an approval that is recorded and shown separately.",
      },
      {
        icon: "sparkles",
        title: "Smart summaries",
        text: "A summary of the document and its discussion at any moment, plus a digest email to participants — so nobody has to re-read everything.",
      },
      {
        icon: "bell",
        title: "Notifications and messages",
        text: "An alert for every proposal, comment or vote that involves you, and direct messages between participants — so the discussion does not fall through.",
      },
      {
        icon: "signature",
        title: "Expressing agreement",
        text: "When the wording settles, participants can express agreement with the document as a whole — a defined finishing point that does not stop the conversation.",
      },
      {
        icon: "download",
        title: "Export and print",
        text: "Download the document exactly as it is shown now, in any language you choose, in a clean format ready to print or share.",
      },
    ],
  },
  points: {
    title: "Points: an incentive for quality, not a barrier",
    subtitle: "An optional system enabled per document. It rewards contributions the community supports and filters out hasty proposals.",
    logicTitle: "The logic behind the numbers",
    logicIntro: "Points are not a penalty. They put a small price on every action that asks to change the wording, and a reward on every action that moves the community toward agreement — so the community's attention goes where it advances the document.",
    principles: [
      {
        title: "A small cost filters haste",
        text: "Every proposal costs something, so a participant thinks twice before opening a third proposal on the same sentence. It blocks no one — the 1,000 starting points cover real participation — but it makes flooding expensive.",
      },
      {
        title: "Noise is paid for by whoever makes it",
        text: "In an open forum every message is free, so discussion fills with duplicates and abandoned proposals. When the cost sits with the proposer, a line appears between flooding and precision, and the community gets fewer proposals that are far more relevant.",
      },
      {
        title: "Rewards follow those who build agreement",
        text: "Points come back for support a proposal received, for a proposal that passes and for a vote that decided it; a comment that earns likes pays too. Whoever invests in wording and persuasion earns — not whoever simply writes the most.",
      },
    ],
    logicClosing: "In short: fewer proposals, more support behind each one, and a discussion that moves toward agreed wording instead of circling itself.",
    costsTitle: "Costs",
    costs: [
      { label: "Opening a new document", value: "1,001" },
      { label: "New section proposal", value: "350" },
      { label: "Editing an existing section", value: "200" },
      { label: "Renaming a topic", value: "100" },
    ],
    costsNote: "Opening a document is free for system admins and group admins.",
    rewardsTitle: "Rewards",
    rewards: [
      { label: "A for vote on your proposal", value: "+10" },
      { label: "Your proposal is accepted", value: "+500" },
      { label: "Your vote made the proposal pass", value: "+50" },
      { label: "A like on your comment", value: "+5" },
    ],
    rewardsNote: "Every new participant starts with 1,000 points. In documents without the points system, every proposal is open to everyone at no cost.",
  },
  audiences: {
    title: "Built for anywhere one wording has to speak for many",
    items: ["Committees and bylaws", "Communities and neighbourhoods", "Organisations and nonprofits", "Student councils", "Movements and circles"],
  },
  cta: {
    title: "Your next agreement starts with one draft",
    subtitle: "Open a document, invite the people it concerns, and let the process do the work.",
    primary: "Tour the platform",
    secondary: "Sign in",
  },
};

export default en;
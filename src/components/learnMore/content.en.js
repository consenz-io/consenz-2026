const en = {
  hero: {
    back: "Back to home",
    badge: "How Consenz works",
    title: "Building consensus together: transparent, efficient and enjoyable",
    subtitle:
      "Consenz is a platform for drafting policy documents, bylaws and decisions together. Anyone can propose a change, every change opens to discussion and a transparent vote, and the document only changes once the community reaches the support threshold it set for itself.",
    primaryCta: "Tour the platform",
    secondaryCta: "Sign in",
    note: "Proposals, arguments and votes — all visible, all recorded, all attached to the text.",
    cardOriginal:
      "<p>The document shall be submitted once a year, within 30 days of the end of the activity year, and brought to the general assembly for approval.</p>",
    cardViews: [
      {
        author: "Noa L.",
        createdDate: "2026-05-04T15:05:00.000Z",
        proposed:
          "<p>The quarterly report will be submitted within 15 days of the quarter's end, published to all participants, and opened for discussion before approval.</p>",
        explanation:
          "More frequent reporting lets the community follow decisions as they happen, not only at the end of the year.",
        proVotes: 3,
        conVotes: 0,
        comments: 2,
      },
      {
        author: "Itai B.",
        createdDate: "2026-05-05T11:40:00.000Z",
        proposed:
          "<p>A short monthly update will be published on the participants dashboard, with a full quarterly report detailing expenses and decisions.</p>",
        explanation:
          "Ongoing transparency for every participant, without loading the drafting committee with a full report each month.",
        proVotes: 6,
        conVotes: 2,
        comments: 4,
      },
      {
        author: "Maya K.",
        createdDate: "2026-05-06T18:12:00.000Z",
        proposed:
          "<p>A report will be submitted only when spending exceeds the approved budget by more than 10%, or at the request of five participants.</p>",
        explanation:
          "Exception-based reporting keeps routine months quiet and focuses the discussion on what really needs attention.",
        proVotes: 9,
        conVotes: 3,
        comments: 1,
      },
    ],
  },
  pillars: {
    title: "Big groups, one wording",
    subtitle: "Three rules that keep a debate among many participants from scattering.",
    flow: ["Proposal", "Arguments", "Vote", "Updated wording"],
    items: [
      {
        icon: "eye",
        title: "Complete transparency",
        text: "Every proposal, argument and vote is public, attached to the section it changes. Even someone who joined yesterday can see where the debate stands.",
        stat: "All visible, all recorded",
      },
      {
        icon: "scale",
        title: "Measurable consensus",
        text: "Agreement is a number, not the loudest voice: one vote per participant, and a threshold derived from the agreement the group reached.",
        stat: "One vote per participant",
      },
      {
        icon: "refresh",
        title: "A living document",
        text: "Every change is saved as a version. Compare, restore and keep building on what was agreed — even after hundreds of votes.",
        stat: "Every version recorded",
      },
    ],
    closing: "The result: one converging debate, one clear consensus, the same rules for everyone — even in a very large community.",
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
    loop: {
      title: "The update does not close the discussion",
      text: "Every update opens a new round: back to step 1, while each section runs its own debate — with its own timer and votes.",
      chips: ["Back to step 1", "Parallel debates", "An ongoing cycle"],
    },
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
    dynamicTitle: "The bar moves with you",
    dynamicText:
      "The consensus meter is not a fixed value but a live measurement: every accepted proposal enters the calculation, raises or lowers the average, and instantly updates the support threshold for the proposals that follow. The process calibrates itself to the level of agreement the community actually reaches, instead of being stuck on a bar set once at the start.",
    balanceTitle: "A balance between flexible and fixed",
    balanceText:
      "The consensus meter also sets how open the wording is to change: when agreement runs high the threshold rises and the community protects agreed wording from churn; when it runs low the threshold falls and the text opens up again to debate and correction. The result is a balance between wording that can evolve and wording that holds.",
    spectrum: {
      title: "How consensus builds, stage by stage",
      levelLabel: "Consensus level",
      dynamicPole: "Dynamism — easy to change",
      stablePole: "Stability — built to last",
      hint: "Step through the stages: participants join, the vote split changes, and the threshold and consensus meter respond.",
      simulatorLabel: "Guided demo",
      stepLabel: "Stage {n} of {total}",
      prevLabel: "Previous stage",
      nextLabel: "Next stage",
      growthNote: "{n} more participants than the previous stage",
      participantsLabel: "participants",
      supporters: "supporters",
      votedLabel: "voted",
      undecidedLabel: "have not voted",
      proLabel: "For",
      conLabel: "Against",
      thresholdLabel: "Required support threshold",
      thresholdNote: "The threshold rises with the number of participants: the same consensus percentage needs more supporters as the circle grows.",
      failedLabel: "Not enough support yet",
      remainingOne: "One more supporter and the proposal passes.",
      remainingMany: "{n} more supporters and the proposal passes.",
      passNote: "The proposal passes. At this group size the next proposal needs {next} supporters instead of {prev}.",
      states: [
        "Low consensus: the threshold drops, the wording stays open to frequent changes and gets rebuilt again and again.",
        "Medium consensus: the wording evolves without flipping over — every change has to persuade, but it can happen.",
        "High consensus: the threshold rises and the agreed wording is protected from changes. Only what is really needed gets changed.",
      ],
    },
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
    title: "How the points system keeps the discussion focused",
    subtitle: "Every action in a document has a small price in points, set in advance and known to everyone. That is what filters out unnecessary proposals and leaves what really matters.",
    logicTitle: "In short, how it works",
    logicIntro: "Instead of a system admin censoring proposals, deleting them or approving them, every action in a document has a price in points. The amount is fixed, the same for every participant, and published in advance. Every new participant starts with 1,000 points, and every vote in favour of a proposal pays points back to the person who proposed it. Participants who prove a positive contribution to the process, by earning support from the community, grow their reach and influence, while the reach of those who create noise that does not help the document move toward consensus shrinks.",
    stepsTitle: "Four steps, with an example for each",
    steps: [
      {
        title: "You open a proposal and pay for it in points",
        text: "A proposal for a new section costs 350 points, and a change to an existing section costs 200. Not a large amount, but enough to make you think for a moment whether the proposal is really needed.",
        example: "Example: you had 1,000 points, you published a proposal for a new section, and 650 are left.",
      },
      {
        title: "Every vote in favour pays points back",
        text: "Each vote for your proposal pays you 10 points, even if the proposal does not pass in the end.",
        example: "Example: 12 participants voted for your proposal, so you got 120 points back.",
      },
      {
        title: "The proposal is accepted and the reward grows",
        text: "When the proposal reaches the vote threshold and is accepted into the document, its author receives 500 points, and whoever's vote decided it receives 50.",
        example: "Example: the proposal passed. Its author got 500 points, and the person whose vote tipped it got 50.",
      },
      {
        title: "A proposal that goes nowhere closes on its own",
        text: "If support does not arrive before the voting time ends, the proposal closes automatically. Nobody deletes it and nobody gets blocked.",
        example: "Example: 72 hours passed with no support, so the proposal closed and the points it cost are not returned.",
      },
    ],
    uniqueTitle: "Why this is good for the community",
    uniquePoints: [
      "No censorship: no person decides which proposal gets in and which is deleted. The rule is the same for everyone and known in advance.",
      "The price does the filtering: every participant decides for themselves whether their proposal is worth the points.",
      "New content adds noise, a vote does not: every proposal, an edit proposal for instance, adds more wording to read and compare. A vote adds no words at all, it only makes clear what the community wants. That is why the points system rewards voting: voting is free, and whoever's vote decides a proposal earns points for it.",
      "Good contribution pays off: points come back for support you receive, for a proposal that is accepted, and for a comment people liked.",
    ],
    impactTitle: "How it looks in practice",
    impactText: "Fewer proposals arrive, but each one is worded better and gathers more support. Instead of twenty versions of the same change, there is one proposal that brings everyone around it.",
    spectrum: {
      title: "The spectrum: between noise and freedom of expression",
      noisePole: "Noise",
      freedomPole: "Freedom of expression",
      hint: "The points place the document in the middle: open to everyone's proposals, without being flooded by them.",
      markers: [
        {
          label: "Without points",
          text: "Every proposal goes in immediately. Support scatters across versions of the same change, and the document struggles to move forward.",
        },
        {
          label: "With points",
          text: "Every participant can still propose, but each proposal has a price, so people propose what really matters and spend their attention voting on the rest.",
        },
      ],
    },
    costsTitle: "What each action costs",
    costs: [
      { label: "Opening a new document", value: "1,001" },
      { label: "A proposal for a new section", value: "350" },
      { label: "A change to an existing section", value: "200" },
      { label: "Renaming a topic", value: "100" },
    ],
    costsNote: "Opening a document is free for system admins and group admins.",
    rewardsTitle: "What you get back",
    rewards: [
      { label: "Each vote for your proposal", value: "+10" },
      { label: "Your proposal is accepted", value: "+500" },
      { label: "Your vote decided the proposal", value: "+50" },
      { label: "A like on your comment", value: "+5" },
    ],
    rewardsNote: "Every new participant starts with 1,000 points. In a document without the points system, every proposal is open to everyone for free.",
    closing: "All amounts are visible in advance, and every participant can see how many points they have, what they spent them on and what they earned. The result: a document where every section passed a real community vote, and participation that stays open to everyone — you can vote and comment for free, even without opening a proposal.",
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
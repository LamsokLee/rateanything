# RateAnything / HotTake — Product Doc

## 1. Problem Statement

### 1.1 The Gap
There is no universal platform in the US where anyone can create a topic with defined options, rate those options, and debate them publicly with mandatory hot takes. Existing platforms are either:
- **Niche**: IMDB (movies), Yelp (restaurants), RateMyProfessors, Glassdoor
- **Unstructured**: Reddit (text debate, no scoring), Twitter/X (ephemeral, no aggregation)
- **Passive**: Rotten Tomatoes (critic scores, no debate)
- **No topic gating**: You can't just rate anything — you need a structured topic with options first

### 1.2 The Core Insight
**Hupu** (虎扑评分) proves the model works at scale in China:
- Post-game player ratings generate 100K+ votes within hours
- The *mandatory comment* with each rating creates natural debate threads
- Controversial scores (e.g., a star player getting 3/10) become memes that spread across social media
- The platform has become the de facto "public court of opinion" for sports, entertainment, and culture

### 1.3 Why This Is Different
- **Topic-first**: You can't rate something without a topic existing. The topic creator defines the options to rate.
- **Per-option ratings**: Within a topic, each option gets its own 1-10 score
- **Universal**: Like Polymarket, anyone can create a topic on anything. No gatekeepers.
- **Continuous**: Topics don't resolve or settle — they live as long as people care
- **The score is the story**: "LeBron rated 6.4/10 by the internet" is the viral headline
- **Comments are the content**: Debate threads under each rating are the entertainment

### 1.4 Why the US Market is Open
- No English-language equivalent exists with the same mechanics
- US audiences are trained by Reddit, Twitter, and sports talk radio to debate publicly
- Sports culture (ESPN, Barstool, First Take) proves Americans love hot takes
- The "rating + explanation" format is native to US internet culture but not productized
- Existing platforms are either too narrow (niche sites) or too unstructured (social media)

---

## 2. Vision

**Polymarket for opinions.** A universal rating platform where anyone can create a topic on anything, the crowd rates it, and the aggregate becomes a living measure of public sentiment.

### What That Means
- **Universality**: Like Polymarket lets anyone create a prediction market, we let anyone create a rating topic
- **No gatekeepers**: The crowd decides what's worth rating — not editors, not algorithms
- **Real-time**: Scores shift live as people engage
- **The score IS the content**: "The internet rates LeBron 6.4/10" is the headline
- **Continuous**: Topics don't settle — they live forever (or until interest dies)
- **Debate**: The comments are the entertainment, the score is the hook

**Tagline**: *"Rate anything. The world is watching."*

---

## 3. Target Users & Personas

### 3.1 Primary Segments

| Segment | Use Case | Example Topic |
|---------|----------|---------------|
| **Sports fans** | Post-game player/team ratings | "Rate Jayson Tatum's Game 7 performance" |
| **Movie/TV buffs** | Rate and debate entertainment | "Rate The Bear Season 3" |
| **Tech enthusiasts** | Gadget reviews, brand debates | "Rate Apple Intelligence (iOS 18)" |
| **Foodies** | Restaurant, dish, chain ratings | "Rate In-N-Out vs Shake Shack" |
| **Politics/news** | Rate speeches, decisions, figures | "Rate Biden's debate performance" |
| **Meme/culture** | Rate anything viral, joke ratings | "Rate the Roman Empire trend" |
| **Gamers** | Game ratings, character ratings | "Rate the GTA 6 trailer" |

### 3.2 User Personas

**The Sports Fan (Alex)**
- Watches games live, immediately opens app to rate players
- Writes passionate, sometimes angry comments
- Follows other fans with similar team allegiance
- Shares controversial ratings on Twitter/X

**The Contrarian (Sam)**
- Rates everything opposite of popular opinion
- Has "Contrarian" badge on profile
- Generates engagement by being intentionally provocative
- Gets followers who love/hate their takes

**The Casual Browser (Jordan)**
- Doesn't rate often, but reads comments for entertainment
- Checks "Most Controversial" section daily
- Shares funny/insightful comments
- Converts to rater when they feel strongly

**The Topic Creator (Taylor)**
- First to create topics for new events
- Has "Topic Creator" badge
- Followed for being "in the know"
- Feels ownership over popular topics

---

## 4. Core Features

### 4.1 Topic System

#### Creating a Topic
```
[Create Topic Button]
  ↓
Title: [_____________________] (max 100 chars)
Category: [Dropdown / Auto-suggest]
Description: [Optional, max 500 chars]
Image: [Optional upload or URL]
Source Link: [Optional URL]
  ↓
Options to rate:
[Option 1: _____________________]
[Option 2: _____________________]
[Option 3: _____________________] (add more)
  ↓
[Create Topic] → Live immediately (with basic moderation)
```

**Topic Rules:**
- Title must be a clear rating prompt ("Rate X")
- Topic creator defines the options to rate within that topic
- Users cannot rate arbitrary things — only options within a topic
- No duplicate topics (auto-detect via similarity)

**Duplicate Detection:**
- On topic creation, compute trigram similarity against existing active topics in same category
- Threshold: >0.7 trigram similarity → show 'Similar topic exists' with link, allow override
- Threshold: >0.9 → block creation, suggest the existing topic
- For auto-generated topics (Phase 2): exact match on event ID from sports/entertainment API prevents duplication
- User-created vs auto-created conflict: user topic takes priority if created first; auto-gen merges into existing
- Community flagging for off-topic/spam
- Auto-categories: Sports, Movies/TV, Tech, Food, Politics, Gaming, Music, Culture, Other

**Example Topics:**
```
Topic: "Rate the Lakers vs Warriors Game 7"
Options:
- LeBron James
- Stephen Curry
- Anthony Davis
- Draymond Green
- Steve Kerr (coaching)
- Referee performance

Topic: "Best Fast Food Burger Chain"
Options:
- In-N-Out
- Shake Shack
- Five Guys
- Whataburger
- McDonald's
```

#### Topic Lifecycle
```
Created → Active (receiving ratings) → Trending (homepage) → Archived (7 days no activity)
  ↓
Auto-close after 30 days of inactivity (ratings locked, comments open)
Creator can manually close
```

#### Open Question: Can Users Add Options?
- **Option A (Locked)**: Only creator can define options. Set in stone at creation.
- **Option B (Community)**: Users can suggest new options, creator or community votes to add.
- **Option C (Free-for-all)**: Anyone can add options. Risk: chaos, spam.
- **~~Current stance~~** ✅ DECIDED: Creator decides at topic creation. Locked vs. open is a per-topic setting.

#### Topic States
- **Live**: Accepting ratings and comments
- **Closing Soon**: Last 24h before auto-close
- **Closed**: Ratings locked, read-only comments
- **Pinned**: By moderators for important events

### 4.2 Rating System

#### Topic Structure
A topic is a container with multiple **options** to rate. Each option gets its own aggregate score and individual ratings.

```
Topic: "Rate the Lakers vs Warriors Game 7"

Option: LeBron James
  Average: 8.5/10 | 14,237 ratings
  Distribution: ████░░░░██
  [Rate This Option →]

Option: Stephen Curry
  Average: 9.2/10 | 14,198 ratings
  Distribution: ████████░░
  [Rate This Option →]

Option: Anthony Davis
  Average: 6.1/10 | 12,432 ratings
  Distribution: ████░░░░░░
  [Rate This Option →]
```

#### Rating Flow (Per Option)
```
User clicks "Rate This Option" on LeBron James
  ↓
[Slider: 1-10] or [Tap 1-10 buttons]
  ↓
Comment (optional, but recommended, max 500 chars):
[______________________________]
  ↓
Optional Tags:
[ ] 🔥 Hot Take (controversial opinion)
[ ] 🤡 Overrated (thinks option is overrated)
[ ] 💀 Underrated (thinks option is underrated)
[ ] 📊 Stat Head (data-driven argument)
[ ] 😂 Meme (joke/meme rating)
  ↓
[Submit Rating]
```

#### Rating Rules
- One rating per user per option per topic (editable anytime)
- Guest ratings allowed (capped at 3 topics per device, captcha required)
- Guest identified by device fingerprint (IP + user agent + canvas fingerprint)
- Ratings can be changed anytime (no restrictions)
- Comments are **optional** — rated items without comments still count. Strong incentives encourage commenting (see below) but it is never required
- Can rate all options in a topic or just some

#### Comment Incentives (Hybrid Model)
Comments are optional, but commented ratings get significant advantages:

| Feature | Commented Rating | Vote-only Rating |
|---------|------------------|------------------|
| Algorithmic sort | Shown first (boosted) | Shown last |
| Weight in average | Equal (1.0x) — weighted scoring deferred to Phase 2 | Equal (1.0x) |
| Shareable card | Yes (with quote) | No (just score) |
| Badge progress | Counts toward badges | Does not count |
| Reply eligibility | Others can reply to your rating | No reply thread |
| Profile visibility | Shows in "Recent Ratings" with comment | Just score |

**Why this works:**
- Low friction: Anyone can vote 1-10 freely
- Viral content: Commented ratings create debate threads
- Social signal: Commented ratings are "real takes" — vote-only is "just a number"
- Gamification: People write comments to get boosted, earn badges, and be seen

#### Score Calculation

**MVP: Simple average (no weighting)**
```
Displayed Score = sum(all ratings for option) / count(ratings)
```

All ratings count equally — guest or verified, with comment or without. This keeps the system transparent, easy to understand, and simple to implement.

**Phase 2: Weighted scoring (post-launch, based on observed abuse patterns)**

Once the platform has enough data to identify actual manipulation (not hypothetical), introduce weighting:
- Comment bonus: 1.2x for ratings with comments
- Verified accounts: 1.1x
- Account age > 30 days: 1.05x
- Guest/unverified: 0.8x
- Multiplicative, capped at 1.5x max
- Outlier detection: ratings >2σ from mean flagged for review

> **Why defer weighting:** Weighted scoring adds complexity, creates perceived unfairness ("my vote counts less?"), and solves a problem (manipulation) that doesn’t exist at launch scale. Ship simple, add complexity only when data proves it’s needed.

### 4.3 Topic Page Layout

```
┌─────────────────────────────────────────┐
│  [Category] Topic Title                │
│  Created by @user • 2h ago             │
│  "Description of this topic..."          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Option 1: LeBron James          │   │
│  │                                 │   │
│  │        ★★★★☆ 8.5/10            │   │
│  │      14,237 ratings             │   │
│  │                                 │   │
│  │  1  2  3  4  5  6  7  8  9  10 │   │
│  │  ░░██░░██░░██░░██░░██░░██░░██░░ │   │
│  │     ↑ bell curve (good)         │   │
│  │                                 │   │
│  │  [Rate This Option →]           │   │
│  │                                 │   │
│  │  💀 @user1 rated 2/10           │   │
│  │  "Overrated, he missed 3 FTs"    │   │
│  │  2.4K 👍  418 💬                 │   │
│  │                                 │   │
│  │  🔥 @user2 rated 9/10            │   │
│  │  "Carried the whole team"        │   │
│  │  1.8K 👍  312 💬                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Option 2: Stephen Curry         │   │
│  │                                 │   │
│  │        ★★★★★ 9.2/10            │   │
│  │      14,198 ratings             │   │
│  │                                 │   │
│  │  1  2  3  4  5  6  7  8  9  10 │   │
│  │  ░░██░░██░░██░░██░░██░░██░░██░░ │   │
│  │                                 │   │
│  │  [Rate This Option →]           │   │
│  │                                 │   │
│  │  [Top comments...]                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Load more options]                    │
└─────────────────────────────────────────┘
```

#### Option Card Components
Each option within a topic is its own card with:
- **Option name** (e.g., "LeBron James")
- **Average score** (weighted, live-updated)
- **Total ratings count**
- **Distribution histogram** (10-bar visualization)
- **Top 2-3 comments** (highest engagement)
- **Rate button** (opens rating modal)
- **"View all comments"** link (expands to full thread)

#### Sorting
- **Topic-level**: By option average (highest to lowest), or alphabetical
- **Comment-level**: Hot | Controversial | Newest | Highest Rated | Lowest Rated

### 4.4 Comment/Debate System

#### Per-Option Threading
Each option has its own comment thread. Comments are tied to a specific rating on a specific option.

**Threading Model:**
- User rates "LeBron James" option → writes comment → comment appears in LeBron's thread
- Comments are **option-scoped** (not topic-scoped)
- 2-level nesting (comment + replies)
- Replies sorted by "Best" (engagement-weighted)
- Collapsible threads
- Highlight OP replies (creator of topic)

#### Example Comment Thread
```
Option: LeBron James — 8.5/10

💀 @contrarian rated 2/10
"Overrated, he missed 3 clutch FTs and 
 turned the ball over 4 times. Playoff 
 LeBron is a myth."
2.4K 👍  418 💬  3h ago
[Reply] [Share] [Report]

├── @fanboy: "He averaged 28/8/8 on 60% TS.  
│    You clearly didn't watch the game."
│    856 👍  1h ago
│
├── @neutral: "He was good but not great.  
│    7/10 is fair."
│    423 👍  2h ago
│
└── @stathead: "📊 His FT% was 71% this
     series vs 73% career. Within variance."
     312 👍  1h ago

🔥 @fanboy rated 9/10
"Carried the whole team. Without him 
 this is a 20-win team."
1.8K 👍  312 💬  4h ago
[Reply] [Share] [Report]
```

#### Engagement Actions
- 👍 Upvote comment (no downvotes — prevents negativity spiral)
- 💬 Reply to rating comment
- 🔗 Share specific rating (deep link to this option + comment)
- 🚩 Report (spam, harassment, off-topic)
- 📌 Save to personal collection

#### Comment Quality Signals
- "Top Contributor" badge (high engagement history)
- "Early Rater" badge (first 100 ratings on option)
- "Most Replied" indicator
- Verified checkmark for public figures (manual process)

### 4.5 Homepage & Discovery

#### Feed Sections

**Trending Now**
- Algorithm: (ratings in last 24h × comment velocity × share velocity) / time since creation
- Updates every 15 minutes
- Max 20 topics

**Most Controversial**
- Algorithm: Highest variance in ratings + high comment count
- Polarized topics (U-shaped distribution)
- Updates hourly

**Just Happened**
- Auto-generated topics from event feed
- Sports: game ended → player ratings live
- Entertainment: movie released → rate it
- News: major speech → rate the performance

**Rising Fast**
- Topics gaining velocity in last hour
- Early signal of virality

**Your Network**
- Topics rated by people you follow
- Comments from followed users highlighted

#### Categories Browse
```
Sports          Movies/TV       Tech
├── NBA         ├── Movies      ├── Phones
├── NFL         ├── TV Shows    ├── Laptops
├── Soccer      ├── Streaming   ├── AI/Tools
├── Esports     └── Anime       └── Gadgets

Food            Politics        Gaming
├── Restaurants ├── Figures     ├── Games
├── Chains      ├── Events      ├── Characters
├── Recipes     └── Policies    └── Trailers

Music           Culture         Other
├── Albums      ├── Memes       ├── Companies
├── Artists     ├── Trends      ├── Products
└── Songs       └── Viral       └── People
```

### 4.6 User Profiles

#### Public Profile
```
┌─────────────────────────────────────────┐
│  @username                              │
│  "Bio text"                             │
│  📍 Location (optional)                 │
│  Joined: Jan 2026                       │
│                                         │
│  Badges: 🔥 Hot Take ×12 | 💀 Contrarian│
│                                         │
│  Stats:                                 │
│  • 1,247 ratings given                  │
│  • 342 comments                         │
│  • 8.9K followers                       │
│  • Avg rating: 5.2/10 (tough critic)    │
│  • Controversy score: High (1.8σ)       │
│                                         │
│  [Follow] [Message]                     │
│                                         │
│  Tabs:                                  │
│  Ratings | Comments | Collections       │
│                                         │
│  Recent Ratings:                        │
│  iPhone 16 Pro — 3/10 💀               │
│  The Bear S3 — 9/10 🔥                 │
│  Biden Debate — 5/10                   │
└─────────────────────────────────────────┘
```

#### Badge System
| Badge | Criteria |
|-------|----------|
| 🔥 Hot Take | Comment with >1K upvotes on a controversial topic |
| 💀 Contrarian | Average deviation >1.5σ from mean across 20+ ratings |
| 🏆 Veteran | 500+ ratings given |
| 🎯 Early Bird | First 50 raters on a topic that hits 1K+ ratings |
| 📊 Stat Head | 10+ data-driven comments with >100 upvotes |
| 😂 Meme Lord | 10+ meme-tagged comments with >500 upvotes |
| 🎖️ Topic Creator | Created 10+ topics with 100+ ratings each |
| ⭐ Verified | Public figure (manual verification) |

#### Collections
Users can save topics to personal collections:
- "Movies to Watch" (rated highly by trusted users)
- "Controversial Takes" (funny/debate-worthy)
- "My Ratings" (auto-generated)
- Custom collections

### 4.7 Shareable Cards

Auto-generated images for social sharing, scoped to specific options:

**Option Rating Card**
```
┌─────────────────────────────┐
│  [Platform Logo]            │
│                             │
│  I rated LeBron James       │
│  in Lakers vs Warriors G7   │
│                             │
│       ★★★★☆                 │
│        8/10                 │
│                             │
│  "Carried the whole team."  │
│                             │
│  — @username                │
│                             │
│  [QR code to option]        │
│  rateanything.app           │
└─────────────────────────────┘
```

**Topic Summary Card**
```
┌─────────────────────────────┐
│  🔥 HOT TAKES 🔥            │
│                             │
│  Lakers vs Warriors G7      │
│                             │
│  LeBron James: 8.5/10       │
│  Stephen Curry: 9.2/10      │
│  Anthony Davis: 6.1/10      │
│                             │
│  See the debate →           │
│  rateanything.app           │
└─────────────────────────────┘
```

**Controversy Card (Per Option)**
```
┌─────────────────────────────┐
│  🔥 CONTROVERSIAL 🔥        │
│                             │
│  Anthony Davis              │
│  in Lakers vs Warriors G7   │
│                             │
│  Average: 6.1/10            │
│  But people are FIGHTING    │
│                             │
│  23% rated 9-10             │
│  31% rated 1-3              │
│                             │
│  See the debate →           │
│  rateanything.app           │
└─────────────────────────────┘
```

### 4.8 Notifications

**Push Notifications**
- "Your rating on [Option] is getting replies 🔥"
- "[Topic] you rated is trending!"
- "@user replied to your comment"
- "[Topic] is closing soon — last chance to rate"

**Email Digests**
- Daily: "Top controversial topics today"
- Weekly: "Your ratings this week + what's trending"
- Event-based: "Game ended — rate the players now"

**In-App**
- Reply notifications
- Follower notifications
- Trending topic alerts (categories you follow)
- Achievement/badge unlocks

### 4.9 Onboarding Flow

```
New user lands on topic page (from share card) ──┐
                                                  ↓
         [View topic + scores + comments]
                   ↓ (wants to rate)
         [Prompt: Sign up to rate]
                   ↓
         [Email / Google / Apple sign-up]
                   ↓
         [Choose username + optional bio]
                   ↓
         [Pick 3+ categories of interest]
                   ↓
         [Rate the topic they came for]
                   ↓
         [Homepage with personalized feed]
```

**Key Design Decisions:**
- No sign-up wall for READING — topic pages are fully public
- Sign-up triggered by INTENT TO ACT (rate, comment, follow)
- Guest can browse indefinitely; conversion happens at value moment
- Push notification permission asked AFTER first rating, not at onboard
- Username is the only required field (bio, location, avatar all optional)


---

## 5. Engagement Mechanics & Viral Loop

### 5.1 The Core Loop
```
Event happens (game ends, movie releases, news breaks)
    ↓
Topic created (auto or user)
    ↓
Notification to followers of category
    ↓
User rates option + writes hot take
    ↓
Comment gets engagement (upvotes, replies)
    ↓
User shares to Twitter/X/Instagram
    ↓
New users see share card → sign up
    ↓
They rate option + write their take
    ↓
Cycle repeats
```

**Failure Mode (Ghost Town Prevention):**
```
Topic created → gets < 5 ratings in 48h
    ↓
Not shown on homepage/trending (minimum threshold)
    ↓
Creator gets nudge: "Your topic needs ratings — share it!"
    ↓
If still < 5 after 7 days → moved to "Needs Love" discovery tab
    ↓
If 0 ratings after 14 days → auto-archived (not deleted)
```

**Anti-ghost-town tactics:**
- Homepage only shows topics with ≥10 ratings (quality floor)
- "Just Happened" feed auto-creates topics tied to real events (guarantees fresh content)
- Admin seeding ensures every category has ≥5 active topics at launch
- "Rate a random topic" CTA for users who’ve rated their feed dry

### 5.2 Event-Driven Acquisition

The core insight: **something notable happens in the world → a topic with clear ratable options materializes → time-sensitive urgency drives ratings.** Sports is the fastest example (games have a defined end-time) but the same loop applies to every category.

**Event Triggers by Category:**

| Category | Trigger | Data Source | Auto-Topic Example |
|----------|---------|-------------|--------------------|
| Sports | Game ends | ESPN / SportRadar API | "Rate Lakers vs Warriors G7 players" |
| Movies/TV | Release date / season drop | TMDB API | "Rate The Bear Season 4" |
| Tech | Product launch / keynote | Apple RSS, product feeds | "Rate Apple Intelligence at WWDC" |
| Music | Album drops | Spotify / MusicBrainz | "Rate Kendrick’s new album" |
| Gaming | Game release / major patch | IGDB / Steam API | "Rate GTA 6" |
| Politics/News | Debate / speech / policy | NewsAPI / manual seed | "Rate the presidential debate" |
| Food | Menu launch / viral restaurant | Manual seed / trends | "Rate McDonald’s Chicken Big Mac" |
| Culture/Viral | Trending on X/TikTok | Twitter Trends API / manual | "Rate the ‘demure’ trend" |

**Auto-Topic Generation (Phase 2):**
- Ingest events from category-specific APIs (see table)
- Auto-create topic with sensible default options (e.g., album → rate each track; game → rate gameplay/story/graphics)
- Dedup: if a user already created a matching topic, merge into it (user topic takes priority)
- Manual fallback: admin seeds topics for categories without reliable APIs (food, culture)

**Why event-driven works across all categories:**
- Creates natural urgency ("rate it while everyone’s talking about it")
- Guarantees fresh content without relying solely on user-generated topics
- Notifications to category followers drive immediate engagement spikes
- Share cards for timely events get maximum social pickup

### 5.3 Controversy as Content

The algorithm intentionally surfaces divisive topics:
- **U-shaped distributions** (love it or hate it) get homepage placement
- **Highest-rated comment from lowest-rated perspective** is featured
- "Most Replied" comments are pinned
- "Controversial" sort is default for high-variance topics

### 5.4 Social Dynamics

**Following System**
- Follow users whose taste you trust
- "Your Network" feed shows topics rated by followed users
- Follower count = social credibility

**Leaderboards**
- Top raters by category
- Most controversial raters
- Most followed
- Top topic creators
- Weekly/monthly/all-time

**Challenges (Phase 2)**
- "Rate 10 movies this week" → badge reward
- "Contrarian week" → rate opposite of your usual
- Category-specific challenges

---

## 6. Content Strategy & Seeding

### 6.1 Launch Strategy

**Week 1: Closed Beta (100 users)**
- Invite-only, cross-category: recruit from sports Twitter, tech Twitter, film/TV communities, and foodie circles (not just one vertical)
- Admin seeds 5+ topics per category to avoid ghost-town on any tab
- Focus on core loop validation: do people rate, comment, and share?
- Collect feedback, iterate on UX friction

**Week 2-3: Open Beta**
- Public signup, all categories live from day one
- Lean into whatever category gets natural traction (don't force sports if tech or movies take off first)
- Influencer outreach: 2-3 micro-influencers per category (not just sports — tech YouTubers, Letterboxd power users, food bloggers)
- Target: 1K signups, identify which 2-3 categories have strongest organic engagement

**Week 4: Public Launch**
- All categories, event-driven topics active
- PR angle: "Rate anything — the internet's opinion platform" (universal, not niche)
- Product Hunt launch + cross-category Twitter/X campaign
- Double down on the 2-3 categories that showed strongest beta traction
- Launch-week admin seeding tied to real-world events happening that week (whatever's in the news/culture)

**Key principle:** Let the USERS decide which category wins first. The platform is universal — don't artificially narrow it to sports and risk alienating 80% of potential users who don't care about NBA.

### 6.2 Content Seeding

**Initial Topics to Create**
- "Rate the iPhone 16 Pro"
- "Rate The Bear Season 3"
- "Rate Biden's debate performance"
- "Rate LeBron James' 2024 season"
- "Rate Taco Bell's menu"
- "Rate Tesla Cybertruck"
- "Rate the Roman Empire trend"

**Influencer Strategy**
- Give verified badges to known personalities
- They create topics → followers engage
- Cross-post to their existing audiences

### 6.3 Community Guidelines

**Encouraged**
- Honest opinions with reasoning
- Data-driven arguments
- Humor and memes (in appropriate topics)
- Respectful debate

**Discouraged**
- Ratings without substance
- Personal attacks on other users
- Off-topic comments
- Spam or repeated content

**Prohibited**
- Harassment or bullying
- Hate speech
- Doxxing
- Rating private individuals (non-public figures)
- Explicit content

---

## 7. Moderation & Safety

### 7.1 Automated Moderation

| Layer | Tool | Action |
|-------|------|--------|
| Pre-publish | Text analysis (toxicity, spam) | Block or flag for review |
| Post-publish | Community flagging | Auto-hide if 5+ flags |
| Pattern detection | Bot/spam detection | Ban accounts, remove ratings |
| Duplicate detection | Similarity matching | Merge or reject duplicate topics |

### 7.2 Human Moderation

**Moderation Queue**
- New topics (first 24h)
- Flagged comments
- Reported users
- Appeals

**Moderator Roles**
- **Global moderators**: Platform-wide
- **Category moderators**: Trusted users per category
- **Topic creators**: Can moderate their own topics (hide comments, close topic)

**Admin Seeding Rights**
- Admin can create topics and define options
- Admin can pin topics to homepage
- Admin can feature "hotly debated" topics
- Admin can create categories

### 7.3 Legal & Safety Considerations

**Rating People (Options Can Be People)**
- **Public figures only**: Politicians, celebrities, athletes, executives, fictional characters
- **Private individuals prohibited**: No rating coworkers, exes, neighbors, non-public figures
- **Fictional characters allowed**: Rate Batman, Walter White, etc.
- **Verification**: Public figures can claim profiles, respond to ratings
- **Admin override**: Admin can remove people-based topics that violate policy

**Defamation Risk**
- Comments are opinions, not facts
- Clear terms of service stating opinions are user-generated
- Report system for legally problematic content
- Geo-blocking for high-risk jurisdictions if needed

**Data Privacy**
- GDPR/CCPA compliance
- Minimal data collection
- Easy account deletion
- No selling of personal data
- Guest tracking uses device fingerprint (no cookies required)

**User Deletion (Right to Erasure)**
- Account deletion is available in settings (no dark patterns, < 3 clicks)
- On deletion:
  - Profile, bio, avatar: permanently removed
  - Ratings: anonymized (attributed to '[deleted]'), remain in aggregate scores
  - Comments: shown as '[deleted user]' with text preserved (Reddit model)
  - DMs/messages: deleted from both sides
  - Data purge completed within 30 days
- Ratings remain in aggregates because removing them would allow score manipulation (delete account to remove bad ratings)

### 7.4 Anti-Brigading Measures

- Rate limit: Max 1 rating per option per account
- Device fingerprint-based guest limits (3 topics per device)
- CAPTCHA for guest users
- Pattern detection for coordinated voting
- Weighted scoring (verified accounts count more)
- Cooling-off period: New accounts can't rate for 24h (waived for invite-only beta participants)

---

## 8. Competitive Analysis

### 8.1 Direct Competitors (None in US)

| Platform | Strength | Weakness | Our Advantage |
|----------|----------|----------|---------------|
| **Hupu** (China) | Proven model, massive scale | Chinese only, sports-focused | English-first, universal categories |
| **Rate Anything** (app) | Simple, mobile | No social, no debate, no virality | Social + debate + share mechanics |
| **Rating10** (app) | Mobile ratings | Limited categories, no community | Universal + community-driven |

### 8.2 Indirect Competitors

| Platform | What they do | Why we're different |
|----------|-------------|---------------------|
| **Reddit** | Text discussion | No structured ratings, no aggregation |
| **Twitter/X** | Microblogging | Ephemeral, no scoring system |
| **Rotten Tomatoes** | Movie ratings | Critic-focused, no debate |
| **Letterboxd** | Movie social network | Narrow category, gentle culture |
| **IMDB** | Movie database | No real-time debate |
| **Yelp** | Business reviews | Niche, no viral mechanics |
| **Pollfish/Strawpoll** | Quick polls | No comments, no profiles, ephemeral |

### 8.3 Moat

- **Network effects**: More users → more topics → more engagement
- **Data**: Historical ratings become valuable ("what did people think of X over time?")
- **Culture**: The "hot take" culture is hard to replicate
- **Speed**: First to market with this specific mechanic in English

---

## 9. Monetization Strategy

### 9.1 Phase 1: Growth (No Monetization)
- Focus on user acquisition
- No ads, no paywalls
- Build habit and network effects

### 9.2 Phase 2: Light Monetization

**Premium Subscription ($4.99/mo)**
- Advanced stats on your ratings
- Custom themes/profile customization
- Ad-free experience
- Early access to new features
- "Pro" badge

**Affiliate Links**
- Product topics include purchase links
- Revenue share with retailers
- Only on relevant topics (tech, food, etc.)

### 9.3 Phase 3: Scale Monetization

**Sponsored Topics**
- Brands pay to be rated (risky but high engagement)
- Clearly labeled as "Sponsored"
- Example: "Rate the new Samsung Galaxy" (paid by Samsung)

**Data & Insights**
- Aggregate sentiment data for brands
- "What do people think of [competitor]?"
- Market research reports

**API Access**
- Developers/builders access to rating data
- Tiered pricing based on usage

### 9.4 What NOT to Do
- Don't sell user data
- Don't allow brands to influence scores
- Don't show ads in comment threads (kills engagement)
- Don't make ratings paywalled (kills growth)

### 9.5 Cost Model (MVP)

| Component | Service | Est. Monthly Cost (5K DAU) |
|-----------|---------|---------------------------|
| Hosting (API) | Railway / Fly.io | $25-50 |
| Database | Neon Postgres (free tier → $25) | $0-25 |
| Redis (caching) | Upstash | $0-10 |
| Auth | Clerk (free tier: 10K MAU) | $0 |
| CDN / Static | Vercel (free tier) | $0 |
| Media storage | Cloudflare R2 | $5-15 |
| Push notifications | OneSignal (free tier) | $0 |
| Monitoring | Sentry (free tier) | $0 |
| **Total** | | **$30-100/mo** |

**Scaling triggers:**
- >10K DAU: Move to dedicated Postgres ($50-100/mo)
- >50K DAU: Dedicated Redis ($30/mo), CDN costs real ($20-50/mo)
- >100K DAU: ~$500/mo total; monetization should be active by this point


---

## 10. Technical Architecture

### 10.1 High-Level Architecture

```
┌─────────────────────────────────────────┐
│              Client Layer                │
│  Next.js (App Router) + Tailwind CSS    │
│  Mobile-responsive, PWA-ready           │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│              API Layer                   │
│  Next.js API Routes / tRPC              │
│  RESTful + WebSocket (real-time)        │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│            Service Layer                 │
│  - Topic Service                        │
│  - Rating Service                       │
│  - Comment Service                      │
│  - User Service                         │
│  - Feed Service                         │
│  - Notification Service                 │
│  - Moderation Service                   │
│  - Share Card Service                   │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│            Data Layer                    │
│  PostgreSQL (primary)                   │
│  Redis (cache, sessions, trending)      │
│  S3/Cloudinary (images, share cards)    │
└─────────────────────────────────────────┘
```

### 10.2 Database Schema (Simplified)

```sql
-- Users
users (id, username, email, avatar, bio, location, created_at, reputation_score, is_verified)

-- Guests (device-tracked)
guests (id, fingerprint_hash, ip_address, user_agent, created_at, last_seen, rating_count)

-- Topics
topics (id, title, description, category_id, image_url, source_url, 
        creator_id, status, created_at, closed_at, is_pinned)

-- Options within topics
options (id, topic_id, name, description, image_url, sort_order, 
         created_at, rating_count, avg_rating)

-- Ratings (per option, per user OR per guest)
ratings (id, user_id, guest_id, option_id, score, comment, tags, 
         created_at, updated_at, is_edited)

-- Comments (replies to ratings, option-scoped)
comments (id, user_id, rating_id, parent_id, content, upvotes, created_at)

-- Categories
categories (id, name, slug, parent_id, description)

-- User Follows
follows (follower_id, following_id, created_at)

-- Collections
collections (id, user_id, name, created_at)
collection_items (collection_id, topic_id, added_at)

-- Notifications
notifications (id, user_id, type, data, read, created_at)

-- Reports
reports (id, reporter_id, target_type, target_id, reason, status, created_at)

-- Admin Actions
admin_actions (id, admin_id, action_type, target_type, target_id, reason, created_at)
```

**Key Design Decisions:**
- Ratings can be tied to either a `user_id` (registered) or `guest_id` (device-tracked)
- Comments are tied to ratings, not directly to options or topics
- Options are separate entities within topics, each with their own stats
- Guest fingerprinting uses IP + user agent + canvas hash (no cookies required)

**Indexes:**
- `ratings(option_id, created_at DESC)` — time-series queries per option
- `ratings(user_id, option_id)` UNIQUE — enforce one rating per user per option
- `comments(rating_id, upvotes DESC)` — hot comments sort
- `topics(category, trending_score DESC)` — category browsing
- `topics(created_at DESC)` — newest sort

**Denormalization Decisions:**
- `options.avg_rating` and `options.rating_count`: maintained by async worker (not computed on read). Updated within 5s of new rating via background job.
- `topics.total_ratings`: sum of all options' counts, also async-maintained.
- Rationale: read-heavy workload (100:1 read:write); acceptable 5s staleness for scores.

### 10.3 Performance Considerations

**Caching Strategy**
- Redis for: trending topics, user sessions, rate limits, guest fingerprints
- CDN for: static assets, share cards, user avatars
- Database query caching for: topic averages, leaderboard

**Real-Time Updates**
- WebSocket for: live rating updates (topic page, per option)
- Server-Sent Events for: notifications
- Polling fallback for: older browsers

**Scaling Strategy:**
- **Phase 1 (MVP, <5K DAU)**: Single Railway/Fly.io container, vertical scaling. Postgres + Redis on managed services.
- **Phase 2 (5K-50K DAU)**: 2-3 containers behind load balancer (Fly.io built-in). Read replicas for Postgres. Redis cluster for caching + WebSocket pub/sub.
- **Phase 3 (>50K DAU)**: Kubernetes (Fly.io Machines or dedicated k8s). Separate read/write DB. CDN for topic page SSR caching (5-minute TTL). WebSocket scaling via Redis adapter.
- **Scaling triggers**: CPU >70% sustained → add container. DB query p99 >200ms → add read replica. WebSocket connections >10K per node → add node.

**Async Job Queue**: share card generation, notifications, moderation (Redis-backed with BullMQ or similar)

### 10.4 Third-Party Services

| Service | Purpose |
|---------|---------|
| Clerk / Auth0 | Authentication |
| Stripe | Payments (Phase 2) |
| SportRadar / ESPN API | Sports data (Phase 2) |
| TMDB API | Movie data (Phase 2) |
| Cloudinary / AWS S3 | Image hosting |
| SendGrid / Resend | Email notifications |
| Vercel | Hosting |
| Railway / Render | Database hosting |

### 10.5 API Endpoint Spec (v1)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/v1/topics | Create a topic | Required |
| GET | /api/v1/topics/:id | Get topic with options + scores | Public |
| GET | /api/v1/topics/trending | Trending topics feed | Public |
| GET | /api/v1/topics/search?q= | Search topics | Public |
| POST | /api/v1/topics/:id/options | Add option to open topic | Required |
| POST | /api/v1/options/:id/ratings | Submit/update a rating | Required (or guest token) |
| GET | /api/v1/options/:id/ratings | Get ratings + comments for option | Public |
| POST | /api/v1/ratings/:id/replies | Reply to a rating comment | Required |
| POST | /api/v1/ratings/:id/upvote | Upvote a comment | Required |
| GET | /api/v1/users/:username | Public profile | Public |
| GET | /api/v1/users/me | Current user profile | Required |
| DELETE | /api/v1/users/me | Delete account (GDPR) | Required |
| GET | /api/v1/categories | List categories | Public |
| POST | /api/v1/reports | Flag content | Required |

**Versioning**: URL-prefix (`/api/v1/`). Breaking changes get `/api/v2/`.
**Rate Limiting**: 60 req/min per IP (unauthenticated), 300 req/min per user (authenticated). Burst: 10 req/s. 429 response with `Retry-After` header.

### 10.6 URL Structure & SEO

| Route | Example | Rendering |
|-------|---------|----------|
| /topic/:slug | /topic/lakers-vs-warriors-g7 | SSR (meta tags for share previews) |
| /topic/:slug/option/:optionSlug | /topic/lakers-vs-warriors-g7/option/lebron-james | SSR |
| /user/:username | /user/contrarian | CSR (no SEO value) |
| /category/:name | /category/sports | SSR |
| /trending | /trending | SSR |

**SEO Strategy:**
- Topic pages are server-side rendered with Open Graph + Twitter Card meta tags
- Canonical URLs use slugified topic titles (auto-generated, editable by creator)
- Each topic page has structured data (Schema.org: Review aggregate)
- Sitemap auto-generated from active topics (>10 ratings)
- Share cards resolve to the topic page with full rich preview

### 10.7 Accessibility (a11y)

- Rating input: both slider AND button grid (1-10), keyboard-navigable, ARIA labels ('Rate LeBron James: select score 1 to 10')
- Color is never the sole indicator (icons + labels alongside color coding)
- All images/avatars have alt text; share card images have descriptive alt
- Focus management: modal rating flow traps focus, returns on close
- Screen reader: score announcements ('LeBron James: 8.5 out of 10, based on 14,237 ratings')
- Minimum contrast ratio 4.5:1 for text, 3:1 for UI components
- Target: WCAG 2.1 Level AA


---

## 11. MVP Roadmap

### Week 1-2: Foundation
- [ ] **[P0]** Project setup (Next.js, DB, auth)
- [ ] **[P0]** User auth (signup/login)
- [ ] **[P0]** Basic topic creation with options
- [ ] **[P0]** Rating submission (1-10 + comment per option)
- [ ] **[P0]** Score calculation (weighted average)
- [ ] **[P0]** Topic page (show average, distribution, comments per option)
- [ ] **[P1]** Comment system (full threading)

### Week 3-4: Social Core
- [ ] **[P0]** Reply to comments
- [ ] **[P0]** Upvote comments
- [ ] **[P0]** Notifications (in-app)
- [ ] **[P1]** Follow/unfollow users
- [ ] **[P1]** Share cards (basic)
- [ ] **[P1]** Push notifications

### Week 5-6: Discovery
- [ ] **[P0]** Homepage feed (trending/newest)
- [ ] **[P0]** Category pages
- [ ] **[P0]** Search topics
- [ ] **[P1]** User profiles
- [ ] **[P1]** Badge system
- [ ] Sort options (Hot, Controversial, New)

### Week 7-8: Polish & Launch Prep
- [ ] **[P0]** Rate limiting (per user + per guest device)
- [ ] **[P0]** Moderation queue
- [ ] **[P0]** Community reporting
- [ ] **[P1]** Email digests
- [ ] **[P1]** Leaderboards
- [ ] **[P1]** Collections
- [ ] Mobile responsiveness
- [ ] Share cards (polished)
- [ ] Analytics setup
- [ ] Beta testing

### Week 9: Launch
- [ ] Product Hunt launch
- [ ] Twitter/X campaign
- [ ] Influencer outreach
- [ ] Press outreach

**Scope Cut Rule**: If a week runs over, all P1 items defer to the next week. P0 items cannot be cut without explicit re-scoping.

---

## 12. Success Metrics & KPIs

### 12.1 North Star Metric
**Daily Active Raters (DAR)**: Users who rate at least one option per day

### 12.2 Primary Metrics

| Metric | 30-day Target | 90-day Target |
|--------|--------------|---------------|
| Topics created | 1,000 | 10,000 |
| Ratings submitted | 10,000 | 100,000 |
| Comments written | 8,000 | 80,000 |
| DAU | 500 | 5,000 |
| WAU | 2,000 | 20,000 |
| Avg session duration | 4 min | 5 min |
| Avg ratings per user | 5 | 10 |
| Share card impressions | 50,000 | 500,000 |
| Signup conversion | 20% | 25% |

### 12.3 Secondary Metrics

| Metric | Target |
|--------|--------|
| Retention (D1) | 40% |
| Retention (D7) | 20% |
| Retention (D30) | 10% |
| Viral coefficient (K) | 0.3 |

> **Note on K=0.3:** K<1 means the product is NOT inherently viral — organic sharing supplements but does not replace direct acquisition. Seeding, content marketing, and targeted community outreach are the primary growth drivers until K approaches 1.0.
| NPS | > 40 |

### 12.4 Negative Metrics to Watch

| Metric | Red Flag |
|--------|----------|
| Ratings WITH comments | < 40% (red flag if most users skip comments despite incentives) |
| Reported content | > 2% of all comments |
| Bot accounts detected | > 5% of daily signups |
| Topic abandonment | > 70% topics with < 10 ratings |
| Churn (7-day) | > 60% |

### 12.5 Analytics Instrumentation

**Tool**: PostHog (self-hostable, event-based, free tier covers MVP scale)

**Core Event Taxonomy:**
| Event | Properties | Funnel |
|-------|-----------|--------|
| page_view | path, referrer, utm_* | Acquisition |
| signup_started | method (google/email/apple) | Activation |
| signup_completed | username, categories_selected | Activation |
| topic_viewed | topic_id, source (feed/search/share) | Engagement |
| rating_submitted | topic_id, option_id, score, has_comment | Core action |
| comment_written | rating_id, word_count | Content |
| share_card_generated | topic_id, platform (twitter/ig/copy) | Virality |
| share_card_clicked | topic_id, source_platform | Virality |

**Key Funnels to Track:**
1. Share card → page view → sign up → first rating (viral acquisition)
2. Homepage → topic view → rating (retention engagement)
3. Rating → comment → reply received (content flywheel)


---

## 13. Risk Analysis

### 13.1 Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low initial engagement | Medium | High | Seed content, influencer outreach, paid ads |
| Poor comment quality | High | Medium | Mandatory comment min length, moderation |
| Brigading/mob mentality | Medium | High | Rate limiting, weighted scoring, device fingerprinting |
| Users don't want to write comments | Medium | High | Gamification, prompts, templates |
| Topics become stale quickly | Medium | Medium | Auto-close, event-driven topics, admin seeding |

### 13.2 Legal Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Defamation suits | Low | High | Clear TOS, moderation, no private individuals |
| Copyright (images in topics) | Medium | Medium | DMCA process, user-uploaded only |
| COPPA (under 13) | Low | High | Age gate, account verification |
| GDPR violations | Low | Medium | Compliance from day one |

### 13.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Twitter/X adds ratings | Low | High | Move fast, build community moat |
| Reddit copies feature | Medium | Medium | Differentiate with mandatory comments, per-option ratings |
| Can't monetize | Medium | High | Multiple revenue streams, keep costs low |
| Burn rate too high | Low | High | Lean team, no office, remote |

### 13.4 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Database performance | Medium | Medium | Caching, read replicas, optimization |
| Bot attacks | High | Medium | Rate limiting, CAPTCHA, device fingerprinting, pattern detection |
| Share card generation slow | Low | Medium | Async processing, CDN caching |
| Real-time updates fail | Low | Low | Polling fallback |

---

## 14. Open Questions & Decisions

### 14.1 Product Decisions Needed

1. **~~Anonymous vs Pseudonymous vs Real Identity?~~** ✅ DECIDED: Pseudonymous with guest voting via device fingerprint
2. **~~Can users rate without a topic?~~** ✅ DECIDED: No — topic must exist first, creator defines options
3. **~~Comment scope?~~** ✅ DECIDED: Per-option comments (each option has its own thread)
4. **~~Can users add options to a topic after creation?~~** ✅ DECIDED: Creator decides at topic creation. Locked vs. open is a per-topic setting.

5. **~~Should ratings be editable?~~** ✅ DECIDED: Yes, users can change ratings anytime.

6. **Comment length minimum?**
   - Too short = low quality
   - Too long = friction
   - **Recommendation**: 20 characters minimum, 500 maximum

7. **Downvotes on comments?**
   - Pro: Self-moderation
   - Con: Negativity spiral, dogpiling
   - **Recommendation**: No downvotes. Only upvotes + report.

8. **Guest rating limits?**
   - Cap at 3 topics per device fingerprint?
   - Or unlimited but weighted less?
   - **Recommendation**: 3 topics per device, then require signup. Weighted 0.8x.

9. **Private individuals?**
   - Pro: More topics, more engagement
   - Con: Harassment, legal risk
   - **Recommendation**: Strictly prohibited. Public figures and fictional characters only.

10. **Mobile app vs Web-first?**
    - Pro app: Better engagement, push notifications
    - Pro web: Faster to build, easier to share
    - **Recommendation**: Web-first (responsive), native app Phase 2

11. **~~Single option topics?~~** ✅ DECIDED: Yes, allowed. Some things don't have sub-components.

12. **Admin topic seeding?**
    - Should admin topics be visually distinct?
    - **Recommendation**: "Admin Pick" badge, pinned to homepage for 24h.

### 14.2 Technical Decisions Needed

1. **~~WebSocket vs SSE vs Polling?~~** ✅ DECIDED: WebSocket for topic page, SSE for notifications
2. **~~Self-hosted auth vs Clerk/Auth0?~~** ✅ DECIDED: Clerk (faster, secure, handles edge cases)
3. **~~SQL vs NoSQL?~~** ✅ DECIDED: PostgreSQL (relational data, ACID for ratings)
4. **~~Serverless vs VPS?~~** ✅ DECIDED: Vercel (serverless) for frontend, Railway for DB
5. **Device fingerprinting library?**
   - FingerprintJS Pro vs custom implementation
   - **Recommendation**: FingerprintJS Pro for reliability

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|------|------------|
| **Topic** | A container with options to rate (e.g., "Rate Lakers vs Warriors G7") |
| **Option** | A specific item within a topic that can be rated (e.g., "LeBron James") |
| **Rating** | A 1-10 score + comment on an option |
| **Comment** | A reply to a rating (option-scoped) |
| **Distribution** | Histogram of all ratings on an option |
| **Controversy Score** | Variance metric indicating polarization |
| **Hot Take** | A deliberately provocative or contrarian opinion |
| **Brigading** | Coordinated voting by a group to manipulate scores |
| **OP** | Original Poster (topic creator) |
| **Fingerprint** | Device identification for guest tracking (no cookies) |

### 15.2 Inspiration & References

- **Hupu** (虎扑): Primary inspiration for rating + comment coupling, topic structure
- **Reddit**: Threading model, community structure, pseudonymous culture
- **Letterboxd**: Clean rating UI, user profiles
- **Strawpoll**: Simple poll creation (but we add debate)
- **TikTok**: Viral mechanics, shareability, algorithmic feed
- **Polymarket**: "Predict anything" model → our "Rate anything" parallel

### 15.3 Future Features (Post-MVP)

- **Live ratings**: Rate during events (sports games, debates) with live updating averages
- **Prediction markets**: "What will the average rating be?" — bet on outcomes
- **AI summaries**: "Here's what people are saying about LeBron..." (generated per option)
- **Video comments**: TikTok-style video responses to ratings
- **Groups**: Private communities (company Slack, friend groups) with their own topics
- **Comparison mode**: Side-by-side option comparison (e.g., LeBron vs Curry ratings)
- **Historical tracking**: "How has LeBron's rating changed over his career?"
- **API**: Third-party integrations, embeddable ratings on blogs/sites
- **Mobile app**: iOS and Android with native push notifications
- **Moderation AI**: Auto-flag toxic comments, suggest moderation actions
- **Option voting**: Users vote on which options to add to a topic (if we open that up)

---

*Draft v0.3 — 2026-07-09*
*Next: Tech spec / Data model / Wireframes*

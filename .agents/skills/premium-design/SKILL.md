---
name: premium-design
description: Defines premium UI standards including layout, typography, color, visuals, UX, and performance.
---

# Premium Website Design Skill

## Purpose

This skill defines the visual and UX standard for building premium,
high-quality web interfaces.

The goal is NOT to make interfaces merely attractive.

The goal is to create interfaces that communicate:

- trust
- professionalism
- credibility
- quality
- craftsmanship
- modern technology

A premium interface should feel intentional rather than decorated.

---

# 1. CLEAN AND MODERN LAYOUT

Use:

- generous whitespace
- balanced spacing
- clear grids
- strong alignment
- consistent margins
- clear visual hierarchy
- intentional section separation

Avoid:

- unnecessary elements
- crowded layouts
- excessive cards
- redundant information
- random spacing
- excessive borders
- visual noise

Every element should have a purpose.

Before adding an element ask:

"Does this improve understanding, navigation, trust, or action?"

If not, remove it.

## Visual hierarchy

Each screen should have a clear hierarchy:

1. Primary message
2. Supporting information
3. Primary action
4. Secondary information
5. Supporting details

Do not make every element visually important.

---

# 2. THOUGHTFUL TYPOGRAPHY

Typography must feel intentional.

Prefer:

- one primary font family
- at most one complementary font when genuinely useful
- consistent font weights
- consistent line heights
- controlled letter spacing
- clear heading hierarchy

Avoid:

- unnecessary font combinations
- excessive font weights
- extremely small body text
- overly tight line spacing
- inconsistent heading sizes

## Typography hierarchy

Use clear distinctions between:

- display heading
- section heading
- subheading
- body
- metadata
- labels
- captions

Large headings should feel confident without consuming unnecessary
screen space.

Body text should prioritize readability.

---

# 3. SOPHISTICATED COLOR PALETTE

Use a controlled color system.

A premium interface should generally have:

- primary background
- secondary surface
- elevated surface
- primary text
- secondary text
- muted text
- border
- brand accent
- success
- warning
- error

Do not introduce random colors for individual components.

## Accent color

Use the brand accent strategically.

Accent colors should communicate:

- interaction
- focus
- important information
- selected states
- success where appropriate

Do NOT turn the entire interface into the accent color.

Premium design relies heavily on neutral surfaces with controlled accents.

---

# 4. HIGH-QUALITY VISUALS

Prefer:

- original UI visualizations
- realistic product interfaces
- custom illustrations
- carefully designed graphics
- high-quality imagery
- meaningful animation

Visuals should reinforce the product story.

Do not use visuals simply because an empty area exists.

Avoid:

- generic stock imagery
- low-quality assets
- unrelated illustrations
- decorative graphics without purpose
- generic AI/technology imagery

For product interfaces, prefer showing the actual product experience.

Example:

Instead of:

"AI-powered roadside assistance"

show:

Customer problem
→ AI diagnosis
→ mechanic matching
→ booking

The visual should explain the product.

---

# 5. SEAMLESS USER EXPERIENCE

Premium design is not only visual.

The interface must be easy to use.

Users should always understand:

- where they are
- what is happening
- what they can do
- what happens next

## Navigation

Navigation should be:

- predictable
- consistent
- easy to scan
- responsive
- unobtrusive

## Interaction

Primary actions should be obvious.

Examples:

Book Mechanic
Find Mechanic
Start Service
Complete Service

Do not hide important actions behind unnecessary UI.

## Loading

Every asynchronous operation should have an appropriate state:

loading
→ success
→ error

Avoid unexplained blank screens.

## Error states

Errors should explain:

what happened
+
what the user can do next

Never expose raw technical errors to normal users.

---

# 6. MICRO-DETAILS

Premium quality is often created through small details.

Use subtle:

- hover transitions
- focus states
- active states
- entrance animations
- page transitions
- button feedback
- card elevation
- border transitions
- opacity transitions

Animations should feel natural.

Avoid:

- excessive bouncing
- constant movement
- flashing
- aggressive scaling
- unnecessary parallax
- animations on every element

## Timing

Interactions should feel immediate.

Prefer short, subtle transitions.

Animation should communicate:

- state
- hierarchy
- continuity
- feedback

Never animate purely to show off.

---

# 7. CLEAR AND CONFIDENT CONTENT

Design and content must work together.

Headlines should be:

- concise
- confident
- understandable
- benefit-oriented

Avoid:

- meaningless buzzwords
- unnecessary paragraphs
- vague claims
- excessive marketing language

## CTA hierarchy

Each important section should have a clear action.

Example:

Primary:

"Book a Mechanic"

Secondary:

"Learn How It Works"

Do not give users five equally prominent buttons.

---

# 8. PREMIUM CARD DESIGN

Cards should not exist everywhere.

Use cards when they create meaningful grouping.

A premium card should have:

- clear hierarchy
- controlled padding
- subtle surface distinction
- intentional border/shadow
- consistent radius

Avoid:

- cards inside cards inside cards
- excessive shadows
- excessive rounded corners
- random card sizes

---

# 9. LIQUID GLASS

Liquid Glass may be used when appropriate.

Use it selectively for:

- navigation
- floating controls
- overlays
- premium product visualizations
- selected cards
- modal surfaces

Preferred characteristics:

- translucent surface
- subtle backdrop blur
- thin border
- soft highlight
- controlled shadow
- strong text contrast

Do NOT apply glass to everything.

Avoid:

- full-page blur
- nested backdrop filters
- excessive transparency
- unreadable text
- blurry maps
- expensive animated blur

Glass should communicate depth, not become the entire design.

---

# 10. WRENCH BRAND APPLICATION

For Wrench specifically, the visual language should communicate:

- roadside assistance
- technology
- reliability
- speed
- trust
- premium service

The interface should feel like a modern automotive technology product.

Avoid making Wrench look like:

- a generic SaaS dashboard
- a generic AI chatbot
- a generic booking website
- a cryptocurrency interface
- a cyberpunk application

---

# 11. LANDING PAGE STANDARD

The landing page should communicate the product within seconds.

Hero:

Clear headline
+
short supporting message
+
strong CTA
+
visual product demonstration

The visual should demonstrate Wrench's actual value.

Preferred story:

Customer problem
→ AI understanding
→ diagnosis
→ nearby mechanic
→ booking

Do not use generic technology graphics when a real product visualization
would communicate more.

---

# 12. DASHBOARD STANDARD

Dashboards should prioritize usability over decoration.

Customer:

- discovery
- booking
- booking status
- AI assistance
- service history

Mechanic:

- availability
- requests
- active services
- history
- profile

Important information should be visible immediately.

Avoid turning dashboards into collections of decorative cards.

---

# 13. MAP UI STANDARD

Maps are functional surfaces.

Do not obscure the map with excessive glass or decoration.

Prioritize:

- location
- mechanic markers
- distance
- availability
- vehicle compatibility
- booking action

Controls should remain usable.

---

# 14. RESPONSIVE DESIGN

Premium design must work across:

- desktop
- tablet
- mobile

Do not simply shrink desktop layouts.

At smaller widths:

- reduce unnecessary content
- preserve hierarchy
- stack intelligently
- maintain touch targets
- preserve readability

Never allow:

- horizontal overflow
- clipped text
- inaccessible buttons
- overlapping navigation

---

# 15. ACCESSIBILITY

Premium does not mean inaccessible.

Maintain:

- sufficient contrast
- visible focus states
- readable text
- appropriate touch targets
- keyboard accessibility
- reduced-motion support

Do not rely solely on:

- color
- blur
- animation
- transparency

to communicate important information.

---

# 16. PERFORMANCE

Visual quality must not destroy performance.

Avoid unnecessary:

- large images
- heavy animation libraries
- excessive blur
- nested backdrop filters
- large DOM trees
- continuous animations

Prefer CSS transitions and existing project utilities where possible.

---

# 17. DESIGN CONSISTENCY

Before creating a new component, inspect existing components.

Reuse:

- spacing
- typography
- colors
- radius
- buttons
- inputs
- cards
- navigation patterns

Do not create visually similar components with slightly different
styles.

If the project lacks a reusable primitive, create one intentionally.

---

# 18. DO NOT REDESIGN WITHOUT A REASON

When modifying an existing page:

Preserve working:

- functionality
- layout
- navigation
- API behavior
- routing
- business logic

Only change what the task requires.

Do not redesign unrelated sections.

---

# 19. VISUAL QA

After significant UI work, verify the actual browser.

Check:

- spacing
- typography
- alignment
- hierarchy
- hover states
- loading states
- error states
- responsive behavior
- animations
- contrast
- overflow

Use browser automation when available.

Do not consider a UI complete merely because the code compiles.

---

# 20. PREMIUM DESIGN CHECKLIST

Before considering a page complete:

### Layout
- [ ] Clean hierarchy
- [ ] Balanced whitespace
- [ ] Consistent alignment
- [ ] No unnecessary elements

### Typography
- [ ] Consistent font system
- [ ] Clear hierarchy
- [ ] Readable body text

### Color
- [ ] Controlled palette
- [ ] Consistent accent
- [ ] Strong contrast

### Visuals
- [ ] High-quality visuals
- [ ] Product-relevant imagery
- [ ] No generic placeholders

### UX
- [ ] Clear navigation
- [ ] Obvious primary CTA
- [ ] Loading states
- [ ] Error states
- [ ] Success feedback

### Micro-details
- [ ] Hover states
- [ ] Focus states
- [ ] Subtle transitions
- [ ] Consistent interaction feedback

### Responsive
- [ ] Desktop
- [ ] Tablet
- [ ] Mobile
- [ ] No overflow

### Performance
- [ ] No excessive blur
- [ ] No unnecessary animations
- [ ] No heavy assets

### Accessibility
- [ ] Contrast
- [ ] Keyboard navigation
- [ ] Focus states
- [ ] Reduced motion

---

# CORE PRINCIPLE

A premium website is not created by adding more effects.

It is created through:

clarity
+
consistency
+
hierarchy
+
quality
+
restraint
+
attention to detail.

When choosing between:

"more visual effects"

and

"better hierarchy and usability"

always choose hierarchy and usability.

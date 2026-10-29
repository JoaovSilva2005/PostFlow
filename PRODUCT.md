# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the owner of a small business with no marketing team, who wants to post on social media regularly without spending hours writing and designing. They set up their own brand and run the content themselves, often between other tasks of the business.

Secondary (confirmed in the project docs, not the focus of this redesign): freelance social media managers and small agencies who switch between several brands.

## Product Purpose

PostFlow turns a plain-language request into a reviewable, scheduled plan of social posts that keeps the brand's identity, in one place. The owner registers the brand once (who it serves, how it speaks, its colors and offer), asks for content, reviews the AI drafts in a calendar and schedules publication.

Success for the brand setup: when the owner finishes it, they feel that **the AI understood their brand** — the information they gave visibly turns into posts in their tone and colors.

## Positioning

The brand profile is the input every generation uses: text, hashtags and square artwork are generated from it, so a well-filled brand is what makes the drafts sound like the business instead of generic AI copy.

## Operating Context

- Main flow: create account → set up the brand → describe what to create (topic, period, networks) → AI generates one post per selected network with shared artwork → review in the calendar → approve and schedule.
- Several brands per account work as independent workspaces.
- Social publishing currently runs in demonstration mode (simulated publication) until developer apps for the networks exist.
- Academic project (Projeto Multidisciplinar VI); presented to a panel on 2026-11-03, with later full-stack validation rounds.

## Capabilities and Constraints

- Stack in place: React 19, TypeScript, Vite, CSS Modules, lucide-react icons, Express BFF, Supabase, OpenAI. No new UI framework is required.
- Brand fields stored today: name, segment, tone of voice, primary color, color palette (up to 5), description, target audience, products or services, differentials, content goals, keywords, topics to avoid, default call to action.
- The calendar's month-grid layout is a confirmed requirement and keeps its essence; other screens may be redesigned.
- Billing, payment and fiscal documents are demonstrative.

## Brand Commitments

- Light and dark themes both stay available (confirmed by the owner).
- Name "PostFlow" stays. The current logo symbol, accent color and visual style are not binding and may be redefined.
- Standing visual preference (owner, 2026-10-29): the app should sit alongside Supabase, Vercel and GitHub — familiar, clean developer-grade product UI executed at their craft level, not a themed or decorative world.
- Must not feel like an AI template (gradients, identical cards, emoji, generic "boost your business" copy), a giant form, or cold corporate/ERP software.

## Evidence on Hand

- No real customers, testimonials, metrics or press exist; never fabricate them.
- Reference prototype for the calendar day view supplied by the owner (post cards stacked, three columns).

## Product Principles

1. The brand profile must feel like it pays off immediately: show how it shapes the posts.
2. Ask for the minimum first; let the owner enrich the brand later.
3. The owner should always understand what is real and what is simulated.
4. Clear and calm over clever: a busy small-business owner must finish tasks without guidance.

## Accessibility & Inclusion

No product-specific requirement established beyond WCAG AA contrast in both themes and full keyboard use.

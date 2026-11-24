---
name: SightLine
description: Cinema booking that shows the real view from your seat.
colors:
  tungsten: "#e3b873"
  ink: "#0b0b0c"
  ink-raised: "#101011"
  surface: "#151516"
  surface-raised: "#1d1d1f"
  paper: "#ecebe7"
  paper-bright: "#ffffff"
  muted: "#a5a49f"
  faint: "#878682"
  hairline: "rgba(255, 255, 255, 0.08)"
  hairline-strong: "rgba(255, 255, 255, 0.15)"
  seat-free: "#4b4b4f"
  seat-accessible: "#7da7c4"
  danger: "#e5675f"
  seat-hover: "#77777c"
  ink-soft: "#55544f"
  available: "#7fbf8e"
  email-paper: "#f4f2ed"
  email-ink-soft: "#3a3936"
  email-muted: "#6b6964"
  email-rule: "#e6e4df"
  print-ink: "#000000"
  print-rule: "#999999"
  projector-beam: "#b9cdff"
  screen-mask: "#030304"
typography:
  display:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(44px, 6.4vw, 88px)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  hero:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(40px, 5vw, 64px)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  statement:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(32px, 4vw, 48px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(24px, 2.6vw, 30px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-phone:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Variable, Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  xs: "4px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "36px"
  section: "72px"
components:
  button-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.paper-bright}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  chip:
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
  chip-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "18px"
  input:
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "46px"
  segmented-option-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  seat:
    backgroundColor: "{colors.seat-free}"
  seat-selected:
    backgroundColor: "{colors.tungsten}"
  stat-tile:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.sm}"
    padding: "10px"
---

# Design System: SightLine

## Overview

**Creative North Star: "The Dark Auditorium"**

The interface is the hall after the lights go down. Everything is near-black and quiet so that two things carry the light: the film on the screen, and the seat you chose. Chrome recedes; the 3D seat view and the film artwork are the only saturated things on any page.

The system is monochrome with a single warm accent, Tungsten. Density is moderate and information is stated as plain facts with numbers (distance, field of view, a view score) set in tabular figures. Controls are soft pills; containers are flat panels separated by hairlines. Motion is brief and functional: the camera flies to a seat, small state changes fade.

The first version of this site used gradient buttons, neon seat colours and glows. That look was rejected and is the anti-reference.

**Key Characteristics:**
- Near-black field, warm off-white text, one warm accent.
- Flat surfaces separated by hairlines, no drop shadows.
- Pills for anything you press, soft rectangles for anything that holds content.
- The 3D hall and film artwork supply all colour; the interface supplies none.
- Numbers are tabular and paired with a small, quiet label.

## Colors

A warm-neutral dark palette with one accent. Colour belongs to the content.

### Primary
- **Tungsten** (`tungsten`): the warm glow of an aisle lamp. Used for selected seats (on the map, in the 3D hall, and as outlined chips), the seat verdict label ("Best in the house"), and the status dot. Nothing else.

### Neutral
- **Ink** (`ink`): the page field and the 3D stage background.
- **Ink Raised** (`ink-raised`): the booking side panel.
- **Surface** (`surface`): cards and the showtime switcher track.
- **Surface Raised** (`surface-raised`): secondary buttons, stat tiles, selected payment method.
- **Paper** (`paper`): all primary text, and the fill of primary buttons and selected chips, tabs and days. **Paper Bright** is its hover state.
- **Muted** (`muted`): secondary text and metadata. **Faint** (`faint`): labels, units and disabled icons.
- **Hairline** and **Hairline Strong**: every border and divider.
- **Seat Free** (`seat-free`): an available seat on the map, lifting to **Seat Hover** (`seat-hover`) under the pointer. **Seat Accessible** (`seat-accessible`) is a thin outline on accessible seats.
- **Ink Soft** (`ink-soft`): secondary text on a Paper fill, such as the weekday on a selected day tile.
- **Available** (`available`): the small status dot on a showtime with plenty of seats, and the "Confirmed" status tag on an account's email. It is a signal, not decoration, and appears nowhere else.
- **Danger** (`danger`): form errors, the low hold-timer state, declined payments and the cancel action.
- **Email Paper** (`email-paper`): the light page behind emails, in the demo inbox and in the emails themselves. Emails are the one light surface: Ink for headings and buttons, **Email Ink Soft** (`email-ink-soft`) for body text, **Email Muted** (`email-muted`) for labels and small print (at least 4.5:1 on both white and Email Paper), and **Email Rule** (`email-rule`) for borders. Emails use a system font stack, because email clients do not load web fonts.
- **Print Ink** (`print-ink`) and **Print Rule** (`print-rule`): the printed ticket is black on white with mid-grey borders.
- **Projector Beam** (`projector-beam`) and **Screen Mask** (`screen-mask`): inside the 3D hall only, the faint cool beam from the projection port and the black border around the screen.

### Named Rules
**The One Lamp Rule.** Tungsten marks what the visitor has chosen and the verdict on it. It is never used for buttons, links, headings or decoration.

**The Borrowed Colour Rule.** Any saturated colour on a page comes from film artwork, the 3D hall (red velvet seats, the lit screen) or the view-quality heatmap. The interface itself stays neutral.

## Typography

**Marquee Font:** Big Shoulders Display Variable, weight 800, always in capitals. It is the tall condensed lettering of a cinema front (Delite, Regal, a PVR facade), used only where a cinema would put its sign: the logo wordmark, the home page headline and section titles, a movie's title on its page (like the board over a cinema door), a cinema's name over its photo, the titles of the Cinemas and Live Shows listings, cinema names on photo tiles, step numbers in How It Works, and the closing band's title. Pages where you read or fill things in (checkout, account, help, admin) keep Geist.

**Body and Label Font:** Geist Variable (with system-ui fallback), for everything you read or operate.

**Character:** Two clearly different voices: marquee capitals for the few words a cinema would light up, and one calm grotesque for the rest. The marquee face never sets a sentence, a button or a form. Bebas Neue and Playfair Display exist only inside generated poster artwork, never in the interface.

### Hierarchy
- **Marquee Hero** (Big Shoulders 800, capitals, `clamp(76px, 10.4vw, 172px)`, 0.84, +0.005em): the home page headline, "Try any seat before you book", one line per phrase.
- **Marquee Title** (Big Shoulders 800, capitals, `clamp(44px, 5.4vw, 76px)`, 0.92, +0.01em): home page section titles ("Now showing", "Same hall, two seats") and the closing band's movie title.
- **Display** (600, `clamp(44px, 6.4vw, 88px)`, 0.98, -0.04em): the film title on a film's page.
- **Hero** (600, `clamp(40px, 5vw, 64px)`, 1.02, -0.04em): the home page's one-sentence product line ("Cinema tickets with the view from your seat"). A full sentence, so it sits a step below Display.
- **Statement** (600, `clamp(32px, 4vw, 48px)`, 1.12, -0.04em): a single product statement in a marketing band, such as "See it before you seat it." At most one per page.
- **Headline** (600, `clamp(24px, 2.6vw, 30px)`, 1.12): section headings, page titles, the ticket's film title and empty-state headings.
- **Title** (600, 18px to 24px): card headings, the seat name ("Row H, Seat 10").
- **Body** (400, 15px, 1.5): descriptions and form text. Synopsis text is capped near 64ch. Under 700px wide, body text and every form field are 16px (**Body Phone**), so reading is comfortable and iOS never zooms into a field.
- **Caption** (400, 12.5px to 13.5px): metadata, hints, legends.
- **Label** (500, 12px, sentence case, normal tracking): stat labels, ticket field names, footer column titles, format badges, status tags. Never all caps: tracked-out capitals read as template chrome. Never as a kicker above a heading.

### Named Rules
**The Tabular Rule.** Prices, times, scores, measurements and countdowns use `font-variant-numeric: tabular-nums`.

**The Title Case Rule.** Buttons and headings are in Title Case; sentences and hints are in sentence case.

## Layout

- Content pages sit in a centred container (`min(1180px, 100% - 48px)`, 32px total gutter under 700px) with 72px between sections.
- The booking screen is a full-height two-pane tool under a 60px nav and a 60px show bar: the 3D stage fills the left, a fixed 420px panel on the right holds the seat map, seat detail and a pinned footer with the total and the continue action. The panel narrows to 360px under 980px.
- Under 820px the booking screen stacks: the stage becomes a sticky 42dvh band at the top and the panel scrolls beneath it, with the footer pinned to the bottom and padded for the phone's safe area.
- Film grid is 4 columns, 3 under 980px, 2 under 700px. Hall and checkout grids collapse to one column under 980px.
- Controls that float over the 3D stage sit 14px from its edges.

## Elevation & Depth

The system is flat. Depth is conveyed by three tonal steps (Ink, Surface, Surface Raised) and hairline borders, not by shadows. There are no drop shadows on cards, buttons or panels.

The only layered treatment is on controls that float over the 3D stage (view switch, tool buttons, caption, seat-hop pad): a translucent Ink fill (`rgba(16, 16, 17, 0.72)`) with a 14px backdrop blur and a hairline, so they stay legible over a moving image. The top nav uses the same idea at 18px blur.

### Named Rules
**The Flat Rule.** No `box-shadow` for elevation. The only shadows in the system are focus rings.

**The Blur-Over-Picture Rule.** Backdrop blur is allowed only on controls sitting over the 3D view, film artwork or scrolling content. Never on a panel over a flat background.

## Shapes

Two families. Anything pressed is a full pill (`999px`): buttons, chips, tabs, showtime options, steppers, seat chips, toasts. Anything that holds content is a soft rectangle: 14px for cards, 10px for inputs, tiles and posters, 18px for the ticket and its seat-view image. Icon-only controls are circles. Borders are always 1px hairlines; the ticket stub uses a 1px dashed divider. Seats on the map are small rounded squares.

## Logo

**The mark** is an eye built from a cinema: the upper lid is the curved screen, the lower lid is a row of seats, and the pupil is your seat, a small cinema-seat shape (backrest and cushion) in Tungsten, the colour reserved for the visitor's chosen seat. It says sight, screen and seat at once, and at 16px it still reads as an eye with a gold centre. It is built on a 64-unit grid: the screen lid is a 7-unit Paper stroke, the seat row a 5-unit stroke at 42% opacity, and the two lids stay separate strokes so the screen and the seats never merge into a generic eye outline. No gradient, no glow.

**The wordmark** is "SightLine" in Geist 600, mixed case, -0.03em tracking, set to the right of the mark with a gap of about a quarter of the mark's width. The mark is shown at 30px beside an 18px wordmark in the navigation. Never all caps, never letter-spaced.

**Files** (`public/brand/`): the mark for dark backgrounds (Paper lines), the mark for light backgrounds (Ink lines), and the app icon (the mark at 70% inside a full-bleed Ink square, so phone masks never cut it). The browser favicon is the mark at 82% on a rounded Ink tile; the email header uses the same tile as a 96px PNG; `og-image.png` is the 1200 x 630 link preview: the lockup and headline over a render of the large-screen auditorium. Keep at least a quarter of the mark's width clear around it, and never show it smaller than 16px.

## Components

### Buttons
- **Shape:** full pill (999px), 44px tall, 50px for the main action of a screen.
- **Primary:** Paper fill with Ink text. One per view; it is the next step ("Select Seat", "Continue to Payment", "Confirm Booking").
- **Secondary:** Surface Raised fill, hairline border, Paper text. Border strengthens on hover.
- **Glass:** translucent Ink with backdrop blur and a Hairline Strong border, Paper text. Only over a picture or the 3D hall, beside a Primary button.
- **Text:** Muted text only, turning Paper on hover. For low-stakes actions such as "Keep" or "Cancel".
- **Disabled:** 35% opacity.
- **Small:** 34px tall, 13px label, for dense rows such as the devices list and the confirmation banner.
- **Danger:** transparent with a Danger outline and Danger text. Only for irreversible actions ("Delete My Account"), and only enabled once the visitor has typed their email.
- **Continue with Google:** a Secondary button carrying Google's four-colour "G". The label keeps Google's own wording and casing, the one exception to Title Case, because Google's sign-in branding requires it. The G is the only multi-colour mark in the interface. It appears only when the server has Google sign-in set up; without it, the sign-in page offers email and the demo accounts, and the account page leaves Google out of its sign-in methods.

### Chips and Segmented Controls
- **Style:** pill with a hairline border and Muted text; the selected one inverts to Paper fill with Ink text.
- **Used for:** language and auditorium filters, the "From Seat / Whole Hall" switch, the showtime switcher, and day tiles (which use a 12px radius).
- **Selected-seat chips:** transparent with a Tungsten outline and Tungsten text, with a small remove icon.

### Cards
- **Corner Style:** 14px.
- **Background:** Surface on Ink, with a hairline border.
- **Shadow Strategy:** none; see Elevation.
- **Internal Padding:** 18px to 24px.

### Inputs
- **Style:** transparent fill, Hairline Strong border, 10px radius, 46px tall, label above in Muted 12.5px.
- **Focus:** border turns Paper with a soft 3px ring.
- **Error:** border turns Danger with a short instruction below in Danger.

### Search
- A 38px pill with a hairline border, a small Muted search icon and placeholder text in Faint. The border turns Paper while focused.

### Form Messages
- Problems appear in a 10px-radius box with a Danger outline and Danger text, above the fields they concern. Confirmations use the same box with a Hairline Strong outline and Paper text.

### Navigation
- 60px sticky bar, translucent Ink with blur and a bottom hairline. On the left, the SightLine mark at 26px and the wordmark at 18px (see Logo). Emails use the app icon at 28px beside a 20px wordmark. Links are Muted, Paper when active. Signed out, the last item is an outlined "Sign In" pill. Signed in, it is an outlined "My Tickets" pill with a small Paper count badge, followed by a 34px circle carrying the account initial. Under 700px only those pills remain.

### Seat Map (signature)
- Small rounded squares on a transparent ground under a thin glowing arc for the screen.
- Available seats are Seat Free; taken seats are outline only; the selected seat is Tungsten; the focused seat has a white stroke. Accessible seats carry a thin Seat Accessible outline.
- Price zones are not coloured. They are bracketed down the right edge with the zone name and price.
- Row letters sit to the left in Faint.
- The most booked seats carry a small Paper dot in their centre (dimmed on a taken seat, Ink on a selected one). Under the legend, the ones still free for this show are listed as pills; tapping one previews it like a tap on the map.

### Seat Card (signature)
- A Surface card that leads with the seat name, then zone and price, then the verdict in Tungsten sentence case ("Best in the house"), with the view score as a large tabular number top right. The verdict never sits above the name as a label.
- Under the score, a small outlined Details pill. It opens a Surface Raised pop-up with the four measurements (distance, field of view, offset from centre, head tilt) as tiles and one line of plain-language hint. It closes with its X, Escape or a tap elsewhere. The measurements never fill the card itself.
- For a most-booked seat, a Surface Raised note with the Paper dot: "One of the most booked seats here, taken at 44% of shows in the last 4 weeks".
- Then Compare and Share, then the primary action.

### Seat Comparison (signature)
- Two 16:9 seat-view thumbnails side by side, each captioned with the seat and zone, above a hairline-ruled table of view score, how often each is booked, and price. The better value in a row is Paper at weight 500; the other stays Muted. No colour is used to mark a winner.

### Stage Controls (signature)
- Translucent pills floating over the 3D view: a two-option view switch top left, icon tools top right, a caption bottom left naming the seat, a compact four-way seat-hop pad bottom right.

### Home Hero
- The live 3D hall fills the first screen, playing the lead movie with its real poster on the screen, placed right of centre so it stays clear of the headline. The camera flies in once, then glides slowly from seat to seat (the best seat, an off-centre seat, the back row, near the front).
- Left: the Marquee Hero headline, capped at about five of its own letter-widths so it wraps to three lines and never covers the poster; one sentence on how it works; then Browse Movies (Primary) and Explore Cinemas (Glass). Nothing else sits over the hall: no panel, card or caption.
- The headline and sentence rise in once on load (reduced motion: no movement). A scrim darkens the left for the copy and fades into the page at the bottom.
- The one exception to "nothing else": when the visitor has chosen seats and not booked them, a single glass row sits under the buttons. A small poster, "Continue booking" in Tungsten 12px, the title at weight 600, then the date, time and seats in Muted, one line each with an ellipsis; a hairline-divided × on the right lets the seats go (and releases any hold). While those exact seats are still held for payment, the first line reads "Continue booking · held for 06:42" and counts down in tabular figures (Danger in the last minute, as at checkout), and the row goes straight back to payment, where the same clock carries on. It disappears once the show starts or the seats are booked.
- Under 860px the hall gets its own frame at the top, about half the screen tall, and the headline overlaps its lower edge.

### Seat Comparison
- "Same hall, two seats": two real renders of the same large-screen auditorium with the house lights up, side by side (stacked on phones): first from the front row, then from the best seat. The images stand alone in rounded frames with a hairline border; the sentence above says which is which. No caption, overlay or score on the images.

### How It Works
- Three steps on the left (a real sequence, so numbered: marquee numerals, Tungsten when active), one large real screenshot of the app on the right in a 16:9 frame. Steps are tabs: clicking or arrow keys switch the screenshot with a short crossfade; only the active step shows its sentence. Under 900px each step shows its own screenshot beneath it and every sentence is visible.

### Cinema Tiles
- On the home page all eight cinemas sit in a 4 by 2 grid of 4:3 photo tiles (2 columns on tablets and phones), each a link: the photo, a dark fade at the bottom, the name in marquee capitals and the area beneath. Stand-in photos keep their "Representative photo" pill. The photo zooms 4% on hover.

### Movie Card
- The poster at 2:3 with a small "New this week" tag in its corner for releases under a week old, then the title at Title size and two Muted lines: language and two genres, then runtime and how many cinemas show it today. The whole card links to the movie.

### Cinema Card
- A Surface card linking to the cinema: a 5:3 photo of the building (a representative photo carries a small translucent "Representative photo" pill), the cinema name at Title size, the area with a small map pin, its auditorium formats as Status Tags, and a hairline footer with today's title and screen counts. The photo zooms 3% on hover.

### Cinema Hero
- The cinema page opens on two photos side by side (2:1 columns, stacked on narrow screens): the building at 21:8 in a rounded frame, and the lobby and snack counter, labelled with a translucent pill and, when it is a stand-in, a "Representative photo" pill. The building photo has a bottom scrim, the name at Statement size and the area and chain beneath. A small translucent pill top-right credits the photographer and licence and links to Photo Credits.
- Below it, one card per auditorium with a render from that auditorium's own 3D model, seen from a back-row seat with the house lights up. Never a seat plan here.

### Event Card
- A live show: a 16:10 photo with the kind (Comedy, Music, Sports, Theatre) in a translucent pill top-left, then the title at Title size, the tagline in Muted, when and where it plays next, and the lowest price. Same Surface card, hover lift and photo zoom as the Cinema Card.

### Admin
- A plain working surface: the page title and a pill tab bar (Overview, Shows, Titles, Prices, Bookings, Customers, Messages), then Surface panels. Overview leads with eight stat tiles, including new messages and the seat-choice rating, (value at Headline size above a Muted label), a single-series bar chart of the last 14 days in Muted bars that turn Paper on hover with a tooltip, two ranked lists with thin Muted bars, and the latest bookings.
- Forms (Add a show, Add a movie or live show, Prices) use labelled 42px fields on Ink Raised with a Hairline Strong border, laid out in a four-column grid that drops to two and then one column on narrow screens. Each price field shows its default beside the zone name.
- Tables use Faint 12px headers, hairline rows, tabular figures right-aligned, and a Muted sub-line under each primary value. Destructive actions take two steps: a Secondary "Cancel", then a Danger confirmation beside a Text "Keep".
- Messages opens with the seat-choice rating: the average at Headline-plus size, "out of 5, from N ratings" in Muted, and five thin Muted bars for how many gave each answer, then the latest comments in quotation marks. Below, the messages with pill filters (New, Replied, Closed, All, each with its count). A message shows the sender and address, a Status Tag (New stays Muted; Replied and Closed use Available), the topic, booking reference and time in Muted 13px, the text as written, then Reply by Email (Secondary, a mailto link), Mark Replied and Close or Reopen (Text).

### Contact Page
- "Contact Us" at Headline size with one sentence, then a 640px form card beside a "Quicker Answers" list of hairline-ruled links to My Tickets and Help topics (stacked under 980px).
- The topic is a row of pills that work as radio buttons (Booking or ticket problem, Feedback or idea, Cinema partnership, Something else); the chosen one inverts to Paper. Name and email sit side by side (stacked under 700px) and start filled in for a signed-in visitor. A booking reference field appears only for the booking topic. The message box shows a tabular "0 / 2,000" count.
- A link from a ticket opens the page on the booking topic with that reference filled in. A hidden field catches bots and is never shown or reachable by keyboard.
- Sent, the card is replaced by a confirmation: an Available check, "Message Sent", the reference, the reply address, and Send Another Message. Only a signed-in visitor writing from their own account address gets an emailed receipt.
- The Help page ends its questions with a "Still Need Help?" Surface band and a Secondary Contact Us button; the footer's Support column links to it too.

### Showtimes
- On a movie or live show page, one Surface card per cinema: the name (a link to the cinema) and its area, with a small underlined "Get directions" link (the ticket's style) that opens Google Maps, then one row per auditorium. On wide screens the link sits at the right of the name; under 700px the name takes the whole line and the link moves to the end of the area line, so every card puts it in the same place. Each row has the format as a Status Tag and "Audi 1 · from ₹250" on the left, and its times as outlined tiles on the right. Each tile shows the time in tabular figures with the best view score still free for the group beside it, then a coloured dot with "Available", "Filling fast" or "Almost full"; a show that has started is dimmed and not a link.
- The score sits in a small Ink pill, its digits coloured on the heatmap's red to amber to green ramp, so it stays legible when the tile inverts to Paper on hover. "–" means no seats are left together for the group. A tile links to the booking page opened at the middle of those best seats.
- Above the cards, the day tiles, then one row with the pill filter for auditorium type (All, Large screen, Recliner, Standard) on the left and the Seats stepper on the right, and one Muted 13px sentence saying what the number means for the current group size. The day and filter live in the URL; the group size is the visitor's own and is remembered in the browser, and Pick for Me on the booking page uses the same number.
- Under 700px the times sit three to a row in equal columns; under 400px the tiles and score pills lose a little side padding, so a time and a score of 100 still share one line.
- The booking page's show bar repeats the number: each time in its switcher carries the same score pill, so switching shows never loses it. The current show's number comes from the seat map's own live data, so it always matches what Pick for Me chooses, and another time opens at the middle of its best seats.
- On a cinema page the same rows sit under each movie's poster and title instead; under 700px the poster shrinks beside the title and the times run the full width of the card. The cinema hero carries a Glass "Get Directions" button that opens Google Maps.

### Ticket
- An 18px-radius Surface card split by a dashed divider into details and a stub with a white-backed QR code and the booking reference in spaced capitals. Prints as black on white.
- Under the cinema name, a small underlined "Get directions" link opens Google Maps; it is left out of the printed ticket. The actions below the card are Print Ticket and Add to Calendar (Secondary) and Browse Movies or Browse Live Shows (Primary), matching what was booked.
- Below it, a Price Breakdown card: hairline-ruled rows of tickets and convenience fee, each followed by an indented Muted 13px line with the GST it includes, then the total at weight 600. Figures are tabular.
- After the actions, a Surface card asks "How Easy Was Choosing Your Seat?" with five equal 14px-radius options (a tabular number over a 12px word, Very hard to Very easy) that work as radio buttons; the chosen one inverts to Paper. Choosing one reveals an optional comment box, and Send Rating stays disabled until then. Once sent, the card shrinks to one line ("You rated choosing your seat 5 out of 5, very easy") with a Text Change Rating. A Muted 13px line beneath, "Something wrong with this booking? Contact us", opens the Contact page for that booking. Neither is printed.

### Loading Placeholders
- While data loads, Surface Raised blocks in the shape of the coming content (ticket rows, a ticket, lines of text) hold the layout. They pulse gently in opacity, never with a gradient sweep, and rest under reduced motion. Screen readers hear a "Loading…" label instead.

### Confirmation Banner
- A full-width Ink Raised strip under the navigation with a bottom hairline, shown until the account's email is confirmed. Muted 13.5px text with the address in Paper, and small Secondary buttons on the right. It is a reminder, not an alert: no Danger or Tungsten.

### Status Tags
- 12px sentence-case pills with a hairline outline, used beside a value to state its condition ("Confirmed", "Not confirmed"). Confirmed uses Available; pending stays Muted. Never used as a heading or kicker.

### Account Lists
- Rows separated by hairlines: the item in Paper at weight 500 with a Muted 13px detail line beneath (for a device, "This device" or how long ago it was active), and a small Secondary action on the right.

## Do's and Don'ts

### Do:
- **Do** keep the interface neutral and let movie artwork and the 3D hall carry the colour.
- **Do** reserve Tungsten for the visitor's selection and the verdict on it.
- **Do** separate surfaces with a tonal step and a 1px hairline.
- **Do** make every pressable control a pill and every container a soft rectangle.
- **Do** state seat facts as numbers with units, in tabular figures.
- **Do** give exactly one Paper-filled primary button per view.

### Don't:
- **Don't** use gradients on buttons, text, badges or backgrounds.
- **Don't** use glows, neon colours or coloured drop shadows.
- **Don't** use `box-shadow` for elevation.
- **Don't** set interface text in the poster typefaces (Bebas Neue, Playfair Display).
- **Don't** put a small label or kicker above a heading. The heading carries its own weight.
- **Don't** set functional text below 11px, and don't let any text fall below 4.5:1 contrast on the surface it sits on. Faint is the lowest text colour.

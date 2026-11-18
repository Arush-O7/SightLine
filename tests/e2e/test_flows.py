"""
Browser tests for the main flows, run in the installed Chrome.

    npm run dev                 # in one terminal
    npm run test:e2e            # in another

BASE=http://localhost:8787 tests a production build instead.
"""

import os
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

BASE = os.environ.get("BASE", "http://localhost:5173").rstrip("/")
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

passed = 0
failed = 0
console_errors: list[str] = []

def check(name: str, fn) -> None:
    global passed, failed
    try:
        fn()
        passed += 1
        print(f"PASS  {name}")
    except Exception as err:  # noqa: BLE001 - every failure is reported, then the run continues
        failed += 1
        message = (str(err).strip() or type(err).__name__).splitlines()[0][:300]
        print(f"FAIL  {name}\n      {message}")

def go(page: Page, path: str) -> None:
    page.goto(f"{BASE}/#{path}")
    page.wait_for_load_state("networkidle")

def no_sideways_scroll(page: Page) -> None:
    width = page.evaluate("document.documentElement.scrollWidth")
    viewport = page.evaluate("innerWidth")
    assert width <= viewport + 1, f"page is {width}px wide in a {viewport}px window"

def watch_console(page: Page) -> None:
    def on_console(msg):
        # expected answers: 401 when signed out, 402 for the deliberately declined test card
        if msg.type == "error" and not re.search(r"status of (401|402|404)", msg.text):
            console_errors.append(msg.text)

    page.on("console", on_console)
    page.on("response", lambda r: r.status == 404 and console_errors.append(f"404 {r.url}"))
    page.on("pageerror", lambda err: console_errors.append(str(err)))

def desktop(browser):
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    watch_console(page)
    return context, page

def run() -> None:
    with sync_playwright() as p:
        # the installed Chrome, headless: no separate browser download needed
        browser = p.chromium.launch(channel="chrome", headless=True)
        context, page = desktop(browser)

        def home():
            go(page, "/")
            expect(page.locator("h1")).to_have_text("See your seat before you book it")
            expect(page.locator(".home-hero-facts")).to_contain_text("cinemas in Delhi")
            page.screenshot(path=SHOTS / "01-home.png")

        check("home: headline and city facts", home)

        def live_hall():
            # the 3D hall loads after the page and starts its tour
            expect(page.locator(".home-hero-live.on")).to_be_visible(timeout=15000)
            expect(page.locator(".hero-hall canvas")).to_have_count(1)

        check("home: the live 3D hall starts", live_hall)

        def seat_demo():
            score = page.locator(".seat-demo-score b")
            best = score.inner_text()
            page.get_by_role("button", name="Back Corner").click()
            expect(page.get_by_role("button", name="Back Corner")).to_have_attribute("aria-pressed", "true")
            assert score.inner_text() != best, "the score did not change for another seat"
            expect(page.locator(".seat-demo .hall-plan rect.on")).to_have_count(1)
            page.locator(".seat-demo").get_by_role("button", name="Details").click()
            expect(page.locator(".seat-demo .seat-details-pop")).to_contain_text("field of view")
            page.locator(".seat-demo").get_by_role("button", name="Close details").click()

        check("home: seat demo switches seats", seat_demo)

        def language_filter():
            page.get_by_role("button", name="Tamil", exact=True).click()
            expect(page.locator(".movie-card")).to_have_count(1)
            page.get_by_role("button", name="All", exact=True).click()
            expect(page.locator(".movie-card").nth(3)).to_be_visible()

        check("home: language filter", language_filter)

        def search():
            page.get_by_role("searchbox").fill("rajinikanth")
            expect(page.locator(".movie-card")).to_have_count(1)
            page.get_by_role("searchbox").fill("zzzz")
            expect(page.get_by_text("No movies match")).to_be_visible()
            page.get_by_role("button", name="Clear Filters").click()
            expect(page.locator(".movie-card").nth(1)).to_be_visible()

        check("home: search filters and clears", search)

        def film_page():
            go(page, "/movie/ramayana-rise-of-a-legend")
            expect(page.locator("h1")).to_have_text("Ramayana: Rise of a Legend")
            # tomorrow always has bookable shows
            page.locator(".day").nth(1).click()
            assert page.locator(".venue").count() >= 3, "expected several cinemas"
            page.get_by_role("button", name="Recliner", exact=True).click()
            expect(page.locator(".screen-row .badge").first).to_have_text("Recliner")
            page.get_by_role("button", name="All", exact=True).click()
            page.locator(".venue a.time").first.click()
            page.wait_for_url(re.compile(r"#/book/"))

        check("film page: pick a day, a cinema and a showtime", film_page)

        def booking_header():
            expect(page.locator(".bk-title span")).to_contain_text(re.compile(r"Audi|Main Hall"))

        check("booking: header names the cinema and auditorium", booking_header)

        def booking_view():
            page.wait_for_selector(".seatmap")
            expect(page.locator(".stage canvas").first).to_be_visible()
            expect(page.locator(".seat-card h2")).to_contain_text("Row")
            page.wait_for_timeout(1200)  # let the camera settle for the screenshot
            page.screenshot(path=SHOTS / "02-booking.png")

        check("booking: 3D view, seat map and seat card render", booking_view)

        def popular_seats():
            expect(page.locator(".seatmap-pop").first).to_be_attached()
            picks = page.locator(".popular-picks-list .chip")
            assert picks.count() >= 1, "no most-booked seats are offered"
            seat = picks.last.inner_text()
            picks.last.click()
            expect(page.locator(".seat-card h2")).to_contain_text(f"Seat {int(seat[1:])}")
            expect(page.locator(".seat-card-pop")).to_contain_text("most booked")
            picks.first.click()

        check("booking: most booked seats are marked and can be picked", popular_seats)

        def seat_details():
            expect(page.locator(".seat-card .stats")).to_have_count(0)
            page.locator(".seat-card").get_by_role("button", name="Details").click()
            expect(page.locator(".seat-details-pop")).to_contain_text("to screen")
            page.keyboard.press("Escape")
            expect(page.locator(".seat-details-pop")).to_have_count(0)

        check("booking: measurements open from the Details button", seat_details)

        def select_and_sign_in():
            page.get_by_role("button", name=re.compile(r"^Select Seat")).click()
            page.get_by_role("button", name="Sign In to Continue").click()
            page.wait_for_url(re.compile(r"#/login"))
            page.get_by_role("button", name="Continue With Demo Account").click()
            # signing in continues straight to payment, which holds the seats itself
            page.wait_for_url(re.compile(r"#/checkout/"))
            expect(page.locator(".hold")).to_contain_text("held", timeout=8000)

        check("booking: select a seat, sign in with the demo account, go on to payment", select_and_sign_in)

        def checkout_declined_then_paid():
            expect(page.get_by_role("heading", name="Review and Pay")).to_be_visible()
            page.locator(".method", has_text="Card").click()
            page.get_by_role("button", name="Fill Test Details").click()
            page.locator("input[name=cardnumber]").fill("4000 0000 0000 0002")
            page.get_by_role("button", name=re.compile(r"^Pay ")).click()
            expect(page.locator(".form-error")).to_be_visible(timeout=8000)
            page.locator("input[name=cardnumber]").fill("4111 1111 1111 1111")
            page.screenshot(path=SHOTS / "03-checkout.png")
            page.get_by_role("button", name=re.compile(r"^Pay ")).click()
            page.wait_for_url(re.compile(r"#/ticket/"), timeout=15000)
            expect(page.get_by_role("heading", name=re.compile(r"You’re Booked"))).to_be_visible()
            expect(page.locator(".price-breakdown")).to_contain_text("GST")
            page.screenshot(path=SHOTS / "04-ticket.png", full_page=True)

        check("checkout: a declined card shows an error, an approved card books", checkout_declined_then_paid)

        booked_id = page.url.rsplit("/", 1)[-1]

        def ticket_later():
            go(page, f"/ticket/{booked_id}")
            expect(page.get_by_role("heading", name="Your Ticket")).to_be_visible()

        check("ticket: opened later it shows the plain header", ticket_later)

        def my_tickets_cancel():
            go(page, "/bookings")
            row = page.locator(".booking-item", has_text=booked_id)
            expect(row).to_be_visible()
            row.get_by_role("button", name=f"Cancel booking {booked_id}").click()
            row.get_by_role("button", name="Cancel Booking").click()
            expect(page.locator(".form-ok")).to_contain_text("cancelled")
            expect(page.locator(".booking-item", has_text=booked_id)).to_have_count(0)

        check("my tickets: the new booking is listed and can be cancelled", my_tickets_cancel)

        def inbox():
            go(page, "/demo/inbox")
            expect(page.locator(".inbox-list")).to_contain_text("cancelled")

        check("demo inbox: the cancellation email arrived", inbox)

        def account():
            go(page, "/account")
            expect(page.get_by_role("heading", name="Devices")).to_be_visible()
            expect(page.locator(".device-list")).to_contain_text("This device")

        check("account: devices list shows this device", account)

        def help_page():
            go(page, "/help")
            expect(page.get_by_role("navigation", name="Help topics")).to_be_visible()
            question = page.locator("summary", has_text="What is the view score?")
            question.click()
            expect(page.get_by_text("A number out of 100")).to_be_visible()

        check("help: topics and answers open", help_page)

        def cinema_page():
            go(page, "/cinemas")
            page.locator(".cinema-card").first.click()
            page.wait_for_url(re.compile(r"#/cinema/"))
            expect(page.locator(".screen-card").first).to_be_visible()
            assert page.locator(".venue-movie").count() >= 1
            # the building photo and the auditorium renders actually load
            page.wait_for_function("[...document.querySelectorAll('.cinema-hero img, .screen-card img')].every(i => i.complete && i.naturalWidth > 0)", timeout=15000)

        check("cinemas: list and a cinema's page with photos, screens and movies", cinema_page)

        def live_shows():
            go(page, "/events")
            cards = page.locator(".event-card")
            expect(cards.nth(5)).to_be_visible()
            page.get_by_role("button", name="Comedy", exact=True).click()
            expect(cards).to_have_count(1)
            cards.first.click()
            page.wait_for_url(re.compile(r"#/movie/delhi-comedy-night"))
            expect(page.locator(".meta-row .badge")).to_have_text("Comedy")
            expect(page.get_by_role("link", name="All live shows")).to_be_visible()

        check("live shows: list, filter and a show's page", live_shows)

        def staff_only():
            go(page, "/admin")
            expect(page.get_by_role("heading", name="Staff only")).to_be_visible()

        check("admin: customers are kept out", staff_only)

        def admin_flow():
            staff = browser.new_context(viewport={"width": 1440, "height": 900})
            spage = staff.new_page()
            watch_console(spage)
            go(spage, "/login")
            spage.get_by_role("button", name=re.compile("demo admin")).click()
            spage.wait_for_url(re.compile(r"#/admin"))
            expect(spage.locator(".admin-tiles dd").first).to_contain_text("₹")
            spage.get_by_role("link", name="Shows", exact=True).click()
            spage.get_by_label("Day").select_option(index=1)  # tomorrow, so late in the day there are still shows to cancel
            row = spage.locator(".admin-list li").filter(has=spage.get_by_role("button", name="Cancel", exact=True)).first
            title = row.locator("b").inner_text()
            row.get_by_role("button", name="Cancel", exact=True).click()
            spage.get_by_role("button", name=re.compile(r"^Cancel (Show|and Refund)")).click()
            expect(spage.locator(".form-ok")).to_contain_text(f"{title} at")
            spage.get_by_role("button", name="Restore").first.click()
            expect(spage.locator(".form-ok")).to_contain_text("back on sale")
            spage.screenshot(path=SHOTS / "08-admin-shows.png")

            # add a live show title, then take it away again
            spage.get_by_role("link", name="Titles", exact=True).click()
            form = spage.locator(".admin-title-form")
            form.get_by_label("Type").select_option("theatre")
            form.get_by_label("Title").fill("Test Play Tonight")
            form.get_by_label("Genres, comma-separated").fill("Drama")
            form.get_by_label("Language").fill("Hindi")
            form.get_by_label("Summary").fill("A short play written for the browser tests.")
            form.get_by_role("button", name="Add Title").click()
            expect(spage.locator(".form-ok")).to_contain_text("Test Play Tonight is added")
            row = spage.locator(".admin-list li").filter(has_text="Test Play Tonight")
            row.get_by_role("button", name="Remove", exact=True).click()
            row.get_by_role("button", name="Remove Title").click()
            expect(spage.locator(".form-ok")).to_contain_text("is removed")

            # change a price and put it back
            spage.get_by_role("link", name="Prices", exact=True).click()
            panel = spage.locator(".admin-price-grid form").filter(has_text="Standard")
            panel.locator("input").first.fill("200")
            panel.get_by_role("button", name="Save Prices").click()
            expect(spage.locator(".form-ok")).to_contain_text("prices are saved")
            expect(panel.locator("input").first).to_have_value("200")
            panel.get_by_role("button", name="Reset to Defaults").click()
            expect(spage.locator(".form-ok")).to_contain_text("back to the defaults")
            staff.close()

        check("admin: shows, titles and prices", admin_flow)

        def not_found():
            go(page, "/no-such-page")
            expect(page.get_by_role("link", name="Browse Movies")).to_be_visible()
            expect(page.get_by_role("link", name="Get Help")).to_be_visible()

        check("404: two ways out", not_found)

        context.close()

        def sign_up_validation():
            # a fresh, signed-out browser
            fresh, spage = desktop(browser)
            go(spage, "/signup")
            expect(spage.locator("h1")).to_have_text("Create Your Account")
            spage.locator("input[name=email]").fill("riya@")
            spage.locator("input[name=email]").blur()
            expect(spage.get_by_text("Enter an email like name@example.com.")).to_be_visible()
            expect(spage.locator("input[name=name]")).to_have_attribute("aria-invalid", "false")
            fresh.close()

        check("sign-up: an email is checked when you leave the field", sign_up_validation)

        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        mpage = phone.new_page()
        watch_console(mpage)
        for path, name in [("/", "home"), ("/movie/jailer-2", "film"), ("/events", "live shows"), ("/cinemas", "cinemas"), ("/help", "help"), ("/signup", "sign-up")]:
            def phone_page(path=path, name=name):
                go(mpage, path)
                no_sideways_scroll(mpage)
                mpage.screenshot(path=SHOTS / f"phone-{name}.png")

            check(f"phone: {name} fits the screen", phone_page)

        def phone_inputs_16px():
            go(mpage, "/signup")
            size = mpage.locator("input[name=email]").evaluate("e => getComputedStyle(e).fontSize")
            assert size == "16px", f"input text is {size}; iPhones zoom into fields under 16px"

        check("phone: form fields are 16px", phone_inputs_16px)
        phone.close()
        browser.close()

    def clean_console():
        assert not console_errors, f"{len(console_errors)} errors, first: {console_errors[0][:200]}"

    check("no errors in the browser console", clean_console)

if __name__ == "__main__":
    run()
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)

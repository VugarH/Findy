/**
 * Terms of use and privacy policy. Plain language, describing what the site
 * really does; keep it in step with the code (what is stored, for how long).
 * {site} is replaced with the site's name. Have a lawyer review changes.
 */
const legalEn = {
  updated: "Last updated: {date}",
  terms: {
    title: "Terms of use",
    intro:
      "These terms apply when you use {site}: the website, our Telegram bot and our Telegram channel. By using the site or creating an account you agree to them. If you don't agree, please don't use the site.",
    sections: [
      {
        heading: "What {site} is",
        paragraphs: [
          "We compare prices from online stores in Azerbaijan and abroad and show which offers are real discounts. We are not a store: we don't sell the products listed, and a purchase is between you and the store you choose.",
          "When you press “Go to store” you leave our site. From then on, that store's own terms, prices and policies apply.",
        ],
      },
      {
        heading: "Prices and information",
        paragraphs: [
          "Prices, stock and sizes are collected automatically from the stores, usually once a day, and can change at any time.",
          "The total price we show (item, delivery, customs and fees) is an estimate based on current exchange rates and customs rules. A discount marked “store's discount” is the store's own claim; “verified” means our own price history backs it.",
          "We do our best to keep everything correct but can't guarantee it. Always check the final price in the store before you pay.",
        ],
      },
      {
        heading: "Your account",
        paragraphs: [
          "You need an account for price alerts, follows, messages and order requests. Give correct details, keep your password secret, and tell us if you think someone else used your account.",
          "You must be at least 16 years old to create an account. We may suspend accounts that break these terms or misuse the site.",
        ],
      },
      {
        heading: "“Order it for me”",
        paragraphs: [
          "For products from abroad we can buy and ship them on your behalf. A request, a message or an estimate on the site is not an order: no money is taken until we have agreed the final price, the delivery time and our service fee with you.",
          "Payment, delivery and returns for each order are confirmed with you before you pay. Returns and warranty follow the selling store's rules.",
        ],
      },
      {
        heading: "Messages",
        paragraphs: [
          "Messages are for questions and requests about buying. Don't send anything unlawful, abusive or spam. We may close conversations or limit messaging for accounts that misuse it.",
        ],
      },
      {
        heading: "Using the site fairly",
        paragraphs: [
          "Don't try to break or overload the site, copy it in bulk, get around its limits, or access other people's accounts.",
          "Product names, photos and brands belong to their owners; we show them to identify products and link to the stores. The site's own design and text belong to {site}.",
        ],
      },
      {
        heading: "Responsibility",
        paragraphs: [
          "The site is provided as it is. As far as the law allows, we are not responsible for the stores' products, prices, delivery or service, or for losses caused by relying on information on the site. Nothing here limits the rights you have as a consumer under the law.",
        ],
      },
      {
        heading: "Changes and contact",
        paragraphs: [
          "We may update these terms; the date at the top shows the current version. If a change matters for you, we will tell you on the site.",
          "These terms are governed by the law of the Republic of Azerbaijan. Questions? Write to us through Messages on the site.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro:
      "This explains what personal data {site} collects, why, and what you can do about it. We keep it to what the site needs, and we never sell it.",
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Your account: name, email, an optional phone number, your language and your settings. Your password is stored only as a secure hash that nobody can read.",
          "What you do with your account: products you watch, brands, stores and categories you follow, messages and requests you send us (with the phone and delivery city you give, and the items you attach from our site or your cart, with their prices at the time), and older “Order it for me” requests (name, phone, email, city and note). Your cart and your favorites are kept in your own browser (favorites are sent to us only to show their current prices, and are not stored); we only see the items you attach to a request.",
          "If you connect our Telegram bot: your Telegram chat id and username. If you allow browser notifications: the address your browser gives us for them.",
          "Recommendations: to suggest deals, your browser keeps a short list of the categories, types and brands of products you opened or searched for. It stays on your device; when “Recommended for you” is shown, it is sent to us only to pick the deals and is not stored. “Clear my interests” under the recommendations deletes it.",
          "Visits: pages viewed, searches, clicks to stores, the site that sent you, device type and language. These are counted with an anonymous id that changes every day; we don't store your IP address for this and use no advertising or tracking cookies.",
          "Security: failed sign-in attempts are logged with the email that was entered and the IP address, to protect accounts.",
        ],
      },
      {
        heading: "Why we use it",
        paragraphs: [
          "To run your account and the features you use, answer your messages and handle your requests, send the alerts you ask for, keep the site secure, and understand how the site is used (in totals only) so we can improve it.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "We use only necessary cookies: one that keeps you signed in, and small ones that remember your language, light or dark theme, and how many products per page you prefer.",
        ],
      },
      {
        heading: "Who handles your data",
        paragraphs: [
          "We don't sell your data or share it for advertising. It is stored with the companies that run the site for us: Vercel (hosting, in the EU), Neon (database, in Frankfurt) and Resend (account emails such as address confirmation and password reset), and Telegram if you connect our bot.",
          "When you go to a store, that store's own privacy policy applies.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Account data, messages and requests: until your account is deleted. Detailed visit statistics: 90 days, after which only daily totals without personal data remain. Security logs: up to 30 days.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can see and correct your details, ask for a copy of your data, and ask us to delete your account and data. You can turn off alerts and disconnect Telegram on the site at any time. For anything else, write to us through Messages.",
          "The site is not meant for children under 16.",
        ],
      },
      {
        heading: "Changes and law",
        paragraphs: [
          "If this policy changes, we update the date at the top and tell you on the site if the change matters for you. We handle personal data in line with the law of the Republic of Azerbaijan.",
        ],
      },
    ],
  },
};

export default legalEn;
export type LegalDictionary = typeof legalEn;

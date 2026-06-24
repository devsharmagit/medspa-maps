import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const serviceFaqs = {
  "coolsculpting": [
    { q: "How long does a CoolSculpting session take?", a: "Each session typically takes about 35 to 60 minutes per treated area, depending on the applicator used." },
    { q: "When will I see results from CoolSculpting?", a: "You may start to see changes as quickly as three weeks after your treatment, with the most dramatic results visible after two months." },
    { q: "Is the fat loss permanent?", a: "Yes, once the treated fat cells are crystallized (frozen), your body naturally processes and eliminates them. Once gone, they do not return." }
  ],
  "laser-skin-resurfacing": [
    { q: "Does laser skin resurfacing hurt?", a: "Most patients describe the sensation as a rubber band snapping against the skin. We use topical numbing cream to minimize any discomfort." },
    { q: "How much downtime should I expect?", a: "Downtime varies depending on the depth of the treatment. Light resurfacing may require 3-5 days of social downtime, while deeper treatments can take up to 2 weeks." },
    { q: "How many sessions will I need?", a: "Many patients see significant improvement after a single session, though a series of 2-3 treatments may be recommended for optimal results." }
  ],
  "body-contouring": [
    { q: "Am I a good candidate for body contouring?", a: "Ideal candidates are close to their target weight but have stubborn areas of fat or loose skin that haven't responded to diet and exercise." },
    { q: "Is body contouring a weight-loss treatment?", a: "No, body contouring is designed to sculpt and shape the body by targeting specific areas of fat, not for overall weight loss." },
    { q: "Are the results immediate?", a: "Results typically develop gradually over 1 to 3 months as the body processes the targeted fat cells and produces new collagen." }
  ],
  "ultherapy": [
    { q: "What is Ultherapy?", a: "Ultherapy is a non-invasive treatment that uses microfocused ultrasound energy to lift and tighten the skin naturally." },
    { q: "How long does an Ultherapy treatment take?", a: "A face and neck procedure typically takes 60-90 minutes, while a chest treatment takes approximately 30 minutes." },
    { q: "How long do the results last?", a: "Results unfold over 2-3 months and can last up to a year or more, depending on your body's natural aging process." }
  ],
  "pdo-threads": [
    { q: "What are PDO threads?", a: "PDO (Polydioxanone) threads are medical-grade absorbable sutures used to gently lift sagging skin and stimulate collagen production." },
    { q: "How long do PDO threads last?", a: "The threads dissolve naturally over 6-9 months, but the collagen stimulation they create can maintain the lifting effect for 12-18 months." },
    { q: "Is there any downtime after a thread lift?", a: "You may experience mild swelling, bruising, or soreness for a few days, but most patients resume normal activities within 24-48 hours." }
  ],
  "prp-prf": [
    { q: "What is the difference between PRP and PRF?", a: "Both use your own blood, but PRF (Platelet-Rich Fibrin) is spun at a lower speed, retaining more white blood cells and stem cells for a slower, longer-lasting release of growth factors." },
    { q: "What can PRP/PRF treat?", a: "They are commonly used for hair restoration, skin rejuvenation (often combined with microneedling), and treating dark under-eye circles." },
    { q: "How many treatments will I need?", a: "Most providers recommend a series of 3-4 treatments spaced 4-6 weeks apart for the best results." }
  ],
  "laser-hair-removal": [
    { q: "Is laser hair removal permanent?", a: "It offers long-term hair reduction, significantly decreasing hair growth. Some maintenance treatments may be needed over time." },
    { q: "How many sessions are required?", a: "Hair grows in cycles, so typically 6-8 sessions are needed to target all hair follicles during their active growth phase." },
    { q: "Does laser hair removal work on all skin and hair colors?", a: "Modern lasers are safe for all skin tones, but the treatment is most effective on dark hair. It is generally not effective on blonde, gray, or red hair." }
  ],
  "rf-skin-tightening": [
    { q: "How does Radiofrequency (RF) skin tightening work?", a: "RF energy heats the deep layers of the skin, causing immediate collagen contraction and stimulating the production of new collagen over time." },
    { q: "Does the treatment hurt?", a: "Most patients find the treatment very comfortable, often comparing it to a warm stone massage." },
    { q: "When will I see results?", a: "Some immediate tightening is often visible, but optimal results typically appear 2-3 months after a series of treatments." }
  ],
  "chemical-peels": [
    { q: "Will my skin actually peel off?", a: "Not necessarily. Depending on the depth of the peel, you may experience light flaking to sheet peeling. Some superficial peels cause no visible peeling at all." },
    { q: "What do chemical peels treat?", a: "Peels are excellent for treating acne, hyperpigmentation, melasma, fine lines, and uneven skin texture." },
    { q: "How should I prep for a chemical peel?", a: "Discontinue retinols, exfoliating acids, and avoid sun exposure for at least 3-5 days before your peel." }
  ],
  "ipl-photofacial": [
    { q: "What does IPL treat?", a: "Intense Pulsed Light (IPL) effectively treats sun damage, age spots, freckles, rosacea, and broken capillaries." },
    { q: "What happens to the dark spots after treatment?", a: "Pigmented spots will darken (sometimes looking like coffee grounds) and naturally flake off over 1-2 weeks." },
    { q: "Can I wear makeup after an IPL treatment?", a: "Yes, you can apply makeup immediately after the treatment, though you must be diligent about applying sunscreen." }
  ]
};

async function main() {
  console.log("Seeding remaining FAQs...");
  
  let servicesUpdated = 0;
  for (const [slug, faqs] of Object.entries(serviceFaqs)) {
    const res = await pool.query(
      `UPDATE services SET faqs = $1, updated_at = now() WHERE slug = $2 RETURNING id`,
      [JSON.stringify(faqs), slug]
    );
    if (res.rowCount && res.rowCount > 0) servicesUpdated++;
  }
  
  console.log(`Updated ${servicesUpdated} services with FAQs.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const serviceFaqs = {
  "botox": [
    { q: "How long does Botox take to work?", a: "You'll typically start seeing results within 3 to 5 days, with full results visible in 10 to 14 days." },
    { q: "Does getting Botox hurt?", a: "Most patients experience very minimal discomfort. We use ultra-fine needles, and the injections take just a few minutes." },
    { q: "How long does Botox last?", a: "Results generally last 3 to 4 months. With regular treatments, the muscles may become trained to relax, potentially extending the time between sessions." }
  ],
  "dermal-fillers": [
    { q: "Are dermal fillers permanent?", a: "No, most dermal fillers are made of hyaluronic acid which your body naturally breaks down over time. Results typically last 6 to 18 months depending on the specific product and area treated." },
    { q: "What is the downtime after fillers?", a: "Most patients return to normal activities immediately. You may experience mild swelling or bruising for 1-3 days, which can usually be covered with makeup." },
    { q: "Can filler be dissolved if I don't like it?", a: "Yes! Hyaluronic acid fillers can be completely dissolved using an enzyme called hyaluronidase if you are unhappy with the results or experience a complication." }
  ],
  "kybella": [
    { q: "How many Kybella treatments will I need?", a: "Most patients need 2 to 4 treatment sessions spaced about 4-6 weeks apart to achieve optimal results." },
    { q: "Is the fat reduction from Kybella permanent?", a: "Yes, once the fat cells are destroyed by the deoxycholic acid in Kybella, they can no longer store or accumulate fat." },
    { q: "What should I expect during recovery?", a: "Swelling is very common and actually indicates the product is working. Significant swelling typically peaks at 2-3 days and resolves over the following week." }
  ],
  "microneedling": [
    { q: "How many microneedling sessions are recommended?", a: "For general rejuvenation, 3 sessions spaced 4-6 weeks apart are typical. For deeper acne scars, 4-6 sessions may be recommended." },
    { q: "What does my skin look like immediately after?", a: "Your skin will likely look and feel like you have a mild sunburn for 24-48 hours. Most redness subsides by the second day." },
    { q: "Is microneedling safe for all skin tones?", a: "Yes, unlike some laser treatments, microneedling does not use heat and is generally safe for all skin types and tones with minimal risk of hyperpigmentation." }
  ],
  "hydrafacial": [
    { q: "How often should I get a HydraFacial?", a: "For optimal skin health, we recommend one treatment per month. It's an excellent maintenance treatment to keep your skin clear and glowing." },
    { q: "Can I get a HydraFacial before a big event?", a: "Yes! HydraFacial provides an immediate 'glow' with absolutely zero downtime, making it the perfect pre-event treatment." },
    { q: "Is HydraFacial good for acne?", a: "Yes, the gentle extraction and exfoliation steps help clear congested pores, while the specific serums can be tailored to address acne-prone skin." }
  ]
};

const concernFaqs = {
  "fine-lines-wrinkles": [
    { q: "At what age should I start treating fine lines?", a: "There is no 'right' age. Many patients start preventative treatments in their late 20s or early 30s when lines first begin to linger when the face is at rest." },
    { q: "What's the difference between Botox and filler for wrinkles?", a: "Botox relaxes the muscles that cause 'dynamic' wrinkles (like frowning), while fillers restore volume to plump out 'static' wrinkles and folds (like smile lines)." },
    { q: "Can skincare products eliminate wrinkles?", a: "While medical-grade skincare (especially retinoids and Vitamin C) can improve skin texture and soften early fine lines, they cannot eliminate deeper wrinkles caused by muscle movement or volume loss." }
  ],
  "acne-scars": [
    { q: "Are acne scars permanent?", a: "While completely erasing them is difficult, modern treatments like microneedling and laser resurfacing can dramatically reduce their depth and visibility to the point where they are barely noticeable." },
    { q: "How do I know what kind of acne scars I have?", a: "Acne scars are typically 'atrophic' (indented, like ice pick or boxcar scars) or 'hypertrophic' (raised). A consultation is needed to determine the type and best treatment protocol." },
    { q: "Should I treat active acne or scars first?", a: "Always treat active acne first. Performing scar treatments on actively inflamed skin can worsen the acne and create new scars." }
  ],
  "sun-damage": [
    { q: "Can sun damage be reversed?", a: "While we can't reverse cellular DNA damage, we can significantly reverse the visible signs of sun damage (brown spots, redness, and rough texture) using lasers, IPL, and chemical peels." },
    { q: "Will the brown spots come back?", a: "They can if you don't protect your skin. Daily broad-spectrum SPF 30+ and antioxidant serums are required to maintain your treatment results." },
    { q: "What is the best time of year to treat sun damage?", a: "Fall and winter are generally the best times for laser or peel treatments, as you will need to avoid sun exposure while your skin heals." }
  ],
  "skin-laxity-sagging": [
    { q: "Do non-surgical skin tightening treatments actually work?", a: "Yes, treatments like RF and Ultrasound (Ultherapy) work by heating the deep layers of skin to stimulate your body's own collagen production, resulting in gradual, natural firming." },
    { q: "How long does it take to see results from skin tightening?", a: "Because these treatments rely on your body generating new collagen, results develop gradually over 2 to 3 months following the procedure." },
    { q: "How long do the results last?", a: "Results typically last 1 to 2 years. The aging process continues, so maintenance treatments are recommended to keep ahead of natural collagen loss." }
  ],
  "double-chin-submental-fullness": [
    { q: "Is Kybella better than CoolSculpting for a double chin?", a: "It depends on the anatomy. Kybella is excellent for targeted, smaller pockets of fat, while CoolSculpting might be preferred for a larger volume of submental fat. Both permanently destroy fat cells." },
    { q: "Will I have loose skin after the fat is gone?", a: "For patients with good skin elasticity, the skin typically retracts nicely. If skin laxity is also a concern, we may recommend pairing fat reduction with a skin tightening treatment." },
    { q: "Do I need to lose weight first?", a: "No, these treatments are designed for stubborn pockets of fat that persist despite a healthy lifestyle, so you do not need to lose weight beforehand." }
  ]
};

async function main() {
  console.log("Seeding FAQs...");
  
  let servicesUpdated = 0;
  for (const [slug, faqs] of Object.entries(serviceFaqs)) {
    const res = await pool.query(
      `UPDATE services SET faqs = $1, updated_at = now() WHERE slug = $2 RETURNING id`,
      [JSON.stringify(faqs), slug]
    );
    if (res.rowCount && res.rowCount > 0) servicesUpdated++;
  }
  
  let concernsUpdated = 0;
  for (const [slug, faqs] of Object.entries(concernFaqs)) {
    const res = await pool.query(
      `UPDATE concerns SET faqs = $1, updated_at = now() WHERE slug = $2 RETURNING id`,
      [JSON.stringify(faqs), slug]
    );
    if (res.rowCount && res.rowCount > 0) concernsUpdated++;
  }
  
  console.log(`Updated ${servicesUpdated} services and ${concernsUpdated} concerns with FAQs.`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

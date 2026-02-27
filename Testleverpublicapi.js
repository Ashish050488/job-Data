import https from "https";

const bases = [
  "https://api.lever.co/v0/postings",
  "https://api.eu.lever.co/v0/postings",
];

function get(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "lever-slug-tester",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: data,
          });
        });
      }
    );

    req.on("error", (e) => resolve({ status: 0, statusMessage: e.message, headers: {}, body: "" }));
  });
}

async function testCompany(siteName) {
  for (const base of bases) {
    const url = `${base}/${siteName}?mode=json`;

    const res = await get(url);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 Testing: ${siteName}`);
    console.log(`   URL: ${url}`);
    console.log(`   Status: ${res.status} ${res.statusMessage}`);

    if (res.status === 200) {
      const ct = (res.headers["content-type"] || "").toLowerCase();
      if (!ct.includes("application/json")) {
        console.log(`   ⚠️  200 but not JSON (content-type: ${ct})`);
        console.log(`   First 120 chars: ${res.body.slice(0, 120)}`);
        return;
      }

      try {
        const jobs = JSON.parse(res.body);
        console.log(`   ✅ SUCCESS - ${jobs.length} published jobs`);
        return; // stop after first success
      } catch (e) {
        console.log(`   ⚠️  200 but JSON parse failed: ${e.message}`);
        console.log(`   First 120 chars: ${res.body.slice(0, 120)}`);
        return;
      }
    }

    // If not found on US, try EU. Otherwise stop early.
    if (res.status !== 404) return;
  }

  console.log(`   ❌ Not found on US or EU — likely not a Lever site slug`);
}

(async () => {
  const companies = ["lever", "netflix", "canva", "contentful", "personio"];
  for (const c of companies) {
    await testCompany(c);
    await new Promise((r) => setTimeout(r, 150));
  }
})();
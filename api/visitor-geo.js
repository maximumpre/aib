/**
 * API route providing geo context from edge headers.
 * Allied Irish Banks is geo-locked to Ireland (IE).
 */
export default function handler(req, res) {
  var countryHeader = req.headers["x-vercel-ip-country"];
  var isLocalTesting = process.env.ALLOW_LOCAL_TESTING === "true";
  var country = countryHeader ? String(countryHeader).toUpperCase() : (isLocalTesting ? "IE" : "Unknown");
  var region = req.headers["x-vercel-ip-country-region"] || "Unknown";
  var city = req.headers["x-vercel-ip-city"] || "Unknown";
  var asn = req.headers["x-vercel-ip-as-number"] || null;

  var isIreland = country === "IE";

  return res.status(200).json({
    country: country,
    region: region,
    city: city,
    asn: asn,
    isIreland: isIreland,
    isAllowedGeo: isIreland,
    isUs: isIreland,
  });
}


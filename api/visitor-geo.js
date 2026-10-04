/**
 * API route providing geo context from edge headers.
 */
export default function handler(req, res) {
  var country = req.headers["x-vercel-ip-country"] || "US";
  var region = req.headers["x-vercel-ip-country-region"] || "Unknown";
  var city = req.headers["x-vercel-ip-city"] || "Unknown";
  var asn = req.headers["x-vercel-ip-as-number"] || null;

  return res.status(200).json({
    country: country,
    region: region,
    city: city,
    asn: asn,
    isUs: true,
  });
}

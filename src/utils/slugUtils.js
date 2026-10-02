/**
 * Converts a string into a clean, normalized, URL-friendly slug.
 * Example: "Mobile Phones & Accessories" -> "mobile-phones-accessories"
 */
const slugify = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Strip leading/trailing hyphens
    .replace(/-{2,}/g, '-'); // Replace multiple hyphens with single hyphen
};

module.exports = {
  slugify
};

/**
 * Patch embedded HTML to display correctly inside an iframe.
 *
 * Injects CSS that ensures proper sizing and scrolling behavior
 * when HTML content is rendered via srcDoc in an iframe.
 * Also injects error handling for debugging.
 */
export function patchHtmlForIframe(html: string): string {
  const iframeCss = `<style data-iframe-patch>
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }
  /* Fix min-h-screen: in iframes 100vh is the iframe height, which is correct,
     but ensure body actually fills it */
  body { min-height: 100vh; }
</style>`;

  // Error handling script for debugging
  const errorScript = `<script data-iframe-error-handler>
// Global error handler for debugging
window.onerror = function(msg, url, line, col, error) {
  console.error('[Interactive Widget Error]', msg, 'at line', line);
  return false;
};
// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  console.error('[Interactive Widget Promise Error]', event.reason);
});
console.log('[Interactive Widget] Loaded successfully');
</script>`;

  // Insert right after <head> or at the start of the document
  const headIdx = html.indexOf('<head>');
  if (headIdx !== -1) {
    const insertPos = headIdx + 6; // after <head>
    return html.substring(0, insertPos) + '\n' + iframeCss + '\n' + errorScript + html.substring(insertPos);
  }

  const headWithAttrs = html.indexOf('<head ');
  if (headWithAttrs !== -1) {
    const closeAngle = html.indexOf('>', headWithAttrs);
    if (closeAngle !== -1) {
      const insertPos = closeAngle + 1;
      return html.substring(0, insertPos) + '\n' + iframeCss + '\n' + errorScript + html.substring(insertPos);
    }
  }

  // Fallback: prepend
  return iframeCss + '\n' + errorScript + html;
}

/*
 * Askwell embed script.
 *
 *   <script src="https://YOUR-ASKWELL-SITE/widget.js" data-business="your-slug" async></script>
 *
 * It adds one iframe to the page. The iframe is only as large as the chat
 * button until the visitor opens the chat, so it never covers the page.
 */
(function () {
  var script = document.currentScript;
  if (!script || window.__askwellLoaded) return;
  var slug = script.getAttribute("data-business");
  if (!slug) return console.warn("Askwell: add data-business to the script tag.");
  window.__askwellLoaded = true;

  var origin = new URL(script.src).origin;
  var frame = document.createElement("iframe");
  frame.src = origin + "/embed/" + encodeURIComponent(slug);
  frame.title = "Support chat";
  frame.allow = "clipboard-write";
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;border:0;z-index:2147483000;background:transparent;color-scheme:normal;";

  function size(open) {
    var small = window.innerWidth < 480;
    frame.style.width = open ? (small ? "100%" : "416px") : "240px";
    frame.style.height = open ? (small ? "100%" : "min(680px, 100%)") : "84px";
  }
  size(false);

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    if (event.data && event.data.askwell) size(event.data.askwell === "open");
  });

  (document.body || document.documentElement).appendChild(frame);
})();

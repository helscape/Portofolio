/**
 * Blog comments.
 *
 * Talks to the comments API in server.ts (/api/comments). Post pages are
 * static files, so everything here is progressive: if the API is not
 * configured the section hides itself and the page is unchanged.
 *
 * Comment text is inserted with textContent, so a comment can never inject
 * markup.
 */
(function () {
  var section = document.getElementById("comments");
  if (!section) return;

  var slug = section.getAttribute("data-slug");
  var form = section.querySelector("[data-comment-form]");
  var list = section.querySelector("[data-comment-list]");
  var empty = section.querySelector("[data-comment-empty]");
  var status = section.querySelector("[data-comment-status]");
  var button = form.querySelector('button[type="submit"]');
  var parentField = form.querySelector('input[name="parentId"]');
  var replyTo = form.querySelector("[data-reply-to]");
  var replyName = form.querySelector("[data-reply-name]");
  var replyCancel = form.querySelector("[data-reply-cancel]");
  var bodyField = form.querySelector('textarea[name="body"]');

  function setStatus(message, state) {
    status.textContent = message || "";
    if (state) status.setAttribute("data-state", state);
    else status.removeAttribute("data-state");
  }

  function formatDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }

  /** Flat list -> forest, keyed on parentId. Orphans become roots. */
  function buildTree(comments) {
    var byId = {};
    var roots = [];
    comments.forEach(function (c) {
      c.children = [];
      byId[c.id] = c;
    });
    comments.forEach(function (c) {
      if (c.parentId && byId[c.parentId]) byId[c.parentId].children.push(c);
      else roots.push(c);
    });
    return roots;
  }

  function renderNodes(nodes, container) {
    nodes.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "comment";

      var meta = document.createElement("p");
      meta.className = "comment-meta";

      var who = document.createElement("span");
      who.className = "who";
      who.textContent = c.author;
      meta.appendChild(who);
      meta.appendChild(document.createTextNode(" · " + formatDate(c.createdAt)));
      meta.appendChild(document.createTextNode(" · "));

      var reply = document.createElement("button");
      reply.type = "button";
      reply.className = "comment-reply";
      reply.textContent = "Reply";
      reply.addEventListener("click", function () {
        startReply(c);
      });
      meta.appendChild(reply);

      var body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = c.body;

      li.appendChild(meta);
      li.appendChild(body);

      if (c.children.length) {
        var sub = document.createElement("ol");
        sub.className = "comment-list";
        renderNodes(c.children, sub);
        li.appendChild(sub);
      }

      container.appendChild(li);
    });
  }

  function render(comments) {
    list.textContent = "";
    empty.hidden = comments.length > 0;
    renderNodes(buildTree(comments), list);
  }

  function startReply(comment) {
    parentField.value = comment.id;
    replyName.textContent = comment.author;
    replyTo.hidden = false;
    setStatus("");
    bodyField.focus();
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cancelReply() {
    parentField.value = "";
    replyTo.hidden = true;
  }

  function unavailable() {
    section.hidden = true;
  }

  function load() {
    return fetch("/api/comments?slug=" + encodeURIComponent(slug))
      .then(function (res) {
        if (res.status === 503) {
          unavailable();
          return null;
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json().then(function (data) {
          render(data.comments || []);
        });
      })
      .catch(function () {
        setStatus("Could not load comments.", "error");
      });
  }

  replyCancel.addEventListener("click", cancelReply);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = value;
    });
    // the slug lives on the section, not in a form field
    data.slug = slug;

    setStatus("Posting…");
    button.disabled = true;

    fetch("/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        if (res.status === 503) {
          unavailable();
          return null;
        }
        return res.json().then(function (result) {
          if (!res.ok) throw new Error(result.error || "Could not post comment.");
          return result;
        });
      })
      .then(function (result) {
        if (!result) return;
        form.reset();
        cancelReply();
        setStatus("Posted.", "ok");
        return load();
      })
      .catch(function (err) {
        setStatus(err.message || "Network error.", "error");
      })
      .then(function () {
        button.disabled = false;
      });
  });

  load();
})();

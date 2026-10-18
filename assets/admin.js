/**
 * Comment moderation.
 *
 * Lists comments for a slug (or all of them), and lets you hide, unhide or
 * delete. The admin token is kept in localStorage and sent as the
 * x-admin-token header; the server decides whether it is any good.
 */
(function () {
  var controls = document.getElementById("controls");
  var tokenField = document.getElementById("token");
  var slugField = document.getElementById("slug");
  var list = document.getElementById("list");
  var status = document.getElementById("status");

  tokenField.value = localStorage.getItem("adminToken") || "";

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

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    headers["x-admin-token"] = tokenField.value;
    options.headers = headers;
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
        return data;
      });
    });
  }

  function actionButton(label, className, handler) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", handler);
    return b;
  }

  function render(comments) {
    list.textContent = "";
    setStatus(comments.length + " comment" + (comments.length === 1 ? "" : "s"));

    comments.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "comment";

      var meta = document.createElement("p");
      meta.className = "comment-meta";
      var who = document.createElement("span");
      who.className = "who";
      who.textContent = c.author;
      meta.appendChild(who);
      meta.appendChild(document.createTextNode(" · " + formatDate(c.createdAt)));
      meta.appendChild(document.createTextNode(" · #" + c.id));
      if (c.parentId) meta.appendChild(document.createTextNode(" · reply to #" + c.parentId));
      if (!c.approved) {
        var badge = document.createElement("span");
        badge.className = "badge hidden";
        badge.textContent = "hidden";
        meta.appendChild(document.createTextNode(" "));
        meta.appendChild(badge);
      }

      var body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = c.body;

      var actions = document.createElement("div");
      actions.className = "comment-actions";

      if (c.approved) {
        actions.appendChild(actionButton("Hide", "action", function () {
          moderate(c.id, false);
        }));
      } else {
        actions.appendChild(actionButton("Unhide", "action", function () {
          moderate(c.id, true);
        }));
      }
      actions.appendChild(actionButton("Delete", "action danger", function () {
        remove(c.id);
      }));

      li.appendChild(meta);
      li.appendChild(body);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function refresh() {
    localStorage.setItem("adminToken", tokenField.value);
    var slug = slugField.value.trim();
    var path = "/api/comments" + (slug ? "?slug=" + encodeURIComponent(slug) : "");
    return api(path)
      .then(function (data) {
        render(data.comments || []);
      })
      .catch(function (err) {
        list.textContent = "";
        setStatus(err.message, "error");
      });
  }

  function moderate(id, approved) {
    api("/api/comments/" + id, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approved: approved }),
    })
      .then(refresh)
      .catch(function (err) {
        setStatus(err.message, "error");
      });
  }

  function remove(id) {
    if (!confirm("Delete comment #" + id + " and its replies?")) return;
    api("/api/comments/" + id, { method: "DELETE" })
      .then(refresh)
      .catch(function (err) {
        setStatus(err.message, "error");
      });
  }

  controls.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("Loading…");
    refresh();
  });
})();
